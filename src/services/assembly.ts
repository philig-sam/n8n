// Pure assembly logic for digests: filtering approved events into a
// subscriber's reporting period and grouping them by vendor. No DB access -
// unit-testable.

export interface DigestEvent {
  id: string;
  vendorId: string;
  type: string;
  severity: string;
  title: string;
  summary: string;
  sourceUrl: string;
  occurredAt: Date | null;
  status: string;
  createdAt: Date;
}

export interface DigestVendorGroup {
  vendorId: string;
  vendorName: string;
  events: DigestEvent[];
}

export interface DigestData {
  periodStart: Date;
  periodEnd: Date;
  groups: DigestVendorGroup[];
  eventIds: string[];
}

/**
 * Approved events that fall inside (periodStart, periodEnd]. An event counts
 * by its approval-eligible timestamp: occurredAt when known, else createdAt.
 */
export function filterEventsForPeriod(
  events: DigestEvent[],
  periodStart: Date,
  periodEnd: Date,
): DigestEvent[] {
  return events.filter((e) => {
    if (e.status !== 'approved') return false;
    const t = e.occurredAt ?? e.createdAt;
    return t.getTime() > periodStart.getTime() && t.getTime() <= periodEnd.getTime();
  });
}

/** Group events by vendor, ordering vendors by name and events newest-first. */
export function assembleDigest(
  events: DigestEvent[],
  vendorNames: Map<string, string>,
  periodStart: Date,
  periodEnd: Date,
): DigestData {
  const byVendor = new Map<string, DigestEvent[]>();
  for (const event of events) {
    const list = byVendor.get(event.vendorId) ?? [];
    list.push(event);
    byVendor.set(event.vendorId, list);
  }

  const groups: DigestVendorGroup[] = [...byVendor.entries()]
    .map(([vendorId, vendorEvents]) => ({
      vendorId,
      vendorName: vendorNames.get(vendorId) ?? vendorId,
      events: vendorEvents.sort(
        (a, b) =>
          (b.occurredAt ?? b.createdAt).getTime() - (a.occurredAt ?? a.createdAt).getTime(),
      ),
    }))
    .sort((a, b) => a.vendorName.localeCompare(b.vendorName));

  return {
    periodStart,
    periodEnd,
    groups,
    eventIds: groups.flatMap((g) => g.events.map((e) => e.id)),
  };
}
