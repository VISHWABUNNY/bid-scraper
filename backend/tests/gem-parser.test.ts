// tests/gem-parser.test.ts
import { GemParser } from '../src/scrapers/gem/parser';

describe('GemParser', () => {
  const sampleHtml = `
    <html>
      <body>
        <h1 class="bid-title">Supply of AI-based Software for Government Department</h1>
        <span class="bid-no">GEM/2024/B/123456</span>
        <span class="buyer-org">Ministry of Electronics and IT</span>
        <span class="ministry-name">Department of IT</span>
        <span class="bid-value">₹45,00,000</span>
        <span class="emd-amount">₹90,000</span>
        <span class="category-type">IT Services</span>
        <span class="location-state">Delhi</span>
        <span class="location-city">New Delhi</span>
        <span class="published-date">01-06-2024</span>
        <span class="closing-date">30-06-2024</span>
        <span class="bid-opening-date">05-07-2024</span>
        <span class="msme-eligible">Yes</span>
        <a class="bid-link" href="/bid/GEM2024B123456">View Tender</a>
        <a href="/doc/tender.pdf">Tender Document</a>
      </body>
    </html>
  `;

  let parser: GemParser;

  beforeEach(() => {
    parser = new GemParser(sampleHtml, 'https://bidplus.gem.gov.in/bid/GEM2024B123456');
  });

  it('parses reference number', () => {
    const result = parser.parse();
    expect(result.referenceNumber).toBe('GEM/2024/B/123456');
  });

  it('parses title', () => {
    const result = parser.parse();
    expect(result.title).toContain('AI-based Software');
  });

  it('parses organization', () => {
    const result = parser.parse();
    expect(result.organization).toBe('Ministry of Electronics and IT');
  });

  it('parses estimated value', () => {
    const result = parser.parse();
    expect(result.estimatedValue).toBe(4500000);
  });

  it('parses EMD', () => {
    const result = parser.parse();
    expect(result.emd).toBe(90000);
  });

  it('parses state', () => {
    const result = parser.parse();
    expect(result.state).toBe('Delhi');
  });

  it('parses MSME eligibility', () => {
    const result = parser.parse();
    expect(result.isMsmeEligible).toBe(true);
  });

  it('parses document links', () => {
    const result = parser.parse();
    expect(result.documentLinks).toHaveLength(1);
    expect(result.documentLinks?.[0].mimeType).toBe('application/pdf');
  });

  it('extracts tender links', () => {
    const links = parser.extractLinks();
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('GEM2024B123456');
  });

  it('returns source as GEM', () => {
    const result = parser.parse();
    expect(result.source).toBe('GEM');
  });
});
