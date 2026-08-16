import { describe, expect, it } from 'vitest';
import { extractJsonPayload } from './extractJson';

describe('extractJsonPayload', () => {
  it('returns clean JSON unchanged (the common case)', () => {
    const raw = '{"a": 1}';
    expect(extractJsonPayload(raw)).toBe('{"a": 1}');
  });

  it('extracts a ```json ... ``` fence that spans the whole response', () => {
    const raw = '```json\n{"a": 1}\n```';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it('extracts a bare ``` fence (no "json" hint)', () => {
    const raw = '```\n{"a": 1}\n```';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it('extracts a fenced block even when the model adds a preamble sentence first', () => {
    // This is a real response Claude produced against a live thin-market
    // card: it explained itself in prose *before* the fence, despite the
    // system prompt saying not to. The original implementation anchored
    // the fence regex to the start/end of the string and failed on this.
    const raw = [
      'Based on my searches, I was unable to find any confirmed sold listings for this specific card.',
      '',
      '```json',
      '{',
      '  "sales": [],',
      '  "sufficient": false,',
      '  "notes": "No confirmed sold listings were found."',
      '}',
      '```',
    ].join('\n');

    const parsed = JSON.parse(extractJsonPayload(raw));
    expect(parsed).toEqual({ sales: [], sufficient: false, notes: 'No confirmed sold listings were found.' });
  });

  it('extracts a fenced block even when the model adds trailing prose after it', () => {
    const raw = '```json\n{"a": 1}\n```\n\nLet me know if you need anything else!';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it('falls back to the outermost braces when there is no fence at all', () => {
    const raw = 'Here is the result: {"a": 1} — hope that helps!';
    expect(JSON.parse(extractJsonPayload(raw))).toEqual({ a: 1 });
  });

  it('returns the trimmed input unchanged when nothing JSON-like is found', () => {
    expect(extractJsonPayload('not json at all')).toBe('not json at all');
  });
});
