import { afterEach, describe, expect, it, vi } from 'vitest';
import type Anthropic from '@anthropic-ai/sdk';
import { classifyItem, setAnthropicClient } from '@/services/claude';
import { ClassificationSchema } from '@/lib/domain';

function fakeClient(responses: string[]): Anthropic {
  let call = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        const text = responses[Math.min(call++, responses.length - 1)];
        // classifyItem prefills "{" as an assistant turn and prepends it back
        return { content: [{ type: 'text', text: text.replace(/^\{/, '') }] };
      }),
    },
  } as unknown as Anthropic;
}

const input = {
  vendorName: 'Broadcom (VMware)',
  title: 'Broadcom ends perpetual licenses',
  contentText: 'Broadcom announced that VMware products move to subscription only.',
  url: 'https://example.com/story',
};

const valid = JSON.stringify({
  material: true,
  type: 'LICENSING_MODEL',
  severity: 'high',
  summary: 'Broadcom moved VMware products to subscription-only licensing.',
  occurredAt: null,
});

afterEach(() => setAnthropicClient(undefined));

describe('classifyItem', () => {
  it('parses and validates a correct response', async () => {
    setAnthropicClient(fakeClient([valid]));
    const verdict = await classifyItem(input);
    expect(verdict.material).toBe(true);
    expect(verdict.type).toBe('LICENSING_MODEL');
    expect(verdict.severity).toBe('high');
  });

  it('retries once on malformed output, then succeeds', async () => {
    const client = fakeClient(['{ not json at all', valid]);
    setAnthropicClient(client);
    const verdict = await classifyItem(input);
    expect(verdict.material).toBe(true);
    expect((client.messages.create as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('throws after two failures so callers can flag for manual review', async () => {
    setAnthropicClient(fakeClient(['garbage', '{"material": "not-a-bool"}']));
    await expect(classifyItem(input)).rejects.toThrow(/Classification failed after retry/);
  });

  it('rejects out-of-enum event types via Zod', () => {
    const bad = { material: true, type: 'GOSSIP', severity: 'high', summary: 's', occurredAt: null };
    expect(() => ClassificationSchema.parse(bad)).toThrow();
  });

  it('rejects non-ISO occurredAt via Zod', () => {
    const bad = {
      material: true,
      type: 'PRICE_CHANGE',
      severity: 'normal',
      summary: 's',
      occurredAt: 'next Tuesday',
    };
    expect(() => ClassificationSchema.parse(bad)).toThrow();
  });
});
