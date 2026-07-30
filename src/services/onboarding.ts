import { prisma } from '@/lib/prisma';
import { getMailer } from './mailer';
import { renderOnboardingDocument } from '@/render/onboarding';

/** Assemble the onboarding HTML document for a subscriber's tracked vendors. */
export async function buildOnboardingDocument(subscriberId: string): Promise<{
  subscriberName: string;
  html: string;
} | null> {
  const subscriber = await prisma.subscriber.findUnique({
    where: { id: subscriberId },
    include: {
      subscriptions: { include: { vendor: true }, orderBy: { vendor: { name: 'asc' } } },
    },
  });
  if (!subscriber) return null;

  const vendors = subscriber.subscriptions.map((s) => ({
    name: s.vendor.name,
    profileMarkdown: s.vendor.profileMarkdown,
  }));

  return {
    subscriberName: subscriber.name,
    html: renderOnboardingDocument(subscriber.name, vendors),
  };
}

/** Send (or resend) the onboarding document by email and log it. */
export async function sendOnboarding(subscriberId: string): Promise<boolean> {
  const subscriber = await prisma.subscriber.findUnique({ where: { id: subscriberId } });
  const doc = await buildOnboardingDocument(subscriberId);
  if (!subscriber || !doc) return false;

  await getMailer().send({
    to: subscriber.email,
    subject: 'Your Vendor Licensing Intelligence onboarding briefing',
    html: doc.html,
  });

  await prisma.sendLog.create({
    data: { subscriberId, kind: 'onboarding', eventIds: '[]' },
  });
  await prisma.subscriber.update({
    where: { id: subscriberId },
    data: { onboardedAt: subscriber.onboardedAt ?? new Date() },
  });
  return true;
}
