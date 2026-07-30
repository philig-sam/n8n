import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

// Lightweight HTML-to-PDF using a system Chromium via puppeteer-core (no
// bundled browser download). Set PUPPETEER_EXECUTABLE_PATH or install
// chromium (see Dockerfile).
const CHROMIUM_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/opt/pw-browsers/chromium',
].filter((p): p is string => Boolean(p));

export function findChromium(): string | null {
  for (const candidate of CHROMIUM_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = findChromium();
  if (!executablePath) {
    throw new Error(
      'No Chromium found for PDF export. Set PUPPETEER_EXECUTABLE_PATH or install chromium.',
    );
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
