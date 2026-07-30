import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getJobInfos } from '@/jobs/registry';
import { runJobAction } from './actions';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [pendingEvents, unprocessedItems, needsReview, sources, jobInfos] = await Promise.all([
    prisma.event.count({ where: { status: 'pending' } }),
    prisma.rawItem.count({ where: { processed: false } }),
    prisma.rawItem.count({ where: { needsReview: true } }),
    prisma.source.findMany({ include: { vendor: { select: { name: true } } }, orderBy: { label: 'asc' } }),
    Promise.resolve(getJobInfos()),
  ]);

  const unhealthySources = sources.filter((s) => s.lastError);

  return (
    <>
      <h1>Dashboard {env.dryRun && <span className="badge muted">DRY RUN - emails are logged, not sent</span>}</h1>

      <div className="grid">
        <div className="card">
          <div className="stat">{pendingEvents}</div>
          <div>
            <Link href="/review">Pending events to review</Link>
          </div>
        </div>
        <div className="card">
          <div className="stat">{unprocessedItems}</div>
          <div>Unprocessed raw items</div>
        </div>
        <div className="card">
          <div className="stat">{needsReview}</div>
          <div>Items flagged for manual review</div>
        </div>
        <div className="card">
          <div className="stat" style={unhealthySources.length ? { color: 'var(--red)' } : undefined}>
            {unhealthySources.length}
          </div>
          <div>Sources with errors</div>
        </div>
      </div>

      <h2>Jobs</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Schedule (cron)</th>
              <th>Last run</th>
              <th>Last result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobInfos.map((job) => (
              <tr key={job.name}>
                <td>
                  <strong>{job.name}</strong>
                </td>
                <td className="mono">{job.cronExpression}</td>
                <td className="muted">
                  {job.running ? 'running…' : job.lastRunAt ? job.lastRunAt.toISOString().replace('T', ' ').slice(0, 19) : 'not yet run'}
                </td>
                <td className="mono" style={{ maxWidth: 320, overflowWrap: 'anywhere' }}>
                  {job.lastError ? <span className="badge err">{job.lastError}</span> : job.lastResult ?? '-'}
                </td>
                <td>
                  <form action={runJobAction} className="inline">
                    <input type="hidden" name="job" value={job.name} />
                    <button className="small secondary" disabled={job.running}>
                      Run now
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ marginBottom: 0 }}>
          Cron schedules are set via env (CRON_POLL_SOURCES etc.) and evaluated in server-local time.
        </p>
      </div>

      <h2>Source health</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Vendor</th>
              <th>Kind</th>
              <th>Last fetch</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.label}
                  </a>
                  {!s.active && <span className="badge muted" style={{ marginLeft: 6 }}>inactive</span>}
                </td>
                <td>{s.vendor.name}</td>
                <td>
                  <span className="badge">{s.kind}</span>
                </td>
                <td className="muted">
                  {s.lastFetchedAt ? s.lastFetchedAt.toISOString().replace('T', ' ').slice(0, 19) : 'never'}
                </td>
                <td>
                  {s.lastError ? (
                    <span className="badge err" title={s.lastError}>
                      error
                    </span>
                  ) : s.lastFetchedAt ? (
                    <span className="badge ok">healthy</span>
                  ) : (
                    <span className="badge muted">pending</span>
                  )}
                  {s.lastError && <div className="muted mono" style={{ marginTop: 4 }}>{s.lastError.slice(0, 160)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
