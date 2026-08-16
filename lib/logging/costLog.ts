import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * One row of the local API cost log — one entry per Claude API call, so the
 * per-run and cumulative cost of comp retrieval (and later, card
 * identification) is visible without going to the Anthropic console.
 * Append-only, same spirit as the `Sale` table: never edited, only added to.
 */
export interface ApiUsageLogEntry {
  timestamp: string;
  /** Short label for what the call was for, e.g. "AgentSource.fetchSales". */
  purpose: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  /** Count of server-tool invocations (e.g. web searches) this call made, when known. */
  webSearchRequests?: number;
  stopReason?: string | null;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'usage.jsonl');

/**
 * Append one usage entry as a JSON line. Never throws — a logging failure
 * must not break the retrieval it's trying to record — but it also never
 * swallows silently: failures are logged to stderr so they're visible.
 */
export function logApiUsage(entry: ApiUsageLogEntry): void {
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch (err: unknown) {
    console.error('[costLog] Failed to write usage log entry:', err, entry);
  }
}
