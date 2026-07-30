import { describe, expect, it } from 'vitest';
import { contentHashFor, normalizeUrl } from '@/lib/hash';

describe('contentHashFor', () => {
  it('is stable for identical input', () => {
    expect(contentHashFor('Broadcom closes VMware deal', 'https://x.com/a')).toBe(
      contentHashFor('Broadcom closes VMware deal', 'https://x.com/a'),
    );
  });

  it('normalizes whitespace and case in titles', () => {
    expect(contentHashFor('  Broadcom   Closes VMware Deal ', 'https://x.com/a')).toBe(
      contentHashFor('broadcom closes vmware deal', 'https://x.com/a'),
    );
  });

  it('ignores tracking params and fragments in URLs', () => {
    expect(
      contentHashFor('t', 'https://x.com/a?utm_source=rss&utm_medium=feed#section'),
    ).toBe(contentHashFor('t', 'https://x.com/a'));
  });

  it('differs for different stories', () => {
    expect(contentHashFor('Story A', 'https://x.com/a')).not.toBe(
      contentHashFor('Story B', 'https://x.com/a'),
    );
  });

  it('keeps meaningful query params', () => {
    expect(contentHashFor('t', 'https://x.com/a?id=1')).not.toBe(
      contentHashFor('t', 'https://x.com/a?id=2'),
    );
  });
});

describe('normalizeUrl', () => {
  it('sorts query params so param order does not matter', () => {
    expect(normalizeUrl('https://x.com/a?b=2&a=1')).toBe(normalizeUrl('https://x.com/a?a=1&b=2'));
  });

  it('strips trailing slash', () => {
    expect(normalizeUrl('https://x.com/a/')).toBe(normalizeUrl('https://x.com/a'));
  });

  it('falls back gracefully for non-URLs', () => {
    expect(normalizeUrl('not a url')).toBe('not a url');
  });
});
