import { describe, expect, it } from 'vitest';
import { assembleDigest, DigestEvent, filterEventsForPeriod } from '@/services/assembly';

function event(overrides: Partial<DigestEvent>): DigestEvent {
  return {
    id: 'e1',
    vendorId: 'v1',
    type: 'LICENSING_MODEL',
    severity: 'normal',
    title: 'Event',
    summary: 'Summary.',
    sourceUrl: 'https://example.com',
    occurredAt: null,
    status: 'approved',
    createdAt: new Date('2026-02-15T00:00:00Z'),
    ...overrides,
  };
}

const periodStart = new Date('2026-01-01T00:00:00Z');
const periodEnd = new Date('2026-04-01T00:00:00Z');

describe('filterEventsForPeriod', () => {
  it('includes approved events inside the period', () => {
    expect(filterEventsForPeriod([event({})], periodStart, periodEnd)).toHaveLength(1);
  });

  it('excludes pending and rejected events (human gate)', () => {
    const events = [event({ status: 'pending' }), event({ status: 'rejected' })];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(0);
  });

  it('excludes events outside the period', () => {
    const events = [
      event({ createdAt: new Date('2025-12-31T00:00:00Z') }),
      event({ createdAt: new Date('2026-04-02T00:00:00Z') }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(0);
  });

  it('is exclusive of periodStart and inclusive of periodEnd (no double-send across digests)', () => {
    const atStart = event({ id: 'start', createdAt: periodStart });
    const atEnd = event({ id: 'end', createdAt: periodEnd });
    const result = filterEventsForPeriod([atStart, atEnd], periodStart, periodEnd);
    expect(result.map((e) => e.id)).toEqual(['end']);
  });

  it('prefers occurredAt over createdAt for period placement', () => {
    const events = [
      event({
        occurredAt: new Date('2025-11-01T00:00:00Z'),
        createdAt: new Date('2026-02-01T00:00:00Z'),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(0);
  });
});

describe('assembleDigest', () => {
  const vendorNames = new Map([
    ['v1', 'Broadcom (VMware)'],
    ['v2', 'PTC'],
  ]);

  it('groups events by vendor sorted by vendor name', () => {
    const events = [
      event({ id: 'a', vendorId: 'v2' }),
      event({ id: 'b', vendorId: 'v1' }),
      event({ id: 'c', vendorId: 'v2' }),
    ];
    const digest = assembleDigest(events, vendorNames, periodStart, periodEnd);
    expect(digest.groups.map((g) => g.vendorName)).toEqual(['Broadcom (VMware)', 'PTC']);
    expect(digest.groups[1].events).toHaveLength(2);
  });

  it('sorts events within a vendor newest-first', () => {
    const events = [
      event({ id: 'old', createdAt: new Date('2026-01-05T00:00:00Z') }),
      event({ id: 'new', createdAt: new Date('2026-03-05T00:00:00Z') }),
    ];
    const digest = assembleDigest(events, vendorNames, periodStart, periodEnd);
    expect(digest.groups[0].events.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('collects all event ids for the SendLog', () => {
    const events = [event({ id: 'a' }), event({ id: 'b', vendorId: 'v2' })];
    const digest = assembleDigest(events, vendorNames, periodStart, periodEnd);
    expect([...digest.eventIds].sort()).toEqual(['a', 'b']);
  });

  it('produces an empty digest for no events', () => {
    const digest = assembleDigest([], vendorNames, periodStart, periodEnd);
    expect(digest.groups).toHaveLength(0);
    expect(digest.eventIds).toHaveLength(0);
  });
});
