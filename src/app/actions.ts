'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  EventStatusSchema,
  EventTypeSchema,
  SeveritySchema,
  SourceKindSchema,
} from '@/lib/domain';
import { isJobName, runJob } from '@/jobs/registry';
import { regenerateVendorProfile } from '@/services/vendorProfile';
import { sendOnboarding } from '@/services/onboarding';
import { z } from 'zod';

// ---- Jobs ----

export async function runJobAction(formData: FormData) {
  const name = String(formData.get('job') ?? '');
  if (isJobName(name)) await runJob(name);
  revalidatePath('/');
}

// ---- Events (review queue) ----

export async function approveEvent(formData: FormData) {
  await prisma.event.update({
    where: { id: String(formData.get('id')) },
    data: { status: 'approved' },
  });
  revalidatePath('/review');
  revalidatePath('/');
}

export async function rejectEvent(formData: FormData) {
  await prisma.event.update({
    where: { id: String(formData.get('id')) },
    data: { status: 'rejected' },
  });
  revalidatePath('/review');
  revalidatePath('/');
}

const EventEditSchema = z.object({
  type: EventTypeSchema,
  severity: SeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  status: EventStatusSchema.optional(),
});

export async function updateEvent(formData: FormData) {
  const id = String(formData.get('id'));
  const parsed = EventEditSchema.parse({
    type: formData.get('type'),
    severity: formData.get('severity'),
    title: formData.get('title'),
    summary: formData.get('summary'),
    status: formData.get('status') || undefined,
  });
  await prisma.event.update({ where: { id }, data: parsed });
  revalidatePath('/review');
  revalidatePath('/');
}

// ---- Vendors & sources ----

const VendorSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, dashes'),
  active: z.boolean(),
});

export async function createVendor(formData: FormData) {
  const parsed = VendorSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    active: true,
  });
  const vendor = await prisma.vendor.create({ data: parsed });
  revalidatePath('/vendors');
  redirect(`/vendors/${vendor.id}`);
}

export async function updateVendor(formData: FormData) {
  const id = String(formData.get('id'));
  const parsed = VendorSchema.parse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    active: formData.get('active') === 'on',
  });
  await prisma.vendor.update({
    where: { id },
    data: { ...parsed, profileMarkdown: String(formData.get('profileMarkdown') ?? '') },
  });
  revalidatePath(`/vendors/${id}`);
  revalidatePath('/vendors');
}

export async function regenerateProfileAction(formData: FormData) {
  const id = String(formData.get('id'));
  await regenerateVendorProfile(id);
  revalidatePath(`/vendors/${id}`);
}

const SourceSchema = z.object({
  vendorId: z.string().min(1),
  kind: SourceKindSchema,
  url: z.string().url(),
  label: z.string().min(1),
});

export async function addSource(formData: FormData) {
  const parsed = SourceSchema.parse({
    vendorId: formData.get('vendorId'),
    kind: formData.get('kind'),
    url: formData.get('url'),
    label: formData.get('label'),
  });
  await prisma.source.create({ data: parsed });
  revalidatePath(`/vendors/${parsed.vendorId}`);
}

export async function toggleSource(formData: FormData) {
  const id = String(formData.get('id'));
  const source = await prisma.source.findUnique({ where: { id } });
  if (source) {
    await prisma.source.update({ where: { id }, data: { active: !source.active } });
    revalidatePath(`/vendors/${source.vendorId}`);
  }
}

export async function deleteSource(formData: FormData) {
  const id = String(formData.get('id'));
  const source = await prisma.source.delete({ where: { id } });
  revalidatePath(`/vendors/${source.vendorId}`);
}

// ---- Subscribers ----

const SubscriberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  active: z.boolean(),
});

export async function createSubscriber(formData: FormData) {
  const parsed = SubscriberSchema.parse({
    name: formData.get('name'),
    email: formData.get('email'),
    active: true,
  });
  const subscriber = await prisma.subscriber.create({ data: parsed });
  revalidatePath('/subscribers');
  redirect(`/subscribers/${subscriber.id}`);
}

export async function updateSubscriber(formData: FormData) {
  const id = String(formData.get('id'));
  const parsed = SubscriberSchema.parse({
    name: formData.get('name'),
    email: formData.get('email'),
    active: formData.get('active') === 'on',
  });
  const vendorIds = formData.getAll('vendorIds').map(String);

  await prisma.$transaction([
    prisma.subscriber.update({ where: { id }, data: parsed }),
    prisma.subscription.deleteMany({ where: { subscriberId: id, vendorId: { notIn: vendorIds } } }),
    ...vendorIds.map((vendorId) =>
      prisma.subscription.upsert({
        where: { subscriberId_vendorId: { subscriberId: id, vendorId } },
        update: {},
        create: { subscriberId: id, vendorId },
      }),
    ),
  ]);
  revalidatePath(`/subscribers/${id}`);
  revalidatePath('/subscribers');
}

export async function sendOnboardingAction(formData: FormData) {
  const id = String(formData.get('id'));
  await sendOnboarding(id);
  revalidatePath(`/subscribers/${id}`);
  revalidatePath('/sends');
}
