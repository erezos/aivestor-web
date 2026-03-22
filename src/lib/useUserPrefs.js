/**
 * useUserPrefs — Watchlist stored in localStorage.
 *
 * Architecture:
 *   Watchlist lives entirely in localStorage, keyed by 'aivestor_watchlist'.
 *   This means:
 *   - Works for anonymous users (no auth required)
 *   - Zero DB reads/writes for watchlist
 *   - Instant reads/writes
 *   - Persists across sessions on the same device
 *
 * Trade-off: not cross-device synced (acceptable for now).
 */

import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'aivestor_watchlist';

// Fire-and-forget background sync to DB (analytics only, never blocks UX)
function shadowSync(list) {
  base44.auth.me().then(user => {
    if (!user) return; // anonymous — skip
    base44.functions.invoke('syncWatchlist', { items: list }).catch(() => {});
  }).catch(() => {});
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function useUserPrefs() {
  const [watchlist, setWatchlist] = useState(loadFromStorage);

  const persist = useCallback((list) => {
    setWatchlist(list);
    saveToStorage(list);
  }, []);

  const addToWatchlist = {
    mutate: ({ symbol, name, asset_type }) => {
      const current = loadFromStorage();
      if (current.some(w => w.symbol === symbol)) return;
      const updated = [...current, { symbol, name, asset_type, sort_order: current.length + 1 }];
      persist(updated);
    },
  };

  const removeFromWatchlist = {
    mutate: (symbol) => {
      const updated = loadFromStorage().filter(w => w.symbol !== symbol);
      persist(updated);
    },
  };

  const reorderWatchlist = (newList) => {
    const reindexed = newList.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    persist(reindexed);
  };

  return {
    prefs: null,
    isLoading: false,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlist,
    savePrefs: () => {},
  };
}