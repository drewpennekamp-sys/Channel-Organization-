import type { Card } from '@prisma/client';
import type { PriceSource, RawSale } from './types';

/** Thrown by stubbed-out functionality that isn't built yet. */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Placeholder for a future paid card-data API. Not built yet — AgentSource
 * is the only retrieval path for now. Kept as a real class (not just a
 * comment) so the `PriceSource` interface has a second implementation to
 * type-check against, per the build spec.
 */
export class ApiSource implements PriceSource {
  readonly name = 'api';

  async fetchSales(_card: Card, _grade: string): Promise<RawSale[]> {
    throw new NotImplementedError(
      'ApiSource is not implemented. Use AgentSource, or implement this against a real card-data API.',
    );
  }
}
