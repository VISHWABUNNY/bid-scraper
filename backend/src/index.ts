import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { scrapeGemByKeywords } from './scraper';
import { evaluate } from './evaluator';
import { saveBid, getShortlisted, clearAll } from './db';
import { loadKeywords } from './keywords';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// POST /run — scrape GeM across ALL keywords in Search keywords.md
app.post('/run', async (_req, res) => {
  try {
    const keywords = loadKeywords();
    console.log(`Starting full scrape for ALL ${keywords.length} keywords...`);
    let totalScraped = 0;
    let shortlistedCount = 0;

    await scrapeGemByKeywords(keywords, async (bid) => {
      totalScraped++;
      const { shortlisted } = evaluate(bid);
      await saveBid({ ...bid, shortlisted });
      if (shortlisted) shortlistedCount++;
    });

    res.json({ success: true, total: totalScraped, shortlisted: shortlistedCount, keywordsCount: keywords.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /shortlisted — return all shortlisted bids
app.get('/shortlisted', async (_req, res) => {
  try {
    const bids = await getShortlisted();
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
