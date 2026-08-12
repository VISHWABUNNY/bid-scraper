import { chromium, Browser, Page } from 'playwright';
import { GemBid, PortalType } from './scraper';

const DIRECT_ENDPOINT_CONFIG: Record<PortalType, {
  targetUrl: string;
  requestUrl: string;
  method: 'POST' | 'GET';
  contentType?: string;
  bodyBuilder: (keyword: string) => Record<string, any>;
}> = {
  GEM: {
    targetUrl: 'https://bidplus.gem.gov.in/all-bids',
    requestUrl: 'https://bidplus.gem.gov.in/all-bids',
    method: 'POST',
    contentType: 'application/json',
    bodyBuilder: (keyword) => ({ searchBid: keyword, page: 1 }),
  },
  CPPP: {
    targetUrl: 'https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByDate',
    requestUrl: 'https://eprocure.gov.in/eprocure/app?page=FrontEndTendersByDate',
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
    bodyBuilder: (keyword) => ({ searchBid: keyword, page: 'FrontEndTendersByDate' }),
  },
  AP: {
    targetUrl: 'https://tender.apeprocurement.gov.in',
    requestUrl: 'https://tender.apeprocurement.gov.in',
    method: 'GET',
    bodyBuilder: () => ({}),
  },
  TS: {
    targetUrl: 'https://tender.telangana.gov.in',
    requestUrl: 'https://tender.telangana.gov.in',
    method: 'GET',
    bodyBuilder: () => ({}),
  },
  MH: {
    targetUrl: 'https://mahatenders.gov.in',
    requestUrl: 'https://mahatenders.gov.in',
    method: 'GET',
    bodyBuilder: () => ({}),
  },
  UP: {
    targetUrl: 'https://etender.up.nic.in',
    requestUrl: 'https://etender.up.nic.in',
    method: 'GET',
    bodyBuilder: () => ({}),
  },
};

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
  const config = DIRECT_ENDPOINT_CONFIG[portalType];

  try {
    await page.goto(config.targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    for (const keyword of keywords) {
      console.log(`[DirectAPI][${portalType}] Fetching data payload for keyword: "${keyword}"`);

      let extractedBids: GemBid[] = [];

      if (config.method === 'POST') {
        extractedBids = await page.evaluate(
          async ({ requestUrl, contentType, body, portal, kw }) => {
            function normalizeText(value: string): string {
              return value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
            }

            function extractBid(raw: string, portalCode: string, keywordValue: string) {
              const text = normalizeText(raw);
              const lowerText = text.toLowerCase();

              const bidIdMatch =
                text.match(/GEM\/\d{4}\/\w\/\d+/i) ||
                text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\/?\d{3,12}/i) ||
                text.match(/TND\d{6,10}/i) ||
                text.match(/\d{6,10}/);
              if (!bidIdMatch) return null;
              const rawBidId = bidIdMatch[0].trim();
              const bidId = rawBidId.startsWith(portalCode) ? rawBidId : `${portalCode}/${rawBidId}`;

              const isReject = /(electrical|furniture|pipe|tyre|vehicle|camera|construction|civil|catering|housekeeping|security guard|water|road|soap|towel|garment|jacket|cable|battery|transformer|meter)/i.test(lowerText);
              if (isReject) return null;

              const linkMatch = text.match(/https?:\/\/[\w\-./?&=%]+/i);
              const gemUrl = linkMatch ? linkMatch[0] : window.location.href;
              const isMsme = /msme|mse\s*exemption|mse\s*relaxation/i.test(lowerText);
              const isStartup = /startup|startup\s*exemption|startup\s*relaxation/i.test(lowerText);
              const closingMatch = text.match(/(?:End|Closing|Due)\s*Date[:\s-]+(\d{2}[-/]\d{2}[-/]\d{4}(?:\s*\d{1,2}:?\d{0,2}(?:\s*[APMapm]{2})?)?)/i);
              const openingMatch = text.match(/(?:Start|Opening)\s*Date[:\s-]+(\d{2}[-/]\d{2}[-/]\d{4}(?:\s*\d{1,2}:?\d{0,2}(?:\s*[APMapm]{2})?)?)/i);
              const itemMatch = text.match(/(?:Items|Category|Work|Subject)[:\s-]+([^.|\n\r]+)/i);
              const organisationMatch = text.match(/(?:Department|Ministry|Organisation|Organization|Agency|Authority)[:\s-]+([^.|\n\r]+)/i);

              return {
                bidId,
                portal: portalCode as any,
                title: itemMatch ? itemMatch[1].trim() : text.slice(0, 140) || `${portalCode} Tender`,
                organisation: organisationMatch ? organisationMatch[1].trim() : `${portalCode} Procurement Department`,
                departmentName: organisationMatch ? organisationMatch[1].trim() : `${portalCode} Procurement Department`,
                organisationName: organisationMatch ? organisationMatch[1].trim() : `${portalCode} Procurement Department`,
                itemCategory: itemMatch ? itemMatch[1].trim() : null,
                gemUrl,
                value: null,
                closingDate: closingMatch ? closingMatch[1].trim() : null,
                bidOpeningDate: openingMatch ? openingMatch[1].trim() : null,
                isMsme,
                isStartup,
                keyword: kw,
              };
            }

            function parseResponse(content: string) {
              const results = [];
              let jsonPayload: any;
              try {
                jsonPayload = JSON.parse(content);
              } catch {
                jsonPayload = null;
              }

              if (jsonPayload) {
                const entries = Array.isArray(jsonPayload)
                  ? jsonPayload
                  : jsonPayload.data || jsonPayload.tenders || jsonPayload.allBids || jsonPayload.bidList || jsonPayload.records || [];
                if (Array.isArray(entries) && entries.length > 0) {
                  for (const entry of entries) {
                    const candidate = extractBid(JSON.stringify(entry), portal, kw);
                    if (candidate) results.push(candidate);
                  }
                }
              }

              if (results.length === 0) {
                const doc = new DOMParser().parseFromString(content, 'text/html');
                const rows = Array.from(doc.querySelectorAll('.card, .result-card, .search-result-item, .bid-card, tr, .block_header, .tenderRow'));
                for (const row of rows) {
                  const candidate = extractBid(row.textContent || '', portal, kw);
                  if (candidate) results.push(candidate);
                }
              }

              return results;
            }

            const requestInit: RequestInit = { method: 'POST', headers: {} };
            if (contentType) {
              requestInit.headers = { 'Content-Type': contentType };
            }

            if (contentType?.includes('application/json')) {
              requestInit.body = JSON.stringify(body);
            } else if (contentType?.includes('application/x-www-form-urlencoded')) {
              requestInit.body = new URLSearchParams(body).toString();
            } else {
              requestInit.body = JSON.stringify(body);
            }

            const response = await fetch(requestUrl, requestInit);
            const text = await response.text();
            return parseResponse(text);
          },
          {
            requestUrl: config.requestUrl,
            contentType: config.contentType,
            body: config.bodyBuilder(keyword),
            portal: portalType,
            kw: keyword,
          }
        );
      }

      if (!extractedBids || extractedBids.length === 0) {
        const fallbackBids = (await page.evaluate(
          async ({ kw, portal }) => {
            const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').replace(/\u00a0/g, ' ').trim();
            const elements = Array.from(document.querySelectorAll('.card, .result-card, .search-result-item, .bid-card, tr, .block_header, .tenderRow'));
            return elements
              .map((element) => {
                const text = normalizeText(element.textContent || '');
                const lowerText = text.toLowerCase();
                const bidIdMatch = text.match(/GEM\/\d+\/[A-Z]\/\d+/i) || text.match(/(?:GEM|CPPP|AP|TS|MH|UP)\d+/i) || text.match(/\d{6,10}/);
                if (!bidIdMatch) return null;
                const rawBidId = bidIdMatch[0];
                const bidId = rawBidId.startsWith(portal) ? rawBidId : `${portal}/${rawBidId}`;
                const isReject = /(electrical|furniture|pipe|tyre|vehicle|camera|construction|civil|catering|housekeeping|security guard|water|road|soap|towel|garment|jacket|cable|battery|transformer|meter)/i.test(lowerText);
                if (isReject) return null;
                const link = element.querySelector('a[href*="showbidDocument"], a[href*="bid"], a[href*="tender"], a') as HTMLAnchorElement | null;
                const gemUrl = link?.href || window.location.href;
                const isMsme = /msme|mse\s*exemption|mse\s*relaxation/i.test(lowerText);
                const isStartup = /startup|startup\s*exemption|startup\s*relaxation/i.test(lowerText);
                const closingMatch = text.match(/(?:End|Closing|Due)\s*Date[:\s-]+(\d{2}[-/]\d{2}[-/]\d{4}(?:\s*\d{1,2}:?\d{0,2}(?:\s*[APMapm]{2})?)?)/i);
                const openingMatch = text.match(/(?:Start|Opening)\s*Date[:\s-]+(\d{2}[-/]\d{2}[-/]\d{4}(?:\s*\d{1,2}:?\d{0,2}(?:\s*[APMapm]{2})?)?)/i);
                const itemMatch = text.match(/(?:Items|Category|Work|Subject)[:\s-]+([^.|\n\r]+)/i);
                const organisationMatch = text.match(/(?:Department|Ministry|Organisation|Organization|Agency|Authority)[:\s-]+([^.|\n\r]+)/i);
                return {
                  bidId,
                  portal: portal as any,
                  title: itemMatch ? itemMatch[1].trim() : text.slice(0, 160) || `${portal} Tender`,
                  organisation: organisationMatch ? organisationMatch[1].trim() : `${portal} Procurement Department`,
                  departmentName: organisationMatch ? organisationMatch[1].trim() : `${portal} Procurement Department`,
                  organisationName: organisationMatch ? organisationMatch[1].trim() : `${portal} Procurement Department`,
                  itemCategory: itemMatch ? itemMatch[1].trim() : null,
                  gemUrl,
                  value: null,
                  closingDate: closingMatch ? closingMatch[1].trim() : null,
                  bidOpeningDate: openingMatch ? openingMatch[1].trim() : null,
                  isMsme,
                  isStartup,
                  keyword: kw,
                };
              })
              .filter(Boolean) as GemBid[];
          },
          { kw: keyword, portal: portalType }
        )) as Array<GemBid>;
        extractedBids = extractedBids.concat(fallbackBids);
      }

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
