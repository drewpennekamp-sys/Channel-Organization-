import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logApiUsage } from '@/lib/logging/costLog';
import { extractJsonPayload } from '@/lib/parsing/extractJson';

/**
 * Card identification from photos via Claude vision. Same defensive shape
 * as AgentSource: strip fences, JSON.parse in a try/catch, validate with
 * zod, log and return null on any failure — never throw, never guess.
 *
 * This function only extracts attributes. It never touches the database —
 * the caller (the /api/scan route) returns the result to the client, and
 * nothing is saved until the user confirms/corrects it in the UI and hits
 * Save (POST /api/cards).
 */

const MODEL = 'claude-sonnet-5';

const SYSTEM_PROMPT = `You are a sports card identification assistant. You
are given a photo of the front of a card, and optionally a second photo of
the back.

Return ONLY valid JSON matching the schema below. No markdown, no code
fences, no explanation before or after.

Guidance:
- The card back usually carries the card number and copyright year — use
  it when available, and prefer it over a guess from the front.
- Parallel/refractor type (e.g. "Silver Prizm", "Gold Refractor", "Base")
  is a front-side visual determination.
- If the card is in a graded slab (PSA/BGS/SGC/etc.), read the cert number
  and grade directly off the label rather than guessing the card's raw
  condition.
- isAuto and isRelic should reflect what's visible on the card itself (an
  autograph panel/signature, a jersey/relic window) — do not infer them
  from the set name alone.
- If you are not confident about a field, set it to null rather than
  guessing. Set "confidence" to "low" whenever multiple fields are
  uncertain or the photo is blurry/cropped/glare-heavy, "medium" when most
  fields are clear but one or two are uncertain, and "high" only when
  every field is clearly legible.

Schema:
{
  "year": 0,
  "brand": "",
  "set": "",
  "subset": null,
  "player": "",
  "cardNumber": "",
  "parallel": null,
  "serialNumbering": null,
  "isAuto": false,
  "isRelic": false,
  "sport": "",
  "grade": "RAW | PSA 10 | BGS 9.5 | SGC 9 | etc",
  "certNumber": null,
  "confidence": "high | medium | low"
}

Any field you are not confident about must be null (or, for isAuto/isRelic,
your best visual determination — never null those two) rather than a
guess.`;

const CardAttributesSchema = z.object({
  year: z.number().int().nullable(),
  brand: z.string().nullable(),
  set: z.string().nullable(),
  subset: z.string().nullable(),
  player: z.string().nullable(),
  cardNumber: z.string().nullable(),
  parallel: z.string().nullable(),
  serialNumbering: z.string().nullable(),
  isAuto: z.boolean().nullable(),
  isRelic: z.boolean().nullable(),
  sport: z.string().nullable(),
  grade: z.string().nullable(),
  certNumber: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type CardAttributes = z.infer<typeof CardAttributesSchema>;

export type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export interface CardImage {
  base64: string;
  mediaType: SupportedImageMediaType;
}

function parseCardAttributes(raw: string): CardAttributes | null {
  const stripped = extractJsonPayload(raw);

  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err: unknown) {
    console.error('[identifyCard] Failed to JSON.parse model response:', err);
    console.error('[identifyCard] Raw response was:', raw);
    return null;
  }

  const result = CardAttributesSchema.safeParse(json);
  if (!result.success) {
    console.error('[identifyCard] Model response did not match expected schema:', result.error.issues);
    console.error('[identifyCard] Raw response was:', raw);
    return null;
  }

  return result.data;
}

export async function identifyCard(
  front: CardImage,
  back: CardImage | undefined,
  client: Anthropic = new Anthropic(),
): Promise<CardAttributes | null> {
  const content: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: front.mediaType, data: front.base64 } },
  ];
  if (back) {
    content.push({ type: 'image', source: { type: 'base64', media_type: back.mediaType, data: back.base64 } });
  }
  content.push({
    type: 'text',
    text: back
      ? 'First image is the card front, second image is the card back. Identify this card.'
      : 'This is the card front only (no back image was provided). Identify what you can from it.',
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'medium' },
      messages: [{ role: 'user', content }],
    });
  } catch (err: unknown) {
    console.error('[identifyCard] Anthropic API call failed:', err);
    return null;
  }

  logApiUsage({
    timestamp: new Date().toISOString(),
    purpose: 'identifyCard',
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
    stopReason: response.stop_reason,
  });

  if (response.stop_reason === 'refusal') {
    console.error('[identifyCard] Request refused by safety classifiers:', response.stop_details);
    return null;
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text.trim()) {
    console.error('[identifyCard] Model returned no text content. stop_reason:', response.stop_reason);
    return null;
  }

  return parseCardAttributes(text);
}
