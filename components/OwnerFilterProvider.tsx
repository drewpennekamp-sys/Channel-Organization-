'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { OwnerView } from '@/lib/types';

const STORAGE_KEY = 'sf:ownerView';

const OwnerFilterContext = createContext<{
  view: OwnerView;
  setView: (view: OwnerView) => void;
} | null>(null);

export function OwnerFilterProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<OwnerView>('all');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'you' || stored === 'friend' || stored === 'all') {
      setViewState(stored);
    }
  }, []);

  function setView(next: OwnerView) {
    setViewState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <OwnerFilterContext.Provider value={{ view, setView }}>{children}</OwnerFilterContext.Provider>
  );
}

export function useOwnerFilter() {
  const ctx = useContext(OwnerFilterContext);
  if (!ctx) throw new Error('useOwnerFilter must be used within OwnerFilterProvider');
  return ctx;
}

export function matchesOwnerView(owner: 'you' | 'friend', view: OwnerView): boolean {
  return view === 'all' || owner === view;
}
