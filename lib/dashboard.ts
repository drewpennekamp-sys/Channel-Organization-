import type { DailyPlanDTO, DashboardCardState } from './types';

export function getDashboardState(plan: DailyPlanDTO | null): DashboardCardState {
  if (!plan) return 'no-idea';
  if (plan.postStatus === 'posted') return 'posted';
  return 'idea';
}
