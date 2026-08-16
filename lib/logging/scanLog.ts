import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * "Log every scan's raw model output alongside the parsed result." —
 * append-only, same shape as costLog.ts. When a field comes out wrong,
 * this is how to tell whether the model misread the card or the parser
 * mangled a correct read.
 */
export interface ScanLogEntry {
  timestamp: string;
  pass: 'slabCheck' | 'backRead' | 'parallelRead';
  rawResponseText: string;
  parsed: unknown;
}

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'scans.jsonl');

export function logScanPass(entry: ScanLogEntry): void {
  try {
    if (!existsSync(LOG_DIR)) {
      mkdirSync(LOG_DIR, { recursive: true });
    }
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
  } catch (err: unknown) {
    console.error('[scanLog] Failed to write scan log entry:', err, entry.pass);
  }
}
