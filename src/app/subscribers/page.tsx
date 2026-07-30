import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { createSubscriber } from '../actions';

export const dynamic = 'force-dynamic';

export default async function SubscribersPage() {
  const subscribers = await prisma.subscriber.findMany({
    include: { subscriptions: { include: { vendor: { select: { name: true } } } } },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <h1>Subscribers</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Vendors tracked</th>
              <th>Onboarded</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/subscribers/${s.id}`}>
                    <strong>{s.name}</strong>
                  </Link>
                </td>
                <td>{s.email}</td>
                <td>{s.subscriptions.map((sub) => sub.vendor.name).join(', ') || '-'}</td>
                <td className="muted">{s.onboardedAt ? s.onboardedAt.toISOString().slice(0, 10) : 'not yet'}</td>
                <td>{s.active ? <span className="badge ok">active</span> : <span className="badge muted">inactive</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Add subscriber</h2>
      <div className="card">
        <form action={createSubscriber}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Name</label>
              <input type="text" name="name" required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Email</label>
              <input type="email" name="email" required />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit">Create subscriber</button>
          </div>
        </form>
      </div>
    </>
  );
}
