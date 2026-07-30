import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { createVendor } from '../actions';

export const dynamic = 'force-dynamic';

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: { _count: { select: { sources: true, events: true, subscriptions: true } } },
    orderBy: { name: 'asc' },
  });

  return (
    <>
      <h1>Vendors</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Slug</th>
              <th>Sources</th>
              <th>Events</th>
              <th>Subscribers</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <tr key={v.id}>
                <td>
                  <Link href={`/vendors/${v.id}`}>
                    <strong>{v.name}</strong>
                  </Link>
                </td>
                <td className="mono">{v.slug}</td>
                <td>{v._count.sources}</td>
                <td>{v._count.events}</td>
                <td>{v._count.subscriptions}</td>
                <td>{v.active ? <span className="badge ok">active</span> : <span className="badge muted">inactive</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Add vendor</h2>
      <div className="card">
        <form action={createVendor}>
          <div className="row">
            <div style={{ flex: 2 }}>
              <label>Name</label>
              <input type="text" name="name" required placeholder="Broadcom (VMware)" />
            </div>
            <div style={{ flex: 1 }}>
              <label>Slug</label>
              <input type="text" name="slug" required pattern="[a-z0-9-]+" placeholder="broadcom-vmware" />
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="submit">Create vendor</button>
          </div>
        </form>
      </div>
    </>
  );
}
