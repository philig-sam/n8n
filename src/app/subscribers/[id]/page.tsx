import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { sendOnboardingAction, updateSubscriber } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function SubscriberDetailPage({ params }: { params: { id: string } }) {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: params.id },
    include: { subscriptions: true },
  });
  if (!subscriber) notFound();

  const vendors = await prisma.vendor.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  const subscribedIds = new Set(subscriber.subscriptions.map((s) => s.vendorId));

  return (
    <>
      <h1>{subscriber.name}</h1>

      <div className="card">
        <form action={updateSubscriber}>
          <input type="hidden" name="id" value={subscriber.id} />
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Name</label>
              <input type="text" name="name" defaultValue={subscriber.name} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Email</label>
              <input type="email" name="email" defaultValue={subscriber.email} required />
            </div>
            <div>
              <label>Active</label>
              <input type="checkbox" name="active" defaultChecked={subscriber.active} />
            </div>
          </div>

          <label>Vendors tracked</label>
          {vendors.map((v) => (
            <div key={v.id}>
              <label style={{ fontWeight: 400, display: 'inline-flex', gap: 8, margin: '2px 0' }}>
                <input type="checkbox" name="vendorIds" value={v.id} defaultChecked={subscribedIds.has(v.id)} />
                {v.name}
              </label>
            </div>
          ))}

          <div style={{ marginTop: 12 }}>
            <button type="submit">Save</button>
          </div>
        </form>
      </div>

      <h2>Onboarding document</h2>
      <div className="card">
        <p className="muted">
          Bundled current-state briefing for every vendor this subscriber tracks.
          {subscriber.onboardedAt && <> Last onboarded: {subscriber.onboardedAt.toISOString().slice(0, 10)}.</>}
        </p>
        <div className="row">
          <a className="btn secondary" href={`/api/subscribers/${subscriber.id}/onboarding`} target="_blank">
            View HTML
          </a>
          <a className="btn secondary" href={`/api/subscribers/${subscriber.id}/onboarding?format=pdf`}>
            Export PDF
          </a>
          <form action={sendOnboardingAction} className="inline">
            <input type="hidden" name="id" value={subscriber.id} />
            <button>{subscriber.onboardedAt ? 'Resend onboarding email' : 'Send onboarding email'}</button>
          </form>
          <a className="btn secondary" href={`/sends/preview/${subscriber.id}`}>
            Preview next digest
          </a>
        </div>
      </div>
    </>
  );
}
