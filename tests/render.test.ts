import { describe, expect, it } from 'vitest';
import { renderDigestEmail, renderAlertEmail } from '@/render/emails';
import { renderOnboardingDocument } from '@/render/onboarding';
import { escapeHtml, markdownToHtml } from '@/render/html';
import { assembleDigest } from '@/services/assembly';

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x&y")</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&amp;y&quot;)&lt;/script&gt;',
    );
  });
});

describe('renderDigestEmail', () => {
  const digest = assembleDigest(
    [
      {
        id: 'e1',
        vendorId: 'v1',
        type: 'PRICE_CHANGE',
        severity: 'high',
        title: 'PTC raises prices <10%>',
        summary: 'PTC announced a price increase.',
        sourceUrl: 'https://example.com/ptc',
        occurredAt: new Date('2026-02-01T00:00:00Z'),
        status: 'approved',
        createdAt: new Date('2026-02-02T00:00:00Z'),
      },
    ],
    new Map([['v1', 'PTC']]),
    new Date('2026-01-01T00:00:00Z'),
    new Date('2026-04-01T00:00:00Z'),
  );

  it('includes period, vendor, title, summary and source link', () => {
    const html = renderDigestEmail('Alex', digest);
    expect(html).toContain('2026-01-01 to 2026-04-01');
    expect(html).toContain('PTC');
    expect(html).toContain('PTC announced a price increase.');
    expect(html).toContain('https://example.com/ptc');
  });

  it('escapes untrusted event text', () => {
    const html = renderDigestEmail('Alex', digest);
    expect(html).toContain('PTC raises prices &lt;10%&gt;');
    expect(html).not.toContain('<10%>');
  });
});

describe('renderAlertEmail', () => {
  it('renders the event with severity and source', () => {
    const html = renderAlertEmail('Alex', {
      vendorName: 'Broadcom (VMware)',
      type: 'MERGER_ACQUISITION',
      severity: 'high',
      title: 'Broadcom acquires X',
      summary: 'Summary here.',
      sourceUrl: 'https://example.com/deal',
      occurredAt: null,
    });
    expect(html).toContain('Broadcom (VMware)');
    expect(html).toContain('HIGH');
    expect(html).toContain('https://example.com/deal');
  });
});

describe('renderOnboardingDocument', () => {
  it('renders one section per vendor from profile markdown', () => {
    const html = renderOnboardingDocument('Acme Corp', [
      { name: 'PTC', profileMarkdown: '# PTC\n\n## Positioning\nSubscription-only vendor.' },
      { name: 'Broadcom (VMware)', profileMarkdown: '# Broadcom\n\n- move one\n- move two' },
    ]);
    expect(html).toContain('Acme Corp');
    expect(html).toContain('Subscription-only vendor.');
    expect(html).toContain('<li>move one</li>');
    expect(html).toContain('2 vendors tracked');
  });
});

describe('markdownToHtml', () => {
  it('renders headings, bullets, links and bold', () => {
    const html = markdownToHtml('# Title\n\n## Section\n- **bold** item with https://x.com/a\n\nPara.');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<h3>Section</h3>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('href="https://x.com/a"');
    expect(html).toContain('<p>Para.</p>');
  });

  it('escapes raw HTML in the markdown', () => {
    expect(markdownToHtml('hello <img src=x onerror=alert(1)>')).not.toContain('<img');
  });
});
