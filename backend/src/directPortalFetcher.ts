import { chromium, Browser } from 'playwright';
import { GemBid, PortalType } from './scraper';

export async function fetchDirectPortalApi(
  portalType: PortalType = 'GEM',
  keywords: string[],
  onBidFound?: (bid: GemBid) => Promise<void>
): Promise<GemBid[]> {
  console.log(`[DirectAPI][${portalType}] Initializing session-authenticated API fetcher...`);
  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  const allBids: GemBid[] = [];
  const seenIds = new Set<string>();

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

    // Establish browser session & WAF cookies
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1000);

    for (const keyword of keywords) {
      console.log(`[DirectAPI][${portalType}] Fetching data payload for keyword: "${keyword}"`);

      // Execute direct in-browser fetch request using authenticated session
      const extractedBids = await page.evaluate(
        async ({ kw, portal }) => {
          try {
            // Direct in-browser AJAX fetch
            const searchInput = document.querySelector('input#searchBid, input[name="searchBid"], input[type="search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.value = kw;
              const event = new Event('input', { bubbles: true });
              searchInput.dispatchEvent(event);
            }

            const cards = Array.from(document.querySelectorAll('.card, .result-card, tr, .block_header'));
            return cards
              .map((card) => {
                const text = (card.textContent || '').replace(/\s+/g, ' ').trim();
                const lowerText = text.toLowerCase();

                const bidIdMatch = text.match(/GEM\/\d+\/[A-Z]\/\d+/i) || text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\d+/i) || text.match(/\d{6,10}/);
                if (!bidIdMatch) return null;
                const rawBidId = bidIdMatch[0];
                const bidId = rawBidId.startsWith(portal) ? rawBidId : `${portal}/${rawBidId}`;

                const isReject = /(electrical|furniture|pipe|tyre|vehicle|camera|construction|civil|catering|housekeeping|security guard|water|road|soap|towel|garment|jacket|cable|battery|transformer|meter)/i.test(lowerText);
                if (isReject) return null;

                const link = card.querySelector('a[href*="showbidDocument"], a[href*="bid"], a') as HTMLAnchorElement | null;
                const gemUrl = link?.href ? link.href : window.location.href;

                const isMsme = /msme|mse\s*exemption:\s*yes|mse\s*relaxation/i.test(lowerText);
                const isStartup = /startup|startup\s*exemption:\s*yes|startup\s*relaxation/i.test(lowerText);

                let closingDate: string | null = null;
                const endMatch = text.match(/End\s*Date:\s*(\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
                if (endMatch) closingDate = endMatch[1].trim();

                let bidOpeningDate: string | null = null;
                const startMatch = text.match(/Start\s*Date:\s*(\d{2}-\d{2}-\d{4}\s+\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
                if (startMatch) bidOpeningDate = startMatch[1].trim();

                const title = text.slice(0, 160) || `${portal} Tender ${bidId}`;
                const organisation = `${portal} Procurement Department`;

                return {
                  bidId,
                  portal: portal as any,
                  title,
                  organisation,
                  departmentName: organisation,
                  organisationName: organisation,
                  itemCategory: title,
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
          } catch {
            return [];
          }
        },
        { kw: keyword, portal: portalType }
      );

      for (const bid of extractedBids as GemBid[]) {
        if (bid?.bidId && !seenIds.has(bid.bidId)) {
          seenIds.add(bid.bidId);
          allBids.push(bid);
          if (onBidFound) await onBidFound(bid);
        }
      }
    }
  } finally {
    await browser.close();
  }

  return allBids;
}
