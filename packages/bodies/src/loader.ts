import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BodyTemplateSchema, type BodyTemplate } from "@livery-lab/schema";
import { validateBodyTemplateSemantics, formatBodyValidationIssues } from "./validate.js";

export class BodyTemplateError extends Error {}

/**
 * Parse + structurally validate a BTF document from an already-parsed
 * JSON value (no filesystem access — useful for tests and API routes).
 * Does NOT run semantic cross-reference checks; use `loadBodyTemplate`
 * for that, or call `validateBodyTemplateSemantics` yourself.
 */
export function parseBodyTemplate(json: unknown): BodyTemplate {
  const result = BodyTemplateSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new BodyTemplateError(`Invalid BTF document:\n${issues}`);
  }
  return result.data;
}

/**
 * Parse + fully validate (structural + semantic) a BTF document. This is
 * what every real loader should call — a BTF that passes zod but has a
 * `mirrorOf` pointing nowhere is still broken.
 */
export function loadBodyTemplate(json: unknown): BodyTemplate {
  const body = parseBodyTemplate(json);
  const issues = validateBodyTemplateSemantics(body);
  if (issues.length > 0) {
    throw new BodyTemplateError(
      `BTF "${body.id}" failed semantic validation:\n${formatBodyValidationIssues(issues)}`,
    );
  }
  return body;
}

/** Load and validate a single BTF JSON file from disk. */
export function loadBodyTemplateFromFile(filePath: string): BodyTemplate {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new BodyTemplateError(`Could not read BTF file "${filePath}": ${(err as Error).message}`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new BodyTemplateError(`BTF file "${filePath}" is not valid JSON: ${(err as Error).message}`);
  }
  try {
    return loadBodyTemplate(json);
  } catch (err) {
    if (err instanceof BodyTemplateError) {
      throw new BodyTemplateError(`${filePath}:\n${err.message}`);
    }
    throw err;
  }
}

/** Load and validate every `*.btf.json` file in a directory (non-recursive). */
export function loadBodyTemplatesFromDir(dir: string): BodyTemplate[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".btf.json"));
  return files.map((f) => loadBodyTemplateFromFile(join(dir, f)));
}
