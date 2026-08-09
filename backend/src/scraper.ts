import { chromium, Browser, Page } from 'playwright';

export interface GemBid {
  bidId: string;
  title: string;
  organisation: string;
  departmentName: string | null;
  organisationName: string | null;
  itemCategory: string | null;
  gemUrl: string;
  value: number | null;
  closingDate: string | null;
  bidOpeningDate: string | null;
  isMsme: boolean;
  isStartup: boolean;
  keyword: string;
}

// Scrape GeM across all provided keywords efficiently using a single browser instance.
export async function scrapeGemByKeywords(
  keywords: string[],
  onBidFound?: (bid: GemBid) => Promise<void>
): Promise<GemBid[]> {
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();
  const allResults: GemBid[] = [];
  const seenIds = new Set<string>();

  try {
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].trim();
      if (!keyword) continue;

      console.log(`[${i + 1}/${keywords.length}] Searching GeM for: "${keyword}"`);

      try {
        await page.goto('https://bidplus.gem.gov.in/all-bids', {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        await page.fill('input#searchBid, input[name="searchBid"], input[type="search"], input[placeholder*="Search"]', keyword);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1200);
        await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});

        const bids = await page.evaluate((kw: string) => {
          const selectors = ['.card', '.result-card', '.search-result-item', '.bid-card', '.table-responsive table tr', 'tr'];
          const cardElements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

          // Helper to strip label headers and trailing label sections from any extracted string
          const sanitize = (raw: string): string => {
            return raw
              .replace(/[\u00a0\s]+/g, ' ')
              .replace(/BID\s*NO:.*?(?=Items:|Department|Quantity|Start|$)/gi, '')
              .replace(/View\s*Corrigendum\/Representation/gi, '')
              .replace(/Quantity:.*$/gi, '')
              .replace(/Department\s*Name\s*And\s*Address:.*$/gi, '')
              .replace(/Start\s*Date:.*$/gi, '')
              .replace(/End\s*Date:.*$/gi, '')
              .replace(/^Items:\s*/gi, '')
              .trim();
          };

          return cardElements
            .map((card: Element) => {
              const rawText = card.textContent || card.innerHTML || '';
              const text = rawText.replace(/[\u00a0\s]+/g, ' ').trim();
              const lowerText = text.toLowerCase();

              const bidIdMatch = text.match(/GEM\/\d+\/[A-Z]\/\d+/i) || text.match(/GEM\d+/i);
              if (!bidIdMatch) return null;
              const bidId = bidIdMatch[0];

              const isLikelyUnrelated = /(electrical|furniture|door|window|pipe|tyre|vehicle|camera|container|compactor|locker|medical|sanitation|construction|civil|catering|housekeeping|security guard|water|road|building|table|chair|soap|towel|garment|jacket|cable|battery|transformer|meter)/i.test(lowerText);
              if (isLikelyUnrelated) return null;

              const link = card.querySelector('a[href*="showbidDocument"], a[href*="/bid/"], a[href*="bid"], a') as HTMLAnchorElement | null;
              const gemUrl = link?.href ? new URL(link.href, window.location.origin).href : 'https://bidplus.gem.gov.in/all-bids';

              // Extract & sanitize Item Category
              let itemCategory: string | null = null;
              const itemMatch = text.match(/Items:\s*(.*?)(?=Quantity:|Department\s*Name|Start\s*Date:|End\s*Date:|$)/i);
              if (itemMatch && itemMatch[1]) {
                itemCategory = sanitize(itemMatch[1]);
              }

              // Extract & sanitize Department text
              let deptText = '';
              const deptMatch = text.match(/Department\s*Name\s*And\s*Address:\s*(.*?)(?=Start\s*Date:|End\s*Date:|$)/i);
              if (deptMatch && deptMatch[1]) {
                deptText = sanitize(deptMatch[1]);
              }

              let organisationName: string | null = null;
              let departmentName: string | null = null;

              if (deptText) {
                const deptSplitMatch = deptText.match(/^(.+?)\s+(Department\s+of\s+.+?)$/i);
                if (deptSplitMatch) {
                  organisationName = deptSplitMatch[1].trim();
                  departmentName = deptSplitMatch[2].trim();
                } else {
                  organisationName = deptText;
                  departmentName = deptText;
                }
              }

              const organisation = deptText || 'Government Department';

              // Title: clean item Category or title snippet
              const title = itemCategory || sanitize(text.slice(0, 160)) || 'IT Procurement Bid';

              // Extract Start Date (Bid Opening Date)
              let bidOpeningDate: string | null = null;
              const startMatch = text.match(/Start\s*Date:\s*(\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
              if (startMatch) {
                bidOpeningDate = startMatch[1].trim();
              }

              // Extract End Date (Bid Closing Date)
              let closingDate: string | null = null;
              const endMatch = text.match(/End\s*Date:\s*(\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
              if (endMatch) {
                closingDate = endMatch[1].trim();
              }

              const isMsme = /msme|mse\s*exemption:\s*yes|mse\s*relaxation/i.test(lowerText);
              const isStartup = /startup|startup\s*exemption:\s*yes|startup\s*relaxation/i.test(lowerText);

              const relevantTerms = ['software', 'portal', 'website', 'mobile', 'application', 'it', 'digital', 'dashboard', 'management', 'automation', 'crm', 'saas', 'cyber', 'security', 'system', 'analytics', 'monitoring', 'gis', 'hrms', 'e-office', 'asset', 'inventory', 'fleet', 'tracking', 'document', 'workflow', 'service', 'provider', 'audit', 'solution', 'platform'];
              const keywordText = kw.toLowerCase();
              const relevantText = `${title.toLowerCase()} ${organisation.toLowerCase()} ${lowerText}`;
              const hasKeywordMatch = keywordText.split(/\s+/).some((term) => term.length > 2 && relevantText.includes(term));
              const hasRelevantTerm = relevantTerms.some((term) => relevantText.includes(term));
              const isRelevant = hasKeywordMatch || hasRelevantTerm;
              if (!isRelevant) return null;

              return {
                bidId: bidId,
                title,
                organisation,
                departmentName,
                organisationName,
                itemCategory,
                gemUrl,
                value: null,
                closingDate,
                bidOpeningDate,
                isMsme,
                isStartup,
                keyword: kw,
              };
            })
            .filter(Boolean);
        }, keyword);

        let count = 0;
        for (const bid of bids as GemBid[]) {
          if (bid?.bidId && !seenIds.has(bid.bidId)) {
            seenIds.add(bid.bidId);
            allResults.push(bid);
            count++;
            if (onBidFound) {
              await onBidFound(bid);
            }
          }
        }

        if (count === 0) {
          const fallbackText = await page.textContent('body').catch(() => '');
          if (fallbackText && /gem|bid|tender|service|portal|software/i.test(fallbackText)) {
            console.log(`  → no structured cards matched, but page content suggests results are present for "${keyword}"`);
          }
        }

        console.log(`  → ${count} new bids extracted for "${keyword}"`);
      } catch (err: any) {
        console.error(`  Error scraping "${keyword}": ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  return allResults;
}

// Single keyword shortcut
export async function scrapeGemByKeyword(keyword: string): Promise<GemBid[]> {
  return scrapeGemByKeywords([keyword]);
}
