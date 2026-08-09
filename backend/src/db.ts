import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { GemBid } from './scraper';

const prisma = new PrismaClient();

interface StoredBidRecord {
  id: string;
  bidId: string;
  portal?: string;
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
  docText?: string | null;
  shortlisted: boolean;
  createdAt: string;
}

const STORE_PATH = path.resolve(__dirname, '../data/bids.json');
let cachedBids: Record<string, StoredBidRecord> | null = null;
let saveDebounceTimer: NodeJS.Timeout | null = null;
let isWritingDisk = false;

function loadBidsFromDisk(): Record<string, StoredBidRecord> {
  if (cachedBids) return cachedBids;

  try {
    if (!fs.existsSync(STORE_PATH)) {
      cachedBids = {};
      return cachedBids;
    }

    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    cachedBids = JSON.parse(raw) as Record<string, StoredBidRecord>;
  } catch {
    cachedBids = {};
  }

  return cachedBids;
}

// Non-blocking debounced asynchronous disk persistence
function scheduleDiskPersist(bids: Record<string, StoredBidRecord>) {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);

  saveDebounceTimer = setTimeout(async () => {
    if (isWritingDisk) return;
    isWritingDisk = true;
    try {
      await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
      await fs.promises.writeFile(STORE_PATH, JSON.stringify(bids, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[db] Async disk write error:', err.message);
    } finally {
      isWritingDisk = false;
    }
  }, 300);
}

async function fallbackSaveBid(bid: GemBid & { shortlisted: boolean; docText?: string }) {
  const store = loadBidsFromDisk();
  const existing = store[bid.bidId];
  const record: StoredBidRecord = {
    id: existing?.id || `${bid.bidId}-${Date.now()}`,
    bidId: bid.bidId,
    portal: bid.portal || 'GEM',
    title: bid.title,
    organisation: bid.organisation,
    departmentName: bid.departmentName ?? null,
    organisationName: bid.organisationName ?? null,
    itemCategory: bid.itemCategory ?? null,
    gemUrl: bid.gemUrl,
    value: bid.value,
    closingDate: bid.closingDate,
    bidOpeningDate: bid.bidOpeningDate ?? null,
    isMsme: bid.isMsme,
    isStartup: bid.isStartup,
    keyword: bid.keyword,
    docText: bid.docText ?? null,
    shortlisted: bid.shortlisted,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  store[bid.bidId] = record;
  cachedBids = store;
  scheduleDiskPersist(store);
  return record;
}

export async function saveBid(bid: GemBid & { shortlisted: boolean; docText?: string }) {
  try {
    await prisma.bid.upsert({
      where: { bidId: bid.bidId },
      update: {
        portal: bid.portal || 'GEM',
        shortlisted: bid.shortlisted,
        docText: bid.docText ?? null,
        departmentName: bid.departmentName ?? null,
        organisationName: bid.organisationName ?? null,
        itemCategory: bid.itemCategory ?? null,
        bidOpeningDate: bid.bidOpeningDate ?? null,
      },
      create: {
        bidId: bid.bidId,
        portal: bid.portal || 'GEM',
        title: bid.title,
        organisation: bid.organisation,
        departmentName: bid.departmentName ?? null,
        organisationName: bid.organisationName ?? null,
        itemCategory: bid.itemCategory ?? null,
        gemUrl: bid.gemUrl,
        value: bid.value,
        closingDate: bid.closingDate,
        bidOpeningDate: bid.bidOpeningDate ?? null,
        isMsme: bid.isMsme,
        isStartup: bid.isStartup,
        keyword: bid.keyword,
        docText: bid.docText ?? null,
        shortlisted: bid.shortlisted,
      },
    });
  } catch {
    await fallbackSaveBid(bid);
  }
}

export async function getShortlisted(portal?: string) {
  try {
    const whereClause: any = { shortlisted: true };
    if (portal && portal !== 'ALL') {
      whereClause.portal = portal;
    }
    return await prisma.bid.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    return Object.values(loadBidsFromDisk())
      .filter((bid) => bid.shortlisted && (!portal || portal === 'ALL' || (bid.portal || 'GEM') === portal))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export async function clearAll() {
  try {
    await prisma.bid.deleteMany();
  } catch {
    // Ignore if Prisma offline
  }

  cachedBids = {};
  scheduleDiskPersist({});
}

export { prisma };
