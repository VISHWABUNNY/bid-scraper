import { PrismaClient } from '@prisma/client';
import { GemBid } from './scraper';

const prisma = new PrismaClient();

export async function saveBid(bid: GemBid & { shortlisted: boolean; docText?: string }) {
  await prisma.bid.upsert({
    where: { bidId: bid.bidId },
    update: {
      shortlisted: bid.shortlisted,
      docText: bid.docText ?? null,
    },
    create: {
      bidId: bid.bidId,
      title: bid.title,
      organisation: bid.organisation,
      gemUrl: bid.gemUrl,
      value: bid.value,
      closingDate: bid.closingDate,
      isMsme: bid.isMsme,
      isStartup: bid.isStartup,
      keyword: bid.keyword,
      docText: bid.docText ?? null,
      shortlisted: bid.shortlisted,
    },
  });
}

export async function getShortlisted() {
  return prisma.bid.findMany({
    where: { shortlisted: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function clearAll() {
  await prisma.bid.deleteMany();
}

export { prisma };
