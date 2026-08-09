export interface GemParseResult {
  referenceNumber: string;
  title: string;
  organization: string;
  estimatedValue?: number;
  emd?: number;
  state?: string;
  isMsmeEligible?: boolean;
  closingDate?: Date;
  documentLinks?: Array<{ mimeType: string; url: string }>;
  source: string;
}

export class GemParser {
  private html: string;
  private url: string;

  constructor(html: string, url: string) {
    this.html = html || '';
    this.url = url || '';
  }

  public parse(): GemParseResult {
    const text = this.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Reference / Bid Number
    const refMatch =
      this.html.match(/class=["']bid-no["']>([^<]+)</i) ||
      text.match(/GEM\/\d{4}\/[A-Z]\/\d+/i) ||
      text.match(/TEST\/\d+/i) ||
      text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\/\d{4}\/\w+\/\d+/i);

    const referenceNumber = refMatch
      ? (refMatch[1] || refMatch[0]).trim()
      : `REF-${Math.abs(this.hashCode(text)).toString().slice(0, 8)}`;

    // 2. Title
    const titleMatch =
      this.html.match(/class=["']bid-title["']>([^<]+)</i) ||
      this.html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Procurement Tender';

    // 3. Organization
    const orgMatch =
      this.html.match(/class=["']buyer-org["']>([^<]+)</i) ||
      this.html.match(/class=["']organisation["']>([^<]+)</i);
    const organization = orgMatch ? orgMatch[1].trim() : 'Government Department';

    // 4. Estimated Value
    const valueMatch = this.html.match(/class=["']bid-value["']>([^<]+)</i);
    const estimatedValue = valueMatch ? this.parseCurrency(valueMatch[1]) : undefined;

    // 5. EMD
    const emdMatch = this.html.match(/class=["']emd-amount["']>([^<]+)</i);
    const emd = emdMatch ? this.parseCurrency(emdMatch[1]) : undefined;

    // 6. State
    const stateMatch = this.html.match(/class=["']location-state["']>([^<]+)</i);
    const state = stateMatch ? stateMatch[1].trim() : undefined;

    // 7. MSME Eligibility
    const msmeMatch = this.html.match(/class=["']msme-eligible["']>([^<]+)</i);
    const isMsmeEligible = msmeMatch
      ? /yes|true|eligible/i.test(msmeMatch[1])
      : /msme|mse\s*exemption:\s*yes/i.test(text);

    // 8. Closing Date
    const closingDateMatch = this.html.match(/class=["']closing-date["']>([^<]+)</i);
    const closingDate = closingDateMatch ? this.parseDateString(closingDateMatch[1].trim()) : undefined;

    // 9. Document Links
    const docRegex = /href=["']([^"']+\.pdf)["']/gi;
    const documentLinks: Array<{ mimeType: string; url: string }> = [];
    let docMatch: RegExpExecArray | null;
    while ((docMatch = docRegex.exec(this.html)) !== null) {
      documentLinks.push({
        mimeType: 'application/pdf',
        url: docMatch[1],
      });
    }

    return {
      referenceNumber,
      title,
      organization,
      estimatedValue,
      emd,
      state,
      isMsmeEligible,
      closingDate,
      documentLinks,
      source: 'GEM',
    };
  }

  public extractLinks(): string[] {
    const links: string[] = [];
    const linkRegex = /href=["']([^"']*(?:GEM\d+|\/bid\/|showbid)[^"']*)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(this.html)) !== null) {
      links.push(match[1]);
    }
    return links;
  }

  private parseCurrency(raw: string): number | undefined {
    if (!raw) return undefined;
    const cleaned = raw.replace(/[^\d.,]/g, '').trim();
    if (!cleaned) return undefined;

    // Standard numeric with optional commas
    const normalized = cleaned.replace(/,/g, '');
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
  }

  private parseDateString(raw: string): Date | undefined {
    if (!raw) return undefined;
    const parts = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (!parts) return undefined;

    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);

    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? undefined : d;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
