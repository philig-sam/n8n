import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { buildDigestForSubscriber } from '@/services/sendDigests';
import { renderDigestEmail } from '@/render/emails';

export const dynamic = 'force-dynamic';

export default async function DigestPreviewPage({ params }: { params: { id: string } }) {
  const subscriber = await prisma.subscriber.findUnique({ where: { id: params.id } });
  if (!subscriber) notFound();

  const digest = await buildDigestForSubscriber(subscriber.id);
  if (!digest) notFound();

  const html = renderDigestEmail(subscriber.name, digest);

  return (
    <>
      <h1>Next digest preview - {subscriber.name}</h1>
      <p className="muted">
        Period {digest.periodStart.toISOString().slice(0, 10)} to {digest.periodEnd.toISOString().slice(0, 10)}{' '}
        &middot; {digest.eventIds.length} approved event{digest.eventIds.length === 1 ? '' : 's'} &middot;{' '}
        <Link href="/sends">back to sends</Link>
      </p>
      {digest.eventIds.length === 0 && (
        <div className="card">
          <p style={{ margin: 0 }}>
            No new approved events in this period - with SKIP_EMPTY_DIGESTS=true this subscriber would be skipped.
          </p>
        </div>
      )}
      <div className="card" style={{ background: '#fff' }}>
        <iframe srcDoc={html} style={{ width: '100%', height: '70vh', border: 'none' }} title="Digest preview" />
      </div>
    </>
  );
}
