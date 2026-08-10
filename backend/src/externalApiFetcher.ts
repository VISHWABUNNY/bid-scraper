import https from 'https';
import { GemBid } from './scraper';

export async function fetchExternalTenderFeeds(
  keywords: string[],
  apiFeedUrl?: string
): Promise<GemBid[]> {
  console.log('[ExternalFeed] Checking external B2B / Open Data tender feeds...');
  const results: GemBid[] = [];

  // Default to public Open Data portal feed if no custom feed URL provided
  const feedUrl = apiFeedUrl || process.env.TENDER_API_FEED_URL;

  if (!feedUrl) {
    console.log('[ExternalFeed] No TENDER_API_FEED_URL set. Direct Session Ingestion pipeline active.');
    return [];
  }

  try {
    return new Promise((resolve) => {
      https
        .get(feedUrl, { headers: { 'User-Agent': 'TenderIQ-Intelligence-Engine/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const items = Array.isArray(parsed) ? parsed : parsed.data || parsed.records || [];

              for (const item of items) {
                const title = item.title || item.tender_title || item.subject || '';
                const bidId = item.bid_id || item.tender_id || `FEED/${Date.now()}`;
                const organisation = item.organisation || item.department || 'Government Dept';
                const portal = item.portal || 'CPPP';

                const matchesKeyword = keywords.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));

                if (matchesKeyword) {
                  results.push({
                    bidId,
                    portal,
                    title,
                    organisation,
                    departmentName: organisation,
                    organisationName: organisation,
                    itemCategory: title,
                    gemUrl: item.url || item.tender_url || 'https://eprocure.gov.in',
                    value: item.value || item.tender_value || null,
                    closingDate: item.closing_date || item.end_date || null,
                    bidOpeningDate: item.opening_date || item.start_date || null,
                    isMsme: Boolean(item.is_msme || item.msme_exemption),
                    isStartup: Boolean(item.is_startup || item.startup_exemption),
                    keyword: keywords[0] || 'software',
                  });
                }
              }

              console.log(`[ExternalFeed] Successfully ingested ${results.length} tenders from external feed.`);
              resolve(results);
            } catch (err: any) {
              console.warn('[ExternalFeed] Failed to parse feed JSON:', err.message);
              resolve([]);
            }
          });
        })
        .on('error', (e) => {
          console.warn('[ExternalFeed] Feed request error:', e.message);
          resolve([]);
        });
    });
  } catch (err: any) {
    console.warn('[ExternalFeed] External feed exception:', err.message);
    return [];
  }
}
