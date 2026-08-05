// tests/amount-parser.test.ts
// Tests for the currency/amount parsing utilities used across scrapers

import { GemParser } from '../src/scrapers/gem/parser';

// Helper that lets us test the private parseAmount logic through the parser
function parseAmount(html: string): number | undefined {
  const parser = new GemParser(html, 'https://example.com');
  const result = parser.parse();
  return result.estimatedValue;
}

describe('Amount Parser', () => {
  test('parses crore values', () => {
    const html = `<html><body>
      <span class="bid-value">₹2,50,00,000</span>
      <span class="bid-no">TEST/001</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBe(25000000);
  });

  test('parses lakh values', () => {
    const html = `<html><body>
      <span class="bid-value">₹45,00,000</span>
      <span class="bid-no">TEST/002</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBe(4500000);
  });

  test('parses values with decimal', () => {
    const html = `<html><body>
      <span class="bid-value">1,23,456.50</span>
      <span class="bid-no">TEST/003</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBe(123456.5);
  });

  test('parses plain numeric value', () => {
    const html = `<html><body>
      <span class="bid-value">500000</span>
      <span class="bid-no">TEST/004</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBe(500000);
  });

  test('returns undefined for empty value', () => {
    const html = `<html><body>
      <span class="bid-value"></span>
      <span class="bid-no">TEST/005</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBeUndefined();
  });

  test('ignores non-numeric text', () => {
    const html = `<html><body>
      <span class="bid-value">NA</span>
      <span class="bid-no">TEST/006</span>
      <h1 class="bid-title">Test Tender</h1>
    </body></html>`;
    expect(parseAmount(html)).toBeUndefined();
  });
});

describe('Date Parser', () => {
  function parseDate(html: string): Date | undefined {
    const parser = new GemParser(html, 'https://example.com');
    return parser.parse().closingDate;
  }

  test('parses DD-MM-YYYY format', () => {
    const html = `<html><body>
      <span class="bid-no">TEST/001</span>
      <h1 class="bid-title">Test</h1>
      <span class="closing-date">30-06-2024</span>
    </body></html>`;
    const d = parseDate(html);
    expect(d).toBeDefined();
    expect(d!.getMonth()).toBe(5); // June = 5
    expect(d!.getFullYear()).toBe(2024);
  });

  test('parses DD/MM/YYYY format', () => {
    const html = `<html><body>
      <span class="bid-no">TEST/002</span>
      <h1 class="bid-title">Test</h1>
      <span class="closing-date">15/08/2024</span>
    </body></html>`;
    const d = parseDate(html);
    expect(d).toBeDefined();
    expect(d!.getDate()).toBe(15);
    expect(d!.getMonth()).toBe(7); // August = 7
  });

  test('returns undefined for invalid date', () => {
    const html = `<html><body>
      <span class="bid-no">TEST/003</span>
      <h1 class="bid-title">Test</h1>
      <span class="closing-date">not-a-date</span>
    </body></html>`;
    const d = parseDate(html);
    expect(d).toBeUndefined();
  });
});

describe('Reference Number Normalization', () => {
  test('normalizes GEM reference number', () => {
    const html = `<html><body>
      <span class="bid-no">GEM/2024/B/123456</span>
      <h1 class="bid-title">Test</h1>
    </body></html>`;
    const parser = new GemParser(html, 'https://example.com');
    expect(parser.parse().referenceNumber).toBe('GEM/2024/B/123456');
  });

  test('uses fallback reference when missing', () => {
    const html = `<html><body>
      <h1 class="bid-title">Tender without ref</h1>
    </body></html>`;
    const parser = new GemParser(html, 'https://example.com');
    const result = parser.parse();
    expect(result.referenceNumber).toBeDefined();
    expect(result.referenceNumber.length).toBeGreaterThan(0);
  });
});
