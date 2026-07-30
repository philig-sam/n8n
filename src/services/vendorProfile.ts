import { prisma } from '@/lib/prisma';
import { generateVendorProfile } from './claude';

/**
 * Regenerate a vendor's profileMarkdown from the existing profile plus the
 * most recent approved events (admin-triggered).
 */
export async function regenerateVendorProfile(vendorId: string): Promise<string | null> {
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return null;

  const events = await prisma.event.findMany({
    where: { vendorId, status: 'approved' },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take: 30,
  });

  const markdown = await generateVendorProfile(
    vendor.name,
    vendor.profileMarkdown,
    events.map((e) => ({
      type: e.type,
      severity: e.severity,
      title: e.title,
      summary: e.summary,
      sourceUrl: e.sourceUrl,
      occurredAt: e.occurredAt ? e.occurredAt.toISOString().slice(0, 10) : null,
    })),
  );

  await prisma.vendor.update({ where: { id: vendorId }, data: { profileMarkdown: markdown } });
  return markdown;
}
