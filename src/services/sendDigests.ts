import { prisma } from '@/lib/prisma';
import { env } from '@/lib/env';
import { getMailer } from './mailer';
import { assembleDigest, DigestData, filterEventsForPeriod } from './assembly';
import { renderDigestEmail } from '@/render/emails';

export interface DigestRunResult {
  subscribersConsidered: number;
  digestsSent: number;
  skippedEmpty: number;
}

/**
 * Build (but do not send) the next digest for a subscriber: approved events
 * for their vendors since their last digest SendLog (or subscriber creation).
 * Used by the digest job and by the admin "preview next digest" screen.
 */
export async function buildDigestForSubscriber(
  subscriberId: string,
  now: Date = new Date(),
): Promise<DigestData | null> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: { subscriptions: { include: { vendor: true } } },
  });
  if (!subscriber) return null;

  const lastDigest = await prisma.sendLog.findFirst({
    where: { subscriberId, kind: 'digest' },
    orderBy: { sentAt: 'desc' },
  });
  const periodStart = lastDigest?.periodEnd ?? lastDigest?.sentAt ?? subscriber.createdAt;

  const vendorIds = subscriber.subscriptions.map((s) => s.vendorId);
  const vendorNames = new Map(subscriber.subscriptions.map((s) => [s.vendorId, s.vendor.name]));

  const events = await prisma.event.findMany({
    where: { vendorId: { in: vendorIds }, status: 'approved' },
  });

  const inPeriod = filterEventsForPeriod(events, periodStart, now);
  return assembleDigest(inPeriod, vendorNames, periodStart, now);
}

/**
 * Job 4: quarterly digest run. For each active subscriber, send approved
 * events since their last digest; skip empty digests when configured.
 */
export async function sendQuarterlyDigests(now: Date = new Date()): Promise<DigestRunResult> {
  const subscribers = await prisma.subscriber.findMany({ where: { active: true } });
  const mailer = getMailer();
  const result: DigestRunResult = { subscribersConsidered: 0, digestsSent: 0, skippedEmpty: 0 };

  for (const subscriber of subscribers) {
    result.subscribersConsidered++;
    const digest = await buildDigestForSubscriber(subscriber.id, now);
    if (!digest) continue;

    if (digest.eventIds.length === 0 && env.skipEmptyDigests) {
      result.skippedEmpty++;
      continue;
    }

    const period = `${digest.periodStart.toISOString().slice(0, 10)} - ${digest.periodEnd
      .toISOString()
      .slice(0, 10)}`;
    await mailer.send({
      to: subscriber.email,
      subject: `Vendor Licensing Digest (${period})`,
      html: renderDigestEmail(subscriber.name, digest),
    });
    await prisma.sendLog.create({
      data: {
        subscriberId: subscriber.id,
        kind: 'digest',
        periodStart: digest.periodStart,
        periodEnd: digest.periodEnd,
        eventIds: JSON.stringify(digest.eventIds),
      },
    });
    result.digestsSent++;
  }

  console.log(
    `[sendQuarterlyDigests] considered=${result.subscribersConsidered} sent=${result.digestsSent} skippedEmpty=${result.skippedEmpty}`,
  );
  return result;
}
