import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logApiUsage } from '@/lib/logging/costLog';
import { logScanPass } from '@/lib/logging/scanLog';
import { extractJsonPayload } from '@/lib/parsing/extractJson';
import { loadPrompt } from '@/lib/scanner/loadPrompt';
import type { CardImage } from '@/lib/scanner/types';

/**
 * Pass 0 — slab short-circuit. A cert number is an exact database key, so
 * this path should be near-perfect and it covers a large share of
 * high-value cards; check for it before running anything else.
 */

const MODEL = 'claude-sonnet-5';

const SlabCheckSchema = z.object({
  isSlab: z.boolean(),
  gradingCompany: z.enum(['PSA', 'BGS', 'SGC', 'CGC']).nullable(),
  certNumber: z.string().nullable(),
  grade: z.string().nullable(),
});

export type SlabCheckResult = z.infer<typeof SlabCheckSchema>;

function parseSlabCheck(raw: string): SlabCheckResult | null {
  const stripped = extractJsonPayload(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err: unknown) {
    console.error('[slabCheck] Failed to JSON.parse model response:', err);
    console.error('[slabCheck] Raw response was:', raw);
    return null;
  }
  const result = SlabCheckSchema.safeParse(json);
  if (!result.success) {
    console.error('[slabCheck] Model response did not match expected schema:', result.error.issues);
    console.error('[slabCheck] Raw response was:', raw);
    return null;
  }
  return result.data;
}

/** Runs against whichever image is available — a slab's label can be on either side captured. */
export async function checkSlab(
  image: CardImage,
  client: Anthropic = new Anthropic(),
): Promise<SlabCheckResult | null> {
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: loadPrompt('slabCheck.txt'),
      output_config: { effort: 'medium' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
            { type: 'text', text: 'Is this card in a graded slab? Follow the schema.' },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    console.error('[slabCheck] Anthropic API call failed:', err);
    return null;
  }

  logApiUsage({
    timestamp: new Date().toISOString(),
    purpose: 'scanner.slabCheck',
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
    stopReason: response.stop_reason,
  });

  if (response.stop_reason === 'refusal') {
    console.error('[slabCheck] Request refused by safety classifiers:', response.stop_details);
    return null;
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text.trim()) {
    console.error('[slabCheck] Model returned no text content. stop_reason:', response.stop_reason);
    return null;
  }

  const parsed = parseSlabCheck(text);
  logScanPass({ timestamp: new Date().toISOString(), pass: 'slabCheck', rawResponseText: text, parsed });
  return parsed;
}
