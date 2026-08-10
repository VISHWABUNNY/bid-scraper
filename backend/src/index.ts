import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeGemByKeywords, scrapeMultiPortalsByKeywords, PortalType } from './scraper';
import { fetchDirectPortalApi } from './directPortalFetcher';
import { fetchExternalTenderFeeds } from './externalApiFetcher';
import { evaluate } from './evaluator';
import { saveBid, getShortlisted, clearAll } from './db';
import { loadKeywords } from './keywords';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

let scrapeProgress = {
  isScraping: false,
  currentKeyword: '',
  currentPortal: 'GEM',
  currentIndex: 0,
  totalKeywords: 0,
  remainingKeywords: 0,
  shortlistedCount: 0,
  totalScraped: 0,
};

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

// GET /progress — returns real-time scraper progress
app.get('/progress', (_req, res) => {
  res.json({ success: true, progress: scrapeProgress });
});

// POST /run — trigger Tender247-grade 3-channel data ingestion pipeline in background
app.post('/run', async (req, res) => {
  try {
    if (scrapeProgress.isScraping) {
      return res.json({ success: true, started: false, message: 'Scraper already running' });
    }

    const { portal } = req.body || {};
    const selectedPortals: PortalType[] = portal === 'ALL'
      ? ['GEM', 'CPPP', 'AP', 'TS', 'MH', 'UP']
      : (['GEM', 'CPPP', 'AP', 'TS', 'MH', 'UP'].includes(portal) ? [portal as PortalType] : ['GEM']);

    const keywords = loadKeywords();
    console.log(`Starting Tender247 3-channel ingestion pipeline on portals [${selectedPortals.join(', ')}] for ${keywords.length} keywords...`);

    let totalScraped = 0;
    let shortlistedCount = 0;

    scrapeProgress = {
      isScraping: true,
      currentKeyword: keywords[0] || '',
      currentPortal: selectedPortals[0],
      currentIndex: 0,
      totalKeywords: keywords.length * selectedPortals.length,
      remainingKeywords: keywords.length * selectedPortals.length,
      shortlistedCount: 0,
      totalScraped: 0,
    };

    // Return HTTP response immediately
    res.json({
      success: true,
      started: true,
      portals: selectedPortals,
      keywordsCount: keywords.length,
      message: `Tender247 Ingestion Engine active for ${selectedPortals.join(', ')}`,
    });

    // Execute background 3-channel ingestion pipeline asynchronously
    (async () => {
      try {
        // Channel 1: Ingest B2B External Tender Feeds
        const externalBids = await fetchExternalTenderFeeds(keywords);
        for (const bid of externalBids) {
          totalScraped++;
          const evalRes = evaluate(bid);
          await saveBid({
            ...bid,
            shortlisted: evalRes.shortlisted,
            verdict: evalRes.verdict,
            guidanceNotes: evalRes.guidanceNotes,
            emdExempted: evalRes.emdExempted,
          });
          if (evalRes.shortlisted) shortlistedCount++;
        }

        // Channel 2 & 3: Direct Session API + Multi-Portal Browser Ingestion
        for (const targetPortal of selectedPortals) {
          // Direct WAF Session API Ingestion
          await fetchDirectPortalApi(targetPortal, keywords, async (bid) => {
            totalScraped++;
            const evalRes = evaluate(bid);
            await saveBid({
              ...bid,
              shortlisted: evalRes.shortlisted,
              verdict: evalRes.verdict,
              guidanceNotes: evalRes.guidanceNotes,
              emdExempted: evalRes.emdExempted,
            });
            if (evalRes.shortlisted) shortlistedCount++;

            scrapeProgress.totalScraped = totalScraped;
            scrapeProgress.shortlistedCount = shortlistedCount;
          });

          // Multi-Worker In-Browser Page Fetching
          await scrapeMultiPortalsByKeywords(
            [targetPortal],
            keywords,
            async (bid) => {
              totalScraped++;
              const evalRes = evaluate(bid);
              await saveBid({
                ...bid,
                shortlisted: evalRes.shortlisted,
                verdict: evalRes.verdict,
                guidanceNotes: evalRes.guidanceNotes,
                emdExempted: evalRes.emdExempted,
              });
              if (evalRes.shortlisted) shortlistedCount++;

              scrapeProgress.totalScraped = totalScraped;
              scrapeProgress.shortlistedCount = shortlistedCount;
            },
            (info) => {
              scrapeProgress.currentKeyword = info.currentKeyword;
              scrapeProgress.currentIndex = info.currentIndex;
              scrapeProgress.totalKeywords = info.totalKeywords;
              scrapeProgress.remainingKeywords = info.remainingKeywords;
              if (info.currentPortal) scrapeProgress.currentPortal = info.currentPortal;
            }
          );
        }
      } catch (err: any) {
        console.error('Background Tender247 ingestion engine error:', err.message);
      } finally {
        scrapeProgress.isScraping = false;
        scrapeProgress.currentKeyword = '';
        scrapeProgress.remainingKeywords = 0;
        console.log(`Tender247 ingestion pipeline finished — total: ${totalScraped}, shortlisted: ${shortlistedCount}`);
      }
    })();
  } catch (err: any) {
    scrapeProgress.isScraping = false;
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /shortlisted — return shortlisted bids with optional portal filter
app.get('/shortlisted', async (req, res) => {
  try {
    const portal = req.query.portal as string | undefined;
    const bids = await getShortlisted(portal);
    res.json({ success: true, data: bids });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /clear — wipe all data
app.delete('/clear', async (_req, res) => {
  try {
    await clearAll();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
