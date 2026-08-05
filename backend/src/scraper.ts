import { chromium, Browser, Page } from 'playwright';

export interface GemBid {
  bidId: string;
  title: string;
  organisation: string;
  gemUrl: string;
  value: number | null;
  closingDate: string | null;
  isMsme: boolean;
  isStartup: boolean;
  keyword: string;
}

// Scrape GeM across all provided keywords efficiently using a single browser instance
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
      const keyword = keywords[i];
      console.log(`[${i + 1}/${keywords.length}] Searching GeM for: "${keyword}"`);

      try {
        await page.goto('https://bidplus.gem.gov.in/all-bids', {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        await page.fill('#searchBid', keyword);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);
        await page.waitForSelector('.card', { timeout: 8000 }).catch(() => {});

        const bids = await page.evaluate((kw: string) => {
          const cards = Array.from(document.querySelectorAll('.card'));
          return cards
            .map((card: any) => {
              const text = card.innerText || card.textContent || '';
              const lines: string[] = text
                .split('\n')
                .map((l: string) => l.trim())
                .filter(Boolean);

              // Bid reference number
              const bidIdMatch = text.match(/GEM\/\d+\/[A-Z]\/\d+/i);
              if (!bidIdMatch) return null;
              const bidId = bidIdMatch[0];

              // Direct link to bid document PDF
              const link =
                card.querySelector('a[href*="showbidDocument"]') ||
                (card.querySelector('a') as HTMLAnchorElement | null);
              const gemUrl = link?.href || 'https://bidplus.gem.gov.in/all-bids';

              // Extract title (line starting with "Items:")
              const itemsLine = lines.find((l: string) => l.startsWith('Items:'));
              const title = itemsLine
                ? itemsLine.replace(/^Items:\s*/, '').trim()
                : lines[2] || lines[0];

              // Extract organisation (line after "Department Name And Address:")
              const deptIdx = lines.findIndex((l: string) =>
                l.includes('Department Name And Address:')
              );
              const organisation =
                deptIdx !== -1 && lines[deptIdx + 1] ? lines[deptIdx + 1] : '';

              // Extract closing date (line with "End Date:")
              const endLine = lines.find((l: string) => l.includes('End Date:'));
              const closingDate = endLine
                ? endLine.replace(/.*End Date:\s*/, '').trim()
                : null;

              const isMsme = /msme/i.test(text);
              const isStartup = /startup/i.test(text);

              return {
                bidId,
                title,
                organisation,
                gemUrl,
                value: null,
                closingDate,
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
