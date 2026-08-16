import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logApiUsage } from '@/lib/logging/costLog';
import { logScanPass } from '@/lib/logging/scanLog';
import { extractJsonPayload } from '@/lib/parsing/extractJson';
import { loadPrompt } from '@/lib/scanner/loadPrompt';
import type { CardImage } from '@/lib/scanner/types';

/**
 * Pass 1 — read the identifiers off the card BACK. Near-deterministic OCR,
 * not recognition: every field is either what's literally printed, or
 * null. See prompts/backRead.txt for the full field-by-field rules.
 */

const MODEL = 'claude-sonnet-5';

const BackReadSchema = z.object({
  cardNumber: z.string().nullable(),
  copyrightYear: z.number().int().nullable(),
  brandLine: z.string().nullable(),
  setName: z.string().nullable(),
  serialNumbering: z.string().nullable(),
  player: z.string().nullable(),
  sport: z.string().nullable(),
});

export type BackReadResult = z.infer<typeof BackReadSchema>;

function parseBackRead(raw: string): BackReadResult | null {
  const stripped = extractJsonPayload(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err: unknown) {
    console.error('[backRead] Failed to JSON.parse model response:', err);
    console.error('[backRead] Raw response was:', raw);
    return null;
  }
  const result = BackReadSchema.safeParse(json);
  if (!result.success) {
    console.error('[backRead] Model response did not match expected schema:', result.error.issues);
    console.error('[backRead] Raw response was:', raw);
    return null;
  }
  return result.data;
}

export async function readBack(back: CardImage, client: Anthropic = new Anthropic()): Promise<BackReadResult | null> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1536,
      system: loadPrompt('backRead.txt'),
      output_config: { effort: 'high' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: back.mediaType, data: back.base64 } },
            { type: 'text', text: 'This is the card back. Read the identifiers per the schema.' },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    console.error('[backRead] Anthropic API call failed:', err);
    return null;
  }

  logApiUsage({
    timestamp: new Date().toISOString(),
    purpose: 'scanner.backRead',
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
    stopReason: response.stop_reason,
  });

  if (response.stop_reason === 'refusal') {
    console.error('[backRead] Request refused by safety classifiers:', response.stop_details);
    return null;
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text.trim()) {
    console.error('[backRead] Model returned no text content. stop_reason:', response.stop_reason);
    return null;
  }

  const parsed = parseBackRead(text);
  logScanPass({ timestamp: new Date().toISOString(), pass: 'backRead', rawResponseText: text, parsed });
  return parsed;
}
