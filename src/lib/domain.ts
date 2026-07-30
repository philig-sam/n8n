import { z } from 'zod';

// App-level enums. The Prisma schema stores these as String (SQLite has no
// native enums); every write goes through these schemas so the DB never
// contains an unknown value.

export const EVENT_TYPES = [
  'MERGER_ACQUISITION',
  'LICENSING_MODEL',
  'PRICE_CHANGE',
  'PRODUCT_EOL',
  'LEADERSHIP_STRATEGY',
  'PARTNER_PROGRAM',
  'LEGAL_REGULATORY',
  'OTHER',
] as const;
export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MERGER_ACQUISITION: 'M&A',
  LICENSING_MODEL: 'Licensing model',
  PRICE_CHANGE: 'Price change',
  PRODUCT_EOL: 'Product EOL',
  LEADERSHIP_STRATEGY: 'Leadership & strategy',
  PARTNER_PROGRAM: 'Partner program',
  LEGAL_REGULATORY: 'Legal & regulatory',
  OTHER: 'Other',
};

export const SEVERITIES = ['high', 'normal'] as const;
export const SeveritySchema = z.enum(SEVERITIES);
export type Severity = z.infer<typeof SeveritySchema>;

export const EVENT_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const EventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const SOURCE_KINDS = ['rss', 'page'] as const;
export const SourceKindSchema = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof SourceKindSchema>;

export const SEND_KINDS = ['onboarding', 'digest', 'alert'] as const;
export const SendKindSchema = z.enum(SEND_KINDS);
export type SendKind = z.infer<typeof SendKindSchema>;

// Strict shape the classify-and-summarize prompt must return.
export const ClassificationSchema = z.object({
  material: z.boolean(),
  type: EventTypeSchema.nullable(),
  severity: SeveritySchema.nullable(),
  summary: z.string().nullable(),
  // ISO date (YYYY-MM-DD) if the text states when the event occurred
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});
export type Classification = z.infer<typeof ClassificationSchema>;
