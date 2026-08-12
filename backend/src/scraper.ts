import { chromium, Browser, Page } from 'playwright';
import * as pdfParse from 'pdf-parse';

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
  emdExempted?: boolean;
  guidanceNotes?: string | null;
  keyword: string;
}

const CONCURRENCY = 2;

// Stealth user agents for browser automation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
];

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
  const uniqueKeywords = Array.from(
    new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2))
  );

  const browser: Browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const allResults: GemBid[] = [];
  const seenIds = new Set<string>();
  let completedCount = 0;
  let queueIndex = 0;

  async function scrapeWorker(workerId: number, page: Page) {
    // Set stealth headers and viewport
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    while (true) {
      if (queueIndex >= uniqueKeywords.length) break;
      const currentIndex = queueIndex++;
      const keyword = uniqueKeywords[currentIndex];

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
        const targetUrl =
          portalType === 'CPPP'
            ? 'https://eprocure.gov.in/eprocure/app'
            : portalType === 'AP'
            ? 'https://tender.apeprocurement.gov.in'
            : portalType === 'TS'
            ? 'https://tender.telangana.gov.in'
            : portalType === 'MH'
            ? 'https://mahatenders.gov.in'
            : portalType === 'UP'
            ? 'https://etender.up.nic.in'
            : 'https://bidplus.gem.gov.in/all-bids';

        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});

        // Try filling search input if present
        const searchInputSelector = 'input#searchBid, input[name="searchBid"], #searchBid, input[placeholder="Enter Keyword"], input[name="Keyword"]';
        const searchInput = await page.$(searchInputSelector).catch(() => null);

        if (searchInput) {
          await searchInput.fill(keyword).catch(() => {});
          await page.keyboard.press('Enter').catch(() => {});
          await page.waitForSelector('#bidCard .card, .card, .result-card, tr', { timeout: 6000 }).catch(() => {});
          await page.waitForTimeout(500);
        }

        const bids = await page.evaluate(
          ({ kw, portal }: { kw: string; portal: string }) => {
            const cardSelectors = [
              '.card',
              '.result-card',
              '.search-result-item',
              '.bid-card',
              'tr',
            ];
            const elements = cardSelectors.flatMap((sel) =>
              Array.from(document.querySelectorAll(sel))
            );

            const sanitize = (raw: string): string => {
              return raw
                .replace(/[\u00a0\s]+/g, ' ')
                .replace(/BID\s*NO:.*?(?=Items:|Department|Quantity|Start|$)/gi, '')
                .replace(/View\s*Corrigendum\/Representation/gi, '')
                .trim();
            };

            return elements
              .map((el: Element) => {
                const text = (el.textContent || '').replace(/[\u00a0\s]+/g, ' ').trim();
                if (!text || text.length < 20) return null;
                const lowerText = text.toLowerCase();

                // 1. Precise Tender ID Matching
                const bidIdMatch =
                  text.match(/GEM\/\d{4}\/[A-Z]\/\d+/i) ||
                  text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\/\d{4}\/\d+/i) ||
                  text.match(/TND\d{6,10}/i);

                if (!bidIdMatch) return null;

                const rawId = bidIdMatch[0].trim();
                const bidId = rawId.startsWith(portal) ? rawId : `${portal}/${rawId}`;

                // 2. Financial Amount Extraction (₹ amounts in Lakhs/Crores or raw numbers)
                let value: number | null = null;
                const lakhMatch = text.match(/(?:₹|rs\.?|INR)\s*([\d.,]+)\s*(lakh|lakhs|lac|lacs)/i);
                const croreMatch = text.match(/(?:₹|rs\.?|INR)\s*([\d.,]+)\s*(crore|crores|cr)/i);
                const rawRupeeMatch = text.match(/(?:₹|rs\.?|INR)\s*([\d,]{4,12})/i);

                if (croreMatch && croreMatch[1]) {
                  const num = parseFloat(croreMatch[1].replace(/,/g, ''));
                  if (!isNaN(num)) value = Number((num * 100).toFixed(2)); // Store in Lakhs
                } else if (lakhMatch && lakhMatch[1]) {
                  const num = parseFloat(lakhMatch[1].replace(/,/g, ''));
                  if (!isNaN(num)) value = Number(num.toFixed(2));
                } else if (rawRupeeMatch && rawRupeeMatch[1]) {
                  const num = parseFloat(rawRupeeMatch[1].replace(/,/g, ''));
                  if (!isNaN(num)) value = Number((num / 100000).toFixed(2));
                }

                // 3. Organization & Department Extraction
                let organisation = `${portal} Procurement Department`;
                const deptMatch = text.match(/(?:Department|Ministry|Org|Organisation)\s*(?:Name)?:\s*([^.\n\r]+)/i);
                if (deptMatch && deptMatch[1]) {
                  organisation = sanitize(deptMatch[1].slice(0, 100));
                }

                // 4. Dates Extraction
                let closingDate: string | null = null;
                const endMatch = text.match(/(?:End|Closing|Due)\s*Date:\s*(\d{2}[-/]\d{2}[-/]\d{4}\s*\d{0,2}:?\d{0,2})/i);
                if (endMatch) closingDate = endMatch[1].trim();

                let bidOpeningDate: string | null = null;
                const startMatch = text.match(/(?:Start|Opening)\s*Date:\s*(\d{2}[-/]\d{2}[-/]\d{4}\s*\d{0,2}:?\d{0,2})/i);
                if (startMatch) bidOpeningDate = startMatch[1].trim();

                // 5. Item / Title Extraction
                let itemCategory: string | null = null;
                const itemMatch = text.match(/(?:Items|Category|Work):\s*([^.\n\r]+)/i);
                if (itemMatch && itemMatch[1]) {
                  itemCategory = sanitize(itemMatch[1].slice(0, 120));
                }

                const title = itemCategory || sanitize(text.slice(0, 140)) || `${portal} Tender`;

                // 6. Tender URL
                // Prefer anchors that look like a direct tender/document link
                const anchors = Array.from(el.querySelectorAll('a')) as HTMLAnchorElement[];
                const preferred = anchors.find(a => /showbiddocument|showbid|showBidDocument|showBid|viewbid|viewBid|viewTender|showTender|tenderId=|tenderId|bidId|showBidDocument/i.test(a.href || a.getAttribute('onclick') || ''))
                  || anchors.find(a => /\d{5,}/.test(a.href || ''))
                  || anchors.find(a => (a.getAttribute('onclick') || '').match(/https?:\/\//));

                let gemUrl = preferred?.href || window.location.href;

                // If no preferred link was found, try extracting a URL from onclick handlers
                if (!preferred && anchors.length > 0) {
                  for (const a of anchors) {
                    const onclick = a.getAttribute('onclick') || '';
                    const m = onclick.match(/(https?:\/\/[^'"\s]+)/);
                    if (m) {
                      gemUrl = m[1];
                      break;
                    }
                  }
                }

                // 7. MSME & Startup Exemption Flags
                const isMsme = /msme|mse\s*exemption|mse\s*relaxation/i.test(lowerText);
                const isStartup = /startup|startup\s*exemption|startup\s*relaxation/i.test(lowerText);

                return {
                  bidId,
                  portal: portal as any,
                  title,
                  organisation,
                  departmentName: organisation,
                  organisationName: organisation,
                  itemCategory,
                  gemUrl,
                  value,
                  closingDate,
                  bidOpeningDate,
                  isMsme,
                  isStartup,
                  keyword: kw,
                };
              })
              .filter(Boolean);
          },
          { kw: keyword, portal: portalType }
        );

        let count = 0;
        for (const bidObj of bids as GemBid[]) {
          try {
            const bid = { ...bidObj } as GemBid & { emdExempted?: boolean; guidanceNotes?: string | null };

            // Attempt to fetch the detailed tender page to extract EMD / MSME / Startup mentions
            try {
              const detailPage = await page.context().newPage();
              let detailText = '';

              try {
                const resp = await detailPage.goto(bid.gemUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
                const contentType = resp && typeof resp.headers === 'function' ? (resp.headers()['content-type'] || '') : (resp?.headers?.['content-type'] || '');
                
                // Check if response is a PDF
                const isPdf = /application\/pdf/i.test(contentType || '') || /\.pdf(\?|$)/i.test(bid.gemUrl || '');
                
                if (isPdf) {
                  // Download and parse PDF
                  try {
                    const pdfResp = await fetch(bid.gemUrl);
                    if (pdfResp.ok) {
                      const buffer = await pdfResp.arrayBuffer();
                      const pdfData = await pdfParse(Buffer.from(buffer));
                      detailText = pdfData.text || '';
                    }
                  } catch (pdfErr) {
                    // PDF parsing failed, continue without detail text
                  }
                } else {
                  // Try to extract HTML text
                  try {
                    detailText = (await detailPage.evaluate(() => document.body?.innerText || '')) || '';
                  } catch (e) {
                    // Evaluation failed
                  }
                }
              } catch (navErr) {
                // Navigation failed, try to extract whatever we can
              }

              const lower = (detailText || '').toLowerCase();

              // EMD / Earnest Money detection
              const emdExempt = /emd[^\n]{0,120}?(exempt|waiv|waived|not required|nil|zero|0)\b/i.test(lower) || 
                                /earnest money[^\n]{0,120}?(exempt|waiv|waived|not required|nil|zero|0)\b/i.test(lower) ||
                                /earnest money deposit[^\n]{0,120}?(exempt|waiv|waived|not required|nil|zero|0)\b/i.test(lower) ||
                                /emd not (required|applicable)\b/i.test(lower);
              bid.emdExempted = Boolean(emdExempt);

              // Re-evaluate MSME / Startup flags on detail page (higher confidence)
              const msmeMatch = /msme|mse\s*exemption|mse\s*relaxation|micro\s*small\s*and\s*medium|\bmse\b|\bmsme\b/i.test(lower);
              const startupMatch = /startup|startup\s*exemption|startup\s*relaxation|dpiit|startup india/i.test(lower);
              bid.isMsme = bid.isMsme || msmeMatch;
              bid.isStartup = bid.isStartup || startupMatch;

              // Build guidance notes if present
              const notes: string[] = [];
              if (bid.isMsme) notes.push('MSME eligible');
              if (bid.isStartup) notes.push('Startup eligible');
              if (bid.emdExempted) notes.push('EMD exemption indicated');
              bid.guidanceNotes = notes.length ? `Tender Guidance: ${notes.join('. ')}.` : bid.guidanceNotes ?? null;

              await detailPage.close().catch(() => {});
            } catch (err) {
              // ignore detail fetch errors
            }

            if (bid?.bidId && !seenIds.has(bid.bidId)) {
              seenIds.add(bid.bidId);
              allResults.push(bid);
              count++;
              if (onBidFound) {
                await onBidFound(bid);
              }
            }
          } catch (err: any) {
            console.warn('[scraper] failed processing bid object:', err?.message || err);
            continue;
          }
        }

        console.log(`[Worker ${workerId}][${portalType}]  → ${count} bids extracted for "${keyword}"`);
      } catch (err: any) {
        console.error(`[Worker ${workerId}][${portalType}] Error on "${keyword}": ${err.message}`);
      }
    }
  }

  try {
    const workerPromises: Promise<void>[] = [];
    const numWorkers = Math.min(CONCURRENCY, uniqueKeywords.length);

    for (let w = 1; w <= numWorkers; w++) {
      const context = await browser.newContext({
        userAgent: USER_AGENTS[(w - 1) % USER_AGENTS.length],
        viewport: { width: 1280, height: 800 },
      });
      const page = await context.newPage();
      workerPromises.push(scrapeWorker(w, page));
    }

    await Promise.all(workerPromises);
  } finally {
    await browser.close().catch(() => {});
  }

  return allResults;
}

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
    console.log(`\n=== SCRAPING PORTAL: ${portal} ===`);
    const results = await scrapeGemByKeywords(keywords, onBidFound, onProgress, portal);
    allPortalResults.push(...results);
  }

  return allPortalResults;
}

export async function scrapeGemByKeyword(keyword: string): Promise<GemBid[]> {
  return scrapeGemByKeywords([keyword]);
}
