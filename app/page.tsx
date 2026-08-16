import Link from 'next/link';
import { prisma } from '@/lib/db';

// This page reads the collection straight from the DB on every request.
// Without this, Next.js statically prerenders it at build time and bakes
// in whatever was in the database then — the collection would never
// update after a fresh `npm run build`.
export const dynamic = 'force-dynamic';

function describeCard(card: {
  year: number;
  brand: string;
  set: string;
  subset: string;
  player: string;
  cardNumber: string;
  parallel: string;
  serialNumbering: string;
  isAuto: boolean;
  isRelic: boolean;
}): string {
  const parts = [`${card.year} ${card.brand} ${card.set}`.trim()];
  if (card.subset) parts.push(card.subset);
  parts.push(`— ${card.player}${card.cardNumber ? ` #${card.cardNumber}` : ''}`);
  const tags = [card.parallel, card.serialNumbering, card.isAuto ? 'AUTO' : '', card.isRelic ? 'RELIC' : '']
    .filter(Boolean)
    .join(' ');
  if (tags) parts.push(tags);
  return parts.join(' ');
}

export default async function CollectionPage() {
  const copies = await prisma.copyOwned.findMany({
    include: { card: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalPurchase = copies.reduce((sum, c) => sum + (c.purchasePrice ?? 0), 0);

  return (
    <main className="container max-w-3xl py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collection</h1>
          <p className="text-sm text-muted-foreground">
            {copies.length} card{copies.length === 1 ? '' : 's'}
            {totalPurchase > 0 ? ` · $${totalPurchase.toFixed(2)} total purchase price` : ''}
          </p>
        </div>
        <Link
          href="/add"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          + Add card
        </Link>
      </div>

      {copies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          <p className="mb-3">No cards yet.</p>
          <Link href="/add" className="text-sm font-medium text-primary underline">
            Add your first card
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {copies.map((copy) => (
            <li
              key={copy.id}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
            >
              {copy.frontImagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={copy.frontImagePath}
                  alt={describeCard(copy.card)}
                  className="h-16 w-16 flex-shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md bg-secondary text-2xl">
                  🃏
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{describeCard(copy.card)}</p>
                <p className="text-xs text-muted-foreground">
                  {copy.grade}
                  {copy.certNumber ? ` · cert ${copy.certNumber}` : ''}
                  {copy.purchasePrice != null ? ` · bought $${copy.purchasePrice.toFixed(2)}` : ''}
                </p>
              </div>
              <div className="flex-shrink-0 text-right text-xs text-muted-foreground">
                Not yet valued
                <br />
                <span className="text-[11px]">run `npm run comp`</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
