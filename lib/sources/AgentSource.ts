import Anthropic from '@anthropic-ai/sdk';
import type { Card } from '@prisma/client';
import { z } from 'zod';
import { logApiUsage } from '@/lib/logging/costLog';
import { extractJsonPayload } from '@/lib/parsing/extractJson';
import type { PriceSource, RawSale } from './types';

/**
 * Claude API + the web search server tool. This is the only retrieval
 * implementation right now — never scrapes a marketplace directly, only
 * ever asks Claude to search and report back what it found.
 *
 * Core rule this whole module exists to enforce: the model retrieves
 * individual sales; it never estimates a value. Every code path below
 * either returns real, sourced rows or an empty array — never a guess.
 */

const MODEL = 'claude-sonnet-5';

// Verbatim per the build spec — do not edit without re-reading the spec's
// "AgentSource system prompt" section.
const SYSTEM_PROMPT = `You are a sports card comp researcher. Search the web for
recent SOLD listings of the card described in the user
message.

Return ONLY valid JSON matching the schema below. No
markdown, no code fences, no explanation before or after.

Hard rules:
- Include only listings you confirmed as SOLD/completed.
  Never include active or "available" listings.
- Card attributes must match EXACTLY. A PSA 10 is not a
  comp for a raw card. A numbered parallel is not a comp
  for a base card. An auto is not a comp for a non-auto.
- Every sale requires a sourceUrl you actually retrieved.
  Do not construct or guess URLs.
- Prices are the final sale price in USD, excluding
  shipping. If shipping is bundled and inseparable, note
  it in the notes field.
- If you find fewer than 3 confirmed sales, return what
  you found and set sufficient to false. NEVER estimate,
  interpolate, or invent a price to fill a gap.
- If you find zero confirmed sales, return an empty sales
  array. That is a valid and useful answer.

Schema:
{
  "sales": [
    {
      "date": "YYYY-MM-DD",
      "price": 0.00,
      "title": "exact listing title",
      "grade": "RAW | PSA 10 | BGS 9.5 | SGC 9 | etc",
      "marketplace": "eBay | Goldin | PWCC | Fanatics Collect | other",
      "url": "https://..."
    }
  ],
  "sufficient": true,
  "notes": ""
}`;

// Defensive schema for the model's JSON response. Permissive on fields the
// prompt doesn't strictly require (e.g. a per-sale "notes") since Claude
// may include them; strict enough to catch a malformed response.
const AgentSaleSchema = z.object({
  date: z.string(),
  price: z.number(),
  title: z.string(),
  grade: z.string(),
  marketplace: z.string(),
  // Deliberately not z.string().url() here — a sale missing/malforming its
  // URL should be dropped by fetchSales, not fail the whole parse.
  url: z.string().optional(),
  notes: z.string().optional(),
});

const AgentResponseSchema = z.object({
  sales: z.array(AgentSaleSchema),
  sufficient: z.boolean(),
  notes: z.string().optional(),
});

type AgentResponse = z.infer<typeof AgentResponseSchema>;

function describeCard(card: Card): string {
  const parts: string[] = [`${card.year} ${card.brand} ${card.set}`];
  if (card.subset) parts.push(card.subset);
  parts.push(`— ${card.player}, card #${card.cardNumber}`);
  if (card.parallel) parts.push(`${card.parallel} parallel`);
  if (card.serialNumbering) parts.push(`numbered ${card.serialNumbering}`);
  if (card.isAuto) parts.push('autograph');
  if (card.isRelic) parts.push('relic/patch');
  parts.push(`(${card.sport})`);
  return parts.join(', ');
}

function buildUserMessage(card: Card, grade: string): string {
  return [
    `Card: ${describeCard(card)}`,
    `Grade to match exactly: ${grade}`,
    '',
    'Find sold comps for exactly this card and grade.',
  ].join('\n');
}

/**
 * Defensive parse of the model's raw text output: extract the JSON payload
 * (handling a fence, and a preamble/postamble around it — see
 * extractJsonPayload), JSON.parse, validate shape. Logs and returns null on
 * any failure rather than throwing — the caller treats null the same as
 * "no sales found".
 */
function parseAgentResponse(raw: string): AgentResponse | null {
  const stripped = extractJsonPayload(raw);

  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err: unknown) {
    console.error('[AgentSource] Failed to JSON.parse model response:', err);
    console.error('[AgentSource] Raw response was:', raw);
    return null;
  }

  const result = AgentResponseSchema.safeParse(json);
  if (!result.success) {
    console.error('[AgentSource] Model response did not match expected schema:', result.error.issues);
    console.error('[AgentSource] Raw response was:', raw);
    return null;
  }

  return result.data;
}

/**
 * Pure function covering everything from "raw model text" to "RawSale[]
 * safe to persist": fence-stripping, JSON parsing, schema validation, and
 * dropping any sale without a sourceUrl. Exported (and unit tested)
 * separately from `fetchSales` so this logic is verifiable without a live
 * API call.
 */
export function extractSalesFromResponseText(raw: string): RawSale[] {
  const parsed = parseAgentResponse(raw);
  if (!parsed) {
    return [];
  }

  const withUrl: RawSale[] = [];
  for (const sale of parsed.sales) {
    if (!sale.url || sale.url.trim() === '') {
      console.error('[AgentSource] Dropping sale without a sourceUrl:', sale);
      continue;
    }
    withUrl.push({
      date: sale.date,
      price: sale.price,
      title: sale.title,
      grade: sale.grade,
      marketplace: sale.marketplace,
      url: sale.url,
      notes: sale.notes,
    });
  }
  return withUrl;
}

export class AgentSource implements PriceSource {
  readonly name = 'agent';

  private readonly client: Anthropic;

  constructor(client?: Anthropic) {
    // Anthropic() reads ANTHROPIC_API_KEY from the environment by default —
    // never hardcode it. Constructor param exists for tests to inject a
    // mock client.
    this.client = client ?? new Anthropic();
  }

  async fetchSales(card: Card, grade: string): Promise<RawSale[]> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { effort: 'medium' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        messages: [{ role: 'user', content: buildUserMessage(card, grade) }],
      });
    } catch (err: unknown) {
      console.error('[AgentSource] Anthropic API call failed:', err);
      return [];
    }

    logApiUsage({
      timestamp: new Date().toISOString(),
      purpose: 'AgentSource.fetchSales',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? undefined,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? undefined,
      webSearchRequests: response.usage.server_tool_use?.web_search_requests,
      stopReason: response.stop_reason,
    });

    if (response.stop_reason === 'refusal') {
      console.error('[AgentSource] Request refused by safety classifiers:', response.stop_details);
      return [];
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!text.trim()) {
      console.error('[AgentSource] Model returned no text content. stop_reason:', response.stop_reason);
      return [];
    }

    return extractSalesFromResponseText(text);
  }
}
