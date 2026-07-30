import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SendsPage() {
  const [logs, subscribers] = await Promise.all([
    prisma.sendLog.findMany({
      include: { subscriber: { select: { name: true, email: true } } },
      orderBy: { sentAt: 'desc' },
      take: 100,
    }),
    prisma.subscriber.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <>
      <h1>Sends</h1>

      <h2>Preview next digest</h2>
      <div className="card">
        <p className="muted">See exactly what a subscriber&apos;s next quarterly digest would contain right now.</p>
        <div className="row">
          {subscribers.map((s) => (
            <Link key={s.id} className="btn small secondary" href={`/sends/preview/${s.id}`}>
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <h2>History</h2>
      <div className="card">
        {logs.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Nothing sent yet.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Sent</th>
                <th>Kind</th>
                <th>Subscriber</th>
                <th>Period</th>
                <th>Events</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                let eventCount = 0;
                try {
                  eventCount = (JSON.parse(log.eventIds) as string[]).length;
                } catch {
                  /* ignore */
                }
                return (
                  <tr key={log.id}>
                    <td className="muted">{log.sentAt.toISOString().replace('T', ' ').slice(0, 16)}</td>
                    <td>
                      <span className={`badge ${log.kind === 'alert' ? 'high' : ''}`}>{log.kind}</span>
                    </td>
                    <td>
                      {log.subscriber.name} <span className="muted">({log.subscriber.email})</span>
                    </td>
                    <td className="muted">
                      {log.periodStart && log.periodEnd
                        ? `${log.periodStart.toISOString().slice(0, 10)} - ${log.periodEnd.toISOString().slice(0, 10)}`
                        : '-'}
                    </td>
                    <td>{eventCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
