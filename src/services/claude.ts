import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/lib/env';
import { Classification, ClassificationSchema } from '@/lib/domain';

let client: Anthropic | undefined;

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

// Test seam
export function setAnthropicClient(c: Anthropic | undefined): void {
  client = c;
}

const CLASSIFY_SYSTEM = `You are an analyst for a Software Asset Management consultancy. You review news items about enterprise software vendors and decide whether each item describes a MATERIAL vendor event that a licensing customer must know about.

Material event types:
- MERGER_ACQUISITION: the vendor acquires, is acquired, merges, or divests a business
- LICENSING_MODEL: changes to how products are licensed (perpetual to subscription, metric changes, bundling, audit policy)
- PRICE_CHANGE: announced price increases/decreases or list-price restructuring
- PRODUCT_EOL: end of life, end of sale, or end of support for a product or version
- LEADERSHIP_STRATEGY: CEO/executive changes or announced strategy shifts that affect the product portfolio
- PARTNER_PROGRAM: reseller/partner program changes that affect how customers buy
- LEGAL_REGULATORY: lawsuits, antitrust, or regulatory actions involving the vendor
- OTHER: clearly material to licensing customers but fits no category above

Severity:
- "high": demands immediate customer attention (acquisition closing, forced license migration, imminent EOL, significant announced price increase)
- "normal": relevant but not urgent

STRICT GROUNDING RULES:
- Base every statement ONLY on the provided text. Never add facts, numbers, dates, or quotes that are not in the text.
- If the text does not state when the event occurred, set occurredAt to null. Never guess dates.
- Marketing content, product feature news, webinars, awards, and general tech commentary are NOT material: return material=false.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{"material": boolean, "type": string|null, "severity": "high"|"normal"|null, "summary": string|null, "occurredAt": "YYYY-MM-DD"|null}

When material=true: type, severity and summary are required; summary is 2-3 sentences grounded in the text.
When material=false: set type, severity, summary and occurredAt to null.`;

export interface ClassifyInput {
  vendorName: string;
  title: string;
  contentText: string;
  url: string;
}

function extractJson(text: string): unknown {
  // Tolerate accidental fences or prose around the object.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON object in response');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * classify-and-summarize prompt. Returns a validated Classification or throws
 * after one retry — callers flag the item for manual review on failure.
 */
export async function classifyItem(input: ClassifyInput): Promise<Classification> {
  const userContent = `Vendor: ${input.vendorName}
Source URL: ${input.url}
Title: ${input.title}

Text:
${input.contentText.slice(0, 12_000)}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await getClient().messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system: CLASSIFY_SYSTEM,
      messages: [
        { role: 'user', content: userContent },
        // Nudge strict JSON by prefilling the opening brace.
        { role: 'assistant', content: '{' },
      ],
    });
    const block = response.content.find((b) => b.type === 'text');
    const text = '{' + (block && block.type === 'text' ? block.text : '');
    try {
      return ClassificationSchema.parse(extractJson(text));
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Classification failed after retry: ${String(lastError)}`);
}

const PROFILE_SYSTEM = `You maintain vendor intelligence profiles for a Software Asset Management consultancy. You update a vendor's profile document from (a) the existing profile and (b) a list of recent approved events.

Output GitHub-flavored Markdown with EXACTLY this structure:

# <Vendor name>

## Positioning
A 1-2 sentence headline of where this vendor stands for licensing customers right now.

## Playbook & key moves
A bullet timeline (most recent first) of the vendor's key moves: "- YYYY-MM: what happened". Merge the existing timeline with the new events; keep entries concise.

## Product & licensing changes
Bullets describing concrete product/licensing changes customers must act on.

## Sources
A bullet list of source URLs referenced by the profile (deduplicated).

STRICT GROUNDING RULES:
- Use ONLY facts present in the existing profile or the provided events. Never invent facts, numbers, dates, or quotes.
- Keep every source URL from the events you use.
- If an event has no date, list it without a date rather than guessing.

Respond with ONLY the Markdown document, no commentary.`;

export interface ProfileEventInput {
  type: string;
  severity: string;
  title: string;
  summary: string;
  sourceUrl: string;
  occurredAt: string | null;
}

/** vendor-profile prompt: regenerate profileMarkdown from existing profile + approved events. */
export async function generateVendorProfile(
  vendorName: string,
  existingProfile: string,
  events: ProfileEventInput[],
): Promise<string> {
  const eventsBlock = events.length
    ? events
        .map(
          (e) =>
            `- [${e.type} | ${e.severity}${e.occurredAt ? ` | ${e.occurredAt}` : ''}] ${e.title}: ${e.summary} (source: ${e.sourceUrl})`,
        )
        .join('\n')
    : '(no new events)';

  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: 4096,
    system: PROFILE_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Vendor name: ${vendorName}

Existing profile:
${existingProfile || '(empty - create from the events alone)'}

Recent approved events:
${eventsBlock}`,
      },
    ],
  });
  const block = response.content.find((b) => b.type === 'text');
  const markdown = block && block.type === 'text' ? block.text.trim() : '';
  if (!markdown.startsWith('#')) {
    throw new Error('Profile generation returned unexpected output');
  }
  return markdown;
}
