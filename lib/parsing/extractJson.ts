/**
 * Pulls a JSON payload out of raw model text, defensively. System prompts
 * that say "return ONLY valid JSON, no preamble" are followed most of the
 * time but not always — a model can still add a sentence like "Based on my
 * searches, I found no results." before a fenced block. Tries, in order:
 *
 *   1. The whole trimmed string, as-is (the common case: clean JSON).
 *   2. A fenced ``` or ```json block found ANYWHERE in the text — not
 *      anchored to the start/end, so a preamble or trailing sentence
 *      around the fence doesn't break extraction.
 *   3. The substring between the first `{` and the last `}` — covers bare
 *      JSON (no fence) with stray prose around it.
 *
 * Returns the best-guess JSON substring; it is NOT guaranteed to be valid
 * JSON — callers still JSON.parse it in a try/catch.
 */
export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}
