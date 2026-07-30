import Parser from 'rss-parser';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ExtractedItem {
  url: string;
  title: string;
  contentText: string;
}

const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT = 'VendorLicensingIntelligence/1.0 (+internal SAM tooling)';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Fetch and parse an RSS/Atom feed into items. */
export async function extractFromRss(feedUrl: string): Promise<ExtractedItem[]> {
  const xml = await fetchText(feedUrl);
  const parser = new Parser();
  const feed = await parser.parseString(xml);
  const items: ExtractedItem[] = [];
  for (const item of feed.items ?? []) {
    const url = item.link ?? feedUrl;
    const title = (item.title ?? '').trim();
    if (!title) continue;
    const body =
      item.contentSnippet || item.content || item.summary || item['content:encoded'] || '';
    items.push({
      url,
      title,
      contentText: htmlToText(String(body)).slice(0, 20_000),
    });
  }
  return items;
}

/**
 * Fetch a plain web page and extract the readable article text. A page source
 * yields a single item whose hash changes when the page content changes
 * (useful for lifecycle/EOL pages without feeds).
 */
export async function extractFromPage(pageUrl: string, label: string): Promise<ExtractedItem[]> {
  const html = await fetchText(pageUrl);
  const article = readableArticle(html, pageUrl);
  const title = article?.title?.trim() || label;
  const text = (article?.textContent ?? htmlToText(html)).trim();
  if (!text) return [];
  return [{ url: pageUrl, title, contentText: text.slice(0, 40_000) }];
}

/** Fetch an article URL and return its readable text (used to enrich thin RSS items). */
export async function extractArticleText(url: string): Promise<string | null> {
  try {
    const html = await fetchText(url);
    const article = readableArticle(html, url);
    const text = article?.textContent?.trim();
    return text ? text.slice(0, 40_000) : null;
  } catch {
    return null;
  }
}

function readableArticle(html: string, url: string) {
  // jsdom logs CSS parse errors loudly; silence them.
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  const dom = new JSDOM(html, { url, virtualConsole });
  try {
    return new Readability(dom.window.document).parse();
  } catch {
    return null;
  }
}

export function htmlToText(html: string): string {
  if (!/[<&]/.test(html)) return html.trim();
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', () => {});
  const dom = new JSDOM(`<body>${html}</body>`, { virtualConsole });
  return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
