import type { DashboardEntryDTO } from './types';
import { getDashboardState } from './dashboard';

export interface TodayChecklist {
  needsIdea: DashboardEntryDTO[];
  ideaNotPosted: DashboardEntryDTO[];
  posted: DashboardEntryDTO[];
}

export function computeTodayChecklist(entries: DashboardEntryDTO[]): TodayChecklist {
  const needsIdea: DashboardEntryDTO[] = [];
  const ideaNotPosted: DashboardEntryDTO[] = [];
  const posted: DashboardEntryDTO[] = [];

  for (const entry of entries) {
    const state = getDashboardState(entry.plan);
    if (state === 'no-idea') needsIdea.push(entry);
    else if (state === 'idea') ideaNotPosted.push(entry);
    else posted.push(entry);
  }

  return { needsIdea, ideaNotPosted, posted };
}
