import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  addSource,
  deleteSource,
  regenerateProfileAction,
  toggleSource,
  updateVendor,
} from '../../actions';

export const dynamic = 'force-dynamic';

export default async function VendorDetailPage({ params }: { params: { id: string } }) {
  const vendor = await prisma.vendor.findUnique({
    where: { id: params.id },
    include: {
      sources: { orderBy: { label: 'asc' } },
      events: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!vendor) notFound();

  return (
    <>
      <h1>{vendor.name}</h1>

      <div className="card">
        <form action={updateVendor}>
          <input type="hidden" name="id" value={vendor.id} />
          <div className="row">
            <div style={{ flex: 2 }}>
              <label>Name</label>
              <input type="text" name="name" defaultValue={vendor.name} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Slug</label>
              <input type="text" name="slug" defaultValue={vendor.slug} required pattern="[a-z0-9-]+" />
            </div>
            <div>
              <label>Active</label>
              <input type="checkbox" name="active" defaultChecked={vendor.active} />
            </div>
          </div>
          <label>Profile (Markdown - positioning, playbook &amp; timeline, product &amp; licensing changes, sources)</label>
          <textarea name="profileMarkdown" defaultValue={vendor.profileMarkdown} style={{ minHeight: 280 }} />
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Save</button>
          </div>
        </form>
        <form action={regenerateProfileAction} style={{ marginTop: 8 }}>
          <input type="hidden" name="id" value={vendor.id} />
          <button className="secondary">Regenerate profile from approved events (Claude)</button>
        </form>
      </div>

      <h2>Sources</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Kind</th>
              <th>URL</th>
              <th>Health</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {vendor.sources.map((s) => (
              <tr key={s.id}>
                <td>{s.label}</td>
                <td>
                  <span className="badge">{s.kind}</span>
                </td>
                <td className="mono" style={{ maxWidth: 300, overflowWrap: 'anywhere' }}>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.url}
                  </a>
                </td>
                <td>
                  {!s.active ? (
                    <span className="badge muted">inactive</span>
                  ) : s.lastError ? (
                    <span className="badge err" title={s.lastError}>
                      error
                    </span>
                  ) : s.lastFetchedAt ? (
                    <span className="badge ok">healthy</span>
                  ) : (
                    <span className="badge muted">pending</span>
                  )}
                </td>
                <td>
                  <div className="row">
                    <form action={toggleSource} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="small secondary">{s.active ? 'Disable' : 'Enable'}</button>
                    </form>
                    <form action={deleteSource} className="inline">
                      <input type="hidden" name="id" value={s.id} />
                      <button className="small danger">Delete</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Add source</h2>
        <form action={addSource}>
          <input type="hidden" name="vendorId" value={vendor.id} />
          <div className="row">
            <div style={{ flex: 1 }}>
              <label>Label</label>
              <input type="text" name="label" required placeholder="Vendor newsroom (RSS)" />
            </div>
            <div>
              <label>Kind</label>
              <select name="kind" defaultValue="rss">
                <option value="rss">rss</option>
                <option value="page">page</option>
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label>URL</label>
              <input type="url" name="url" required placeholder="https://…" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit">Add source</button>
          </div>
        </form>
      </div>

      <h2>Recent approved events</h2>
      <div className="card">
        {vendor.events.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            None yet.
          </p>
        ) : (
          <table>
            <tbody>
              {vendor.events.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="badge">{e.type}</span>
                  </td>
                  <td>
                    <a href={e.sourceUrl} target="_blank" rel="noreferrer">
                      {e.title}
                    </a>
                  </td>
                  <td className="muted">{(e.occurredAt ?? e.createdAt).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
