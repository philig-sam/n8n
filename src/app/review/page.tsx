import { prisma } from '@/lib/prisma';
import ReviewQueue from './review-queue';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const events = await prisma.event.findMany({
    where: { status: 'pending' },
    include: {
      vendor: { select: { name: true } },
      rawItem: { select: { contentText: true, url: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const flagged = await prisma.rawItem.findMany({
    where: { needsReview: true },
    include: { vendor: { select: { name: true } } },
    orderBy: { fetchedAt: 'asc' },
  });

  return (
    <>
      <h1>Review queue</h1>
      <p className="muted">
        <kbd>j</kbd>/<kbd>k</kbd> navigate &middot; <kbd>a</kbd> approve &middot; <kbd>r</kbd> reject &middot;{' '}
        <kbd>e</kbd> edit &middot; only approved events can ever be sent.
      </p>
      <ReviewQueue
        events={events.map((e) => ({
          id: e.id,
          vendorName: e.vendor.name,
          type: e.type,
          severity: e.severity,
          title: e.title,
          summary: e.summary,
          sourceUrl: e.sourceUrl,
          occurredAt: e.occurredAt ? e.occurredAt.toISOString().slice(0, 10) : null,
          contentText: e.rawItem?.contentText ?? null,
        }))}
      />

      {flagged.length > 0 && (
        <>
          <h2>Items flagged for manual review (classification failed)</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Title</th>
                  <th>Fetched</th>
                </tr>
              </thead>
              <tbody>
                {flagged.map((item) => (
                  <tr key={item.id}>
                    <td>{item.vendor.name}</td>
                    <td>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.title}
                      </a>
                    </td>
                    <td className="muted">{item.fetchedAt.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
