import { chromium, Browser, Page } from 'playwright';

export type PortalType = 'GEM' | 'CPPP' | 'AP' | 'TS' | 'MH' | 'UP';

export interface GemBid {
  bidId: string;
  portal?: PortalType;
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

const CONCURRENCY = 3;

// Scrape GeM across all provided keywords efficiently using parallel browser worker pages.
export async function scrapeGemByKeywords(
  keywords: string[],
  onBidFound?: (bid: GemBid) => Promise<void>,
  onProgress?: (info: {
    currentKeyword: string;
    currentIndex: number;
    totalKeywords: number;
    remainingKeywords: number;
    currentPortal?: string;
  }) => void,
  portalType: PortalType = 'GEM'
): Promise<GemBid[]> {
  // Deduplicate input keywords cleanly
  const uniqueKeywords = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))
  );

  const browser: Browser = await chromium.launch({ headless: true });
  const allResults: GemBid[] = [];
  const seenIds = new Set<string>();
  let completedCount = 0;
  let queueIndex = 0;

  async function scrapeWorker(workerId: number, page: Page) {
    while (true) {
      let currentIndex = 0;
      let keyword = '';

      // Thread-safe index retrieval
      if (queueIndex >= uniqueKeywords.length) break;
      currentIndex = queueIndex++;
      keyword = uniqueKeywords[currentIndex];

      completedCount++;
      if (onProgress) {
        onProgress({
          currentKeyword: keyword,
          currentIndex: completedCount,
          totalKeywords: uniqueKeywords.length,
          remainingKeywords: uniqueKeywords.length - completedCount,
          currentPortal: portalType,
        });
      }

      console.log(`[Worker ${workerId}][${completedCount}/${uniqueKeywords.length}][${portalType}] Searching for: "${keyword}"`);

      try {
        const targetUrl = portalType === 'CPPP' ? 'https://eprocure.gov.in/eprocure/app'
          : portalType === 'AP' ? 'https://tender.apeprocurement.gov.in'
          : portalType === 'TS' ? 'https://tender.telangana.gov.in'
          : portalType === 'MH' ? 'https://mahatenders.gov.in'
          : portalType === 'UP' ? 'https://etender.up.nic.in'
          : 'https://bidplus.gem.gov.in/all-bids';

        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });

        await page.fill('input#searchBid, input[name="searchBid"], input[type="search"], input[placeholder*="Search"], input[name="Keyword"]', keyword).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});

        // Smart event-driven waiting: wait for cards to render instead of long fixed sleep
        await page.waitForSelector('.card, .result-card, tr, body', { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);

        const bids = await page.evaluate(({ kw, portal }: { kw: string; portal: string }) => {
          const selectors = ['.card', '.result-card', '.search-result-item', '.bid-card', '.table-responsive table tr', 'tr'];
          const cardElements = selectors.flatMap((selector) => Array.from(document.querySelectorAll(selector)));

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

              const bidIdMatch = text.match(/GEM\/\d+\/[A-Z]\/\d+/i) || text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\d+/i) || text.match(/\d{6,10}/);
              if (!bidIdMatch) return null;
              const rawBidId = bidIdMatch[0];
              const bidId = rawBidId.startsWith(portal) ? rawBidId : `${portal}/${rawBidId}`;

              const isLikelyUnrelated = /(electrical|furniture|door|window|pipe|tyre|vehicle|camera|container|compactor|locker|medical|sanitation|construction|civil|catering|housekeeping|security guard|water|road|building|table|chair|soap|towel|garment|jacket|cable|battery|transformer|meter)/i.test(lowerText);
              if (isLikelyUnrelated) return null;

              const link = card.querySelector('a[href*="showbidDocument"], a[href*="/bid/"], a[href*="tender"], a[href*="bid"], a') as HTMLAnchorElement | null;
              const gemUrl = link?.href ? new URL(link.href, window.location.origin).href : window.location.href;

              let itemCategory: string | null = null;
              const itemMatch = text.match(/Items:\s*(.*?)(?=Quantity:|Department\s*Name|Start\s*Date:|End\s*Date:|$)/i);
              if (itemMatch && itemMatch[1]) {
                itemCategory = sanitize(itemMatch[1]);
              }

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

              const organisation = deptText || `${portal} Department`;
              const title = itemCategory || sanitize(text.slice(0, 160)) || `${portal} Procurement Tender`;

              let bidOpeningDate: string | null = null;
              const startMatch = text.match(/Start\s*Date:\s*(\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
              if (startMatch) {
                bidOpeningDate = startMatch[1].trim();
              }

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
                portal: portal as any,
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
        }, { kw: keyword, portal: portalType });

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

        console.log(`[Worker ${workerId}][${portalType}]  → ${count} new bids extracted for "${keyword}"`);
      } catch (err: any) {
        console.error(`[Worker ${workerId}][${portalType}] Error scraping "${keyword}": ${err.message}`);
      }
    }
  }

  try {
    const workerPromises: Promise<void>[] = [];
    const numWorkers = Math.min(CONCURRENCY, uniqueKeywords.length);

    for (let w = 1; w <= numWorkers; w++) {
      const page = await browser.newPage();
      workerPromises.push(scrapeWorker(w, page));
    }

    await Promise.all(workerPromises);
  } finally {
    await browser.close();
  }

  return allResults;
}

// Multi-portal master scraper function
export async function scrapeMultiPortalsByKeywords(
  portals: PortalType[],
  keywords: string[],
  onBidFound?: (bid: GemBid) => Promise<void>,
  onProgress?: (info: {
    currentKeyword: string;
    currentIndex: number;
    totalKeywords: number;
    remainingKeywords: number;
    currentPortal?: string;
  }) => void
): Promise<GemBid[]> {
  const targetPortals: PortalType[] = portals.length > 0 ? portals : ['GEM'];
  const allPortalResults: GemBid[] = [];

  for (const portal of targetPortals) {
    console.log(`\n=================== SCRAPING PORTAL: ${portal} ===================`);
    const results = await scrapeGemByKeywords(keywords, onBidFound, onProgress, portal);
    allPortalResults.push(...results);
  }

  return allPortalResults;
}

// Single keyword shortcut
export async function scrapeGemByKeyword(keyword: string): Promise<GemBid[]> {
  return scrapeGemByKeywords([keyword]);
}
