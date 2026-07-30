import { prisma } from '@/lib/prisma';
import { getMailer } from './mailer';
import { renderAlertEmail } from '@/render/emails';

export interface AlertResult {
  eventsAlerted: number;
  emailsSent: number;
}

/**
 * Job 3: email approved high-severity events (sentAt null) to the vendor's
 * subscribers. Marks the event sent and writes a SendLog per subscriber.
 * Only approved events can ever reach this point (the human gate).
 */
export async function sendAlerts(): Promise<AlertResult> {
  const events = await prisma.event.findMany({
    where: { status: 'approved', severity: 'high', sentAt: null },
    include: { vendor: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const mailer = getMailer();
  const result: AlertResult = { eventsAlerted: 0, emailsSent: 0 };

  for (const event of events) {
    const subscriptions = await prisma.subscription.findMany({
      where: { vendorId: event.vendorId, subscriber: { active: true } },
      include: { subscriber: true },
    });

    for (const sub of subscriptions) {
      await mailer.send({
        to: sub.subscriber.email,
        subject: `[Vendor Alert] ${event.vendor.name}: ${event.title}`,
        html: renderAlertEmail(sub.subscriber.name, {
          vendorName: event.vendor.name,
          type: event.type,
          severity: event.severity,
          title: event.title,
          summary: event.summary,
          sourceUrl: event.sourceUrl,
          occurredAt: event.occurredAt,
        }),
      });
      await prisma.sendLog.create({
        data: {
          subscriberId: sub.subscriberId,
          kind: 'alert',
          eventIds: JSON.stringify([event.id]),
        },
      });
      result.emailsSent++;
    }

    await prisma.event.update({ where: { id: event.id }, data: { sentAt: new Date() } });
    result.eventsAlerted++;
  }

  console.log(`[sendAlerts] events=${result.eventsAlerted} emails=${result.emailsSent}`);
  return result;
}
