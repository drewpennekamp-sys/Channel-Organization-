import { getPortfolio } from '@/lib/portfolio';
import { CompsBoard } from '@/components/CompsBoard';

export const dynamic = 'force-dynamic';

export default async function CompsPage() {
  const copies = await getPortfolio();

  return (
    <section className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Comps</h1>
          <p className="page-desc">
            Search one card at a time, or run the whole collection — each search is bounded to stay fast, and results
            build up as you go. Nothing is ever estimated to fill a gap.
          </p>
        </div>
      </div>

      <CompsBoard copies={copies} />
    </section>
  );
}
