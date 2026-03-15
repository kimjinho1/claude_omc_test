import { PrismaClient } from '@prisma/client';
import kospi200 from './seed/kospi200.json';
import sp500 from './seed/sp500.json';
import qqq from './seed/qqq.json';

const prisma = new PrismaClient();

async function main() {
  // Build a deduplicated map by symbol, tagging index memberships
  const stockMap = new Map<string, { symbol: string; name: string; market: string; indexMembership: string[] }>();

  for (const s of kospi200) {
    stockMap.set(s.symbol, { ...s, indexMembership: ['KOSPI200'] });
  }

  for (const s of sp500) {
    if (stockMap.has(s.symbol)) {
      stockMap.get(s.symbol)!.indexMembership.push('SP500');
    } else {
      stockMap.set(s.symbol, { ...s, indexMembership: ['SP500'] });
    }
  }

  for (const s of qqq) {
    if (stockMap.has(s.symbol)) {
      stockMap.get(s.symbol)!.indexMembership.push('QQQ');
    } else {
      stockMap.set(s.symbol, { ...s, indexMembership: ['QQQ'] });
    }
  }

  let upserted = 0;
  for (const stock of stockMap.values()) {
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: { name: stock.name, market: stock.market, indexMembership: stock.indexMembership },
      create: { symbol: stock.symbol, name: stock.name, market: stock.market, indexMembership: stock.indexMembership },
    });
    upserted++;
  }

  console.log(`Seeded ${upserted} stocks`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
