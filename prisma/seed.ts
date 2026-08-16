/**
 * Seed script. Creates a handful of Card + CopyOwned rows so the schema
 * and comp-scoring function have something real to run against locally.
 * Includes the end-to-end test fixture from the build spec: a thin-market
 * card that should legitimately come back `sufficient: false` once
 * AgentSource is wired up in M2.
 *
 * Sale/Valuation rows are NOT seeded here — those only ever come from a
 * real retrieval (AgentSource, M2) or the deterministic scorer run against
 * retrieved Sale rows. Seeding fabricated sales would violate the "never
 * invent a price" rule the whole project is built around.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const burries = await prisma.card.upsert({
    where: {
      cardIdentity: {
        year: 2025,
        brand: 'Topps',
        set: "Chrome McDonald's All American",
        subset: '',
        player: 'Brayden Burries',
        cardNumber: 'EA-BB',
        parallel: '',
        serialNumbering: '',
        isAuto: true,
        isRelic: false,
        sport: 'Basketball',
      },
    },
    update: {},
    create: {
      year: 2025,
      brand: 'Topps',
      set: "Chrome McDonald's All American",
      subset: '',
      player: 'Brayden Burries',
      cardNumber: 'EA-BB',
      parallel: '',
      serialNumbering: '',
      isAuto: true,
      isRelic: false,
      sport: 'Basketball',
    },
  });

  await prisma.copyOwned.upsert({
    where: { id: 'seed-copy-burries-raw' },
    update: {},
    create: {
      id: 'seed-copy-burries-raw',
      cardId: burries.id,
      grade: 'RAW',
      notes: 'End-to-end test fixture — thin market, expect sufficient: false.',
    },
  });

  const wembyBase = await prisma.card.upsert({
    where: {
      cardIdentity: {
        year: 2023,
        brand: 'Panini',
        set: 'Prizm',
        subset: '',
        player: 'Victor Wembanyama',
        cardNumber: '1',
        parallel: 'Base',
        serialNumbering: '',
        isAuto: false,
        isRelic: false,
        sport: 'Basketball',
      },
    },
    update: {},
    create: {
      year: 2023,
      brand: 'Panini',
      set: 'Prizm',
      subset: '',
      player: 'Victor Wembanyama',
      cardNumber: '1',
      parallel: 'Base',
      serialNumbering: '',
      isAuto: false,
      isRelic: false,
      sport: 'Basketball',
    },
  });

  await prisma.copyOwned.upsert({
    where: { id: 'seed-copy-wemby-psa10' },
    update: {},
    create: {
      id: 'seed-copy-wemby-psa10',
      cardId: wembyBase.id,
      grade: 'PSA 10',
      certNumber: '00000000',
      purchasePrice: 180,
      purchaseDate: new Date('2024-01-15'),
      notes: 'Seed example — liquid market, expect sufficient: true once comps are retrieved.',
    },
  });

  console.log(`Seeded ${await prisma.card.count()} cards, ${await prisma.copyOwned.count()} owned copies.`);
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
