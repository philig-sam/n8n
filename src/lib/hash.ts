import { createHash } from 'node:crypto';

// Stable dedupe hash for a fetched item. Normalizes title + URL so the same
// story re-fetched later (or with tracking params) hashes identically.
export function contentHashFor(title: string, url: string): string {
  const normTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const normUrl = normalizeUrl(url);
  return createHash('sha256').update(`${normTitle}\n${normUrl}`).digest('hex');
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // Strip common tracking params that vary between fetches of the same story
    const tracking = /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref)/;
    for (const key of [...u.searchParams.keys()]) {
      if (tracking.test(key)) u.searchParams.delete(key);
    }
    u.searchParams.sort();
    // Trailing slash and protocol case shouldn't create "new" items
    let s = u.toString().toLowerCase();
    if (s.endsWith('/')) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim().toLowerCase();
  }
}
