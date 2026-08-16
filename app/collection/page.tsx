import Link from 'next/link';
import { getPortfolio } from '@/lib/portfolio';
import { CollectionGrid } from '@/components/CollectionGrid';

export const dynamic = 'force-dynamic';

export default async function CollectionPage() {
  const copies = await getPortfolio();
  const totalPurchase = copies.reduce((sum, c) => sum + (c.purchasePrice ?? 0), 0);

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Collection</h1>
          <p className="page-desc">
            {copies.length} card{copies.length === 1 ? '' : 's'}
            {totalPurchase > 0 ? ` · $${totalPurchase.toFixed(2)} total paid` : ''}
          </p>
        </div>
        <Link href="/add" className="btn btn-primary">
          + Add card
        </Link>
      </div>

      {copies.length === 0 ? (
        <div className="panel">
          <div className="empty-note">
            No cards yet.{' '}
            <Link href="/add" style={{ color: 'var(--accent)', fontWeight: 700 }}>
              Add your first card
            </Link>
            .
          </div>
        </div>
      ) : (
        <CollectionGrid copies={copies} />
      )}
    </section>
  );
}
