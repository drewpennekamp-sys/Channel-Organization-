import type { InsightDTO } from './types';

export interface AnalysisResult {
  summary: string;
  recommendations: string[];
}

interface InsightRow {
  id: string;
  channelId: string;
  date: Date;
  summary: string;
  recommendations: string;
  source: 'claude' | 'manual';
  createdAt: Date;
}

export function toInsightDTO(row: InsightRow): InsightDTO {
  let recommendations: string[] = [];
  try {
    const parsed = JSON.parse(row.recommendations);
    if (Array.isArray(parsed)) recommendations = parsed.filter((r): r is string => typeof r === 'string');
  } catch {
    recommendations = [];
  }

  return {
    id: row.id,
    channelId: row.channelId,
    date: row.date.toISOString(),
    summary: row.summary,
    recommendations,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Claude is instructed to return bare JSON, but models sometimes wrap it in
 * markdown fences or add a stray sentence before/after. Try, in order: a
 * fenced code block, then the outermost {...} span, then the raw text.
 */
function extractJsonCandidate(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1).trim();
  }

  return raw.trim();
}

export function parseAnalysisResponse(raw: string): AnalysisResult {
  const candidate = extractJsonCandidate(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    throw new Error('Could not parse the analysis response as JSON.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('The analysis response was not a JSON object.');
  }

  const { summary, recommendations } = parsed as Record<string, unknown>;

  if (typeof summary !== 'string' || !summary.trim()) {
    throw new Error('The analysis response was missing a summary.');
  }
  if (!Array.isArray(recommendations) || !recommendations.every((r) => typeof r === 'string')) {
    throw new Error('The analysis response was missing recommendations.');
  }

  const cleanRecommendations = recommendations.map((r) => r.trim()).filter(Boolean);
  if (cleanRecommendations.length === 0) {
    throw new Error('The analysis response had no usable recommendations.');
  }

  return { summary: summary.trim(), recommendations: cleanRecommendations };
}
