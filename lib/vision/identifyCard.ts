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

Work in two passes before you answer:
1. Transcribe literally. Read every piece of printed text you can actually
   see — set wordmark/logo, player name, card number (with its exact
   prefix/format, e.g. "US-12", "CDA-7", "43"), any copyright line, any
   parallel/insert name printed on the card, and — if graded — every line
   of the grading label. Do this character by character; card numbers and
   years are the single most common transcription error, and a confident
   wrong digit is worse than a null.
2. Map that transcription onto the schema fields. Only fill a field from
   what you actually transcribed or can clearly infer from it (e.g. sport
   from the uniform/equipment shown) — never from what a similar-looking
   card "usually" has.

Field-specific guidance:
- Year: cards often show two years — the season/set year in the product
  name (e.g. "2024-25") and a copyright year printed small on the back
  (e.g. "© 2024"). Use the copyright year when the back is available; it's
  more reliable than parsing a season range. Fall back to the front's
  printed year only when there's no back photo.
- Card number: prefer the back — it's usually printed there in a
  consistent, uncluttered spot, whereas the front's number can be small,
  rotated, or overlapping the design. If front and back disagree, use the
  back's value.
- Parallel: read the name directly if it's printed on the card (a small
  foil stamp or wordmark, e.g. "Silver", "Gold /10", "Wave"). If nothing
  is printed but the card clearly has a distinct color/foil/texture versus
  a plain base card, describe what you see (e.g. "blue refractor") rather
  than leaving it null — but if you cannot tell whether it's a parallel at
  all, null is correct.
- isAuto: true only for a genuine on-card or sticker autograph — look for
  actual ink, an authentication hologram, or "AUTOGRAPH"/"AUTO" text tied
  to a visible signature. A printed facsimile signature that's part of the
  card's base design (common on many veteran/legend cards) is NOT an
  autograph — leave isAuto false for those.
- isRelic: true only if there's a visible swatch of material (jersey,
  patch, bat, etc.) embedded in the card.
- Grading slab: if the card is in a PSA/BGS/SGC/etc. slab, the grade and
  cert number come from the label text, not from judging the raw card's
  condition. Transcribe the cert number digit by digit — it's the
  single most error-prone field on a slab.
- If you are not confident about a field, set it to null rather than
  guessing. Set "confidence" to "low" whenever multiple fields are
  uncertain, the photo is blurry/cropped/glare-heavy, or only the front
  was provided and it lacks the card number; "medium" when most fields are
  clear but one or two are uncertain; "high" only when every field you
  filled in was clearly, unambiguously legible.

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
      : 'This is the card front only (no back image was provided). Identify what you can from it — ' +
        'card number and year are less reliable without the back, so lean toward null/lower confidence ' +
        'on those two fields rather than guessing.',
  });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      // Generous headroom: adaptive thinking is on by default for this
      // model, and a careful transcribe-then-map read benefits from room
      // to reason before answering, especially with two images.
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'high' },
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
