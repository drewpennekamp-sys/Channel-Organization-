import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { logApiUsage } from '@/lib/logging/costLog';
import { logScanPass } from '@/lib/logging/scanLog';
import { extractJsonPayload } from '@/lib/parsing/extractJson';
import { loadPrompt } from '@/lib/scanner/loadPrompt';
import type { CardImage } from '@/lib/scanner/types';
import type { CatalogCardWithParallels } from '@/lib/scanner/catalogResolve';

/**
 * Pass 3 — the hard one. Closed-list selection is dramatically more
 * accurate than open generation, so the model is never allowed to
 * free-form a parallel name: it picks from the resolved card's known
 * parallels or says "uncertain". The result is validated against that
 * same list again in code before it's trusted — a model that returns
 * something off-list is treated exactly like "uncertain".
 */

const MODEL = 'claude-sonnet-5';

const ParallelReadSchema = z.object({
  parallel: z.string(),
  candidates: z.array(z.string()).default([]),
  observedPrintRun: z.number().int().nullable().default(null),
  reasoning: z.string().default(''),
});

export interface ParallelReadResult {
  /** Always a name from the catalog's parallel list, or "uncertain" — never a raw model string. */
  parallel: string;
  candidates: string[];
  observedPrintRun: number | null;
  reasoning: string;
}

function formatCardSummary(card: CatalogCardWithParallels): string {
  return `${card.year} ${card.brand} ${card.set}${card.subset ? ' ' + card.subset : ''} #${card.cardNumber} ${card.player}`;
}

function formatParallelList(parallels: CatalogCardWithParallels['parallels']): string {
  return parallels
    .map((p) => {
      const suffix = p.oneOfOne ? ' 1/1' : p.printRun ? ` /${p.printRun}` : '';
      return `  ${p.name}${suffix}`;
    })
    .join('\n');
}

function parseParallelRead(raw: string): z.infer<typeof ParallelReadSchema> | null {
  const stripped = extractJsonPayload(raw);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err: unknown) {
    console.error('[parallelRead] Failed to JSON.parse model response:', err);
    console.error('[parallelRead] Raw response was:', raw);
    return null;
  }
  const result = ParallelReadSchema.safeParse(json);
  if (!result.success) {
    console.error('[parallelRead] Model response did not match expected schema:', result.error.issues);
    console.error('[parallelRead] Raw response was:', raw);
    return null;
  }
  return result.data;
}

export async function readParallel(
  front: CardImage,
  back: CardImage | undefined,
  catalogCard: CatalogCardWithParallels,
  client: Anthropic = new Anthropic(),
): Promise<ParallelReadResult | null> {
  const system = loadPrompt('parallelRead.txt', {
    CARD_SUMMARY: formatCardSummary(catalogCard),
    PARALLEL_LIST: formatParallelList(catalogCard.parallels),
  });

  const content: Anthropic.ContentBlockParam[] = [
    { type: 'image', source: { type: 'base64', media_type: front.mediaType, data: front.base64 } },
  ];
  if (back) {
    content.push({ type: 'image', source: { type: 'base64', media_type: back.mediaType, data: back.base64 } });
  }
  content.push({ type: 'text', text: 'Identify the parallel per the schema.' });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      output_config: { effort: 'high' },
      messages: [{ role: 'user', content }],
    });
  } catch (err: unknown) {
    console.error('[parallelRead] Anthropic API call failed:', err);
    return null;
  }

  logApiUsage({
    timestamp: new Date().toISOString(),
    purpose: 'scanner.parallelRead',
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
    stopReason: response.stop_reason,
  });

  if (response.stop_reason === 'refusal') {
    console.error('[parallelRead] Request refused by safety classifiers:', response.stop_details);
    return null;
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

  if (!text.trim()) {
    console.error('[parallelRead] Model returned no text content. stop_reason:', response.stop_reason);
    return null;
  }

  const parsed = parseParallelRead(text);
  logScanPass({ timestamp: new Date().toISOString(), pass: 'parallelRead', rawResponseText: text, parsed });
  if (!parsed) return null;

  // Enforce the closed list even though the prompt already asks for it —
  // a model that free-forms or slightly rewords a name is treated exactly
  // like "uncertain" rather than trusted.
  const knownNames = new Set(catalogCard.parallels.map((p) => p.name));
  if (parsed.parallel !== 'uncertain' && !knownNames.has(parsed.parallel)) {
    console.warn(
      `[parallelRead] Model returned "${parsed.parallel}", which is not on the catalog list for ${catalogCard.id} — downgrading to uncertain.`,
    );
    return { ...parsed, parallel: 'uncertain', candidates: parsed.candidates.filter((c) => knownNames.has(c)) };
  }

  return parsed;
}
