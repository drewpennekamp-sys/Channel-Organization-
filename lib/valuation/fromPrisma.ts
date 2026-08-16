import type { Sale } from '@prisma/client';
import type { ScoringSale } from './types';

/** Adapts a Prisma `Sale` row to the scorer's minimal input shape. */
export function toScoringSale(sale: Sale): ScoringSale {
  return {
    id: sale.id,
    price: sale.price,
    saleDate: sale.saleDate,
    grade: sale.grade,
  };
}
