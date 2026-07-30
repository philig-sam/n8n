import { describe, expect, it } from 'vitest';
import { findClusterMatch, isSameEvent, titleSimilarity } from '@/services/cluster';

const base = {
  vendorId: 'v1',
  type: 'MERGER_ACQUISITION',
  createdAt: new Date('2026-01-10T12:00:00Z'),
  occurredAt: null,
};

describe('titleSimilarity', () => {
  it('is 1 for identical titles', () => {
    expect(titleSimilarity('Broadcom completes VMware acquisition', 'Broadcom completes VMware acquisition')).toBe(1);
  });

  it('is high for reworded headlines about the same story', () => {
    const sim = titleSimilarity(
      'Broadcom completes acquisition of VMware',
      'Broadcom closes VMware acquisition deal',
    );
    expect(sim).toBeGreaterThanOrEqual(0.5);
  });

  it('is low for unrelated stories', () => {
    const sim = titleSimilarity(
      'Broadcom completes acquisition of VMware',
      'PTC releases Creo 12 with AI features',
    );
    expect(sim).toBeLessThan(0.2);
  });
});

describe('isSameEvent', () => {
  it('clusters same vendor, type, similar title, close in time', () => {
    expect(
      isSameEvent(
        { ...base, title: 'Broadcom completes acquisition of VMware' },
        { ...base, title: 'Broadcom closes VMware acquisition', createdAt: new Date('2026-01-12T12:00:00Z') },
      ),
    ).toBe(true);
  });

  it('does not cluster across vendors', () => {
    expect(
      isSameEvent(
        { ...base, title: 'Broadcom completes acquisition of VMware' },
        { ...base, vendorId: 'v2', title: 'Broadcom completes acquisition of VMware' },
      ),
    ).toBe(false);
  });

  it('does not cluster different event types', () => {
    expect(
      isSameEvent(
        { ...base, title: 'Broadcom completes acquisition of VMware' },
        { ...base, type: 'PRICE_CHANGE', title: 'Broadcom completes acquisition of VMware' },
      ),
    ).toBe(false);
  });

  it('does not cluster events far apart in time', () => {
    expect(
      isSameEvent(
        { ...base, title: 'Broadcom completes acquisition of VMware' },
        {
          ...base,
          title: 'Broadcom completes acquisition of VMware',
          createdAt: new Date('2026-03-01T12:00:00Z'),
        },
      ),
    ).toBe(false);
  });

  it('uses occurredAt over createdAt when present', () => {
    expect(
      isSameEvent(
        {
          ...base,
          title: 'Broadcom completes acquisition of VMware',
          occurredAt: new Date('2026-01-10T00:00:00Z'),
        },
        {
          ...base,
          title: 'Broadcom completes VMware acquisition',
          createdAt: new Date('2026-03-01T12:00:00Z'),
          occurredAt: new Date('2026-01-11T00:00:00Z'),
        },
      ),
    ).toBe(true);
  });
});

describe('findClusterMatch', () => {
  it('returns the first matching event', () => {
    const existing = [
      { ...base, id: 'e1', title: 'PTC announces price increase' },
      { ...base, id: 'e2', title: 'Broadcom completes VMware acquisition' },
    ];
    const match = findClusterMatch(
      { ...base, title: 'Broadcom completes acquisition of VMware' },
      existing,
    );
    expect(match?.id).toBe('e2');
  });

  it('returns undefined when nothing matches', () => {
    expect(
      findClusterMatch({ ...base, title: 'Broadcom completes acquisition of VMware' }, []),
    ).toBeUndefined();
  });
});
