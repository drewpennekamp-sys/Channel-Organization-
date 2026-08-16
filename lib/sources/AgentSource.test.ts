import { describe, expect, it, vi } from 'vitest';
import { extractSalesFromResponseText } from './AgentSource';

describe('extractSalesFromResponseText', () => {
  it('parses a clean JSON response with no fences', () => {
    const raw = JSON.stringify({
      sales: [
        {
          date: '2026-06-01',
          price: 45,
          title: '2025 Topps Chrome McDonald\'s AA Brayden Burries Auto EA-BB',
          grade: 'RAW',
          marketplace: 'eBay',
          url: 'https://ebay.com/itm/123',
        },
      ],
      sufficient: false,
    });

    const sales = extractSalesFromResponseText(raw);

    expect(sales).toHaveLength(1);
    expect(sales[0].url).toBe('https://ebay.com/itm/123');
    expect(sales[0].price).toBe(45);
  });

  it('strips ```json fences before parsing', () => {
    const payload = { sales: [], sufficient: false };
    const raw = '```json\n' + JSON.stringify(payload) + '\n```';

    const sales = extractSalesFromResponseText(raw);

    expect(sales).toEqual([]);
  });

  it('strips bare ``` fences (no "json" hint)', () => {
    const payload = { sales: [], sufficient: false };
    const raw = '```\n' + JSON.stringify(payload) + '\n```';

    expect(extractSalesFromResponseText(raw)).toEqual([]);
  });

  it('returns [] and logs, without throwing, on malformed JSON', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sales = extractSalesFromResponseText('this is not { json at all');

    expect(sales).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('returns [] and logs on JSON that does not match the expected schema', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const sales = extractSalesFromResponseText(JSON.stringify({ foo: 'bar' }));

    expect(sales).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('drops a sale missing sourceUrl but keeps the rest', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = JSON.stringify({
      sales: [
        { date: '2026-06-01', price: 45, title: 'Sale with URL', grade: 'RAW', marketplace: 'eBay', url: 'https://ebay.com/itm/1' },
        { date: '2026-06-02', price: 50, title: 'Sale without URL', grade: 'RAW', marketplace: 'eBay' },
      ],
      sufficient: false,
    });

    const sales = extractSalesFromResponseText(raw);

    expect(sales).toHaveLength(1);
    expect(sales[0].title).toBe('Sale with URL');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('drops a sale with an empty-string sourceUrl', () => {
    const raw = JSON.stringify({
      sales: [{ date: '2026-06-01', price: 45, title: 'Bad URL', grade: 'RAW', marketplace: 'eBay', url: '   ' }],
      sufficient: false,
    });

    expect(extractSalesFromResponseText(raw)).toEqual([]);
  });

  it('returns an empty array for a genuinely empty sales array (zero comps is a valid answer)', () => {
    const raw = JSON.stringify({ sales: [], sufficient: false, notes: 'No confirmed sold listings found.' });

    expect(extractSalesFromResponseText(raw)).toEqual([]);
  });

  it('carries per-sale notes through when present', () => {
    const raw = JSON.stringify({
      sales: [
        {
          date: '2026-06-01',
          price: 45,
          title: 'Bundled shipping',
          grade: 'RAW',
          marketplace: 'eBay',
          url: 'https://ebay.com/itm/1',
          notes: 'Price includes bundled shipping',
        },
      ],
      sufficient: false,
    });

    const sales = extractSalesFromResponseText(raw);

    expect(sales[0].notes).toBe('Price includes bundled shipping');
  });
});
