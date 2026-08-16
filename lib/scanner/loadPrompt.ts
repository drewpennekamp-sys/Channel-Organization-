import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Prompts live as plain text files under prompts/, not inline string
 * literals — they get iterated on constantly and need to be diffable in
 * git history independent of the TypeScript around them.
 */
const PROMPTS_DIR = path.join(process.cwd(), 'prompts');

export function loadPrompt(filename: string, substitutions: Record<string, string> = {}): string {
  let text = readFileSync(path.join(PROMPTS_DIR, filename), 'utf-8');
  for (const [key, value] of Object.entries(substitutions)) {
    text = text.split(`{{${key}}}`).join(value);
  }
  return text;
}
