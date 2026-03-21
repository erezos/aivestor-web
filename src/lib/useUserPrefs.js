/**
 * useUserPrefs — Single-document user data store.
 *
 * Architecture:
 *   ONE UserPreferences record per user (matched by created_by = user.email).
 *   Watchlist and Portfolio are embedded JSON arrays inside that document.
 *
 * Benefits vs row-per-item:
 *   - 1 DB read fetches everything (watchlist + portfolio)
 *   - Mobile app reads a single record per user
 *   - Cross-device (tied to auth, not localStorage)
 *   - Scales to millions of users cheaply
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useState, useEffect } from 'react';

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getOrCreatePrefs() {
  const user = await base44.auth.me();
  if (!user) return null;
  const rows = await base44.entities.UserPreferences.filter({ created_by: user.email });
  if (rows.length > 0) return rows[0];
  return base44.entities.UserPreferences.create({ watchlist: [], portfolio: [] });
}

export function useUserPrefs() {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ['userPrefs'],
    queryFn: getOrCreatePrefs,
    staleTime: 60 * 1000,
  });

  const savePrefs = async (patch) => {
    if (!prefs?.id) return;
    const updated = await base44.entities.UserPreferences.update(prefs.id, patch);
    queryClient.setQueryData(['userPrefs'], updated);
    return updated;
  };

  // ─── Watchlist ────────────────────────────────────────────────────────────

  const watchlist = prefs?.watchlist ?? [];

  const addToWatchlist = useMutation({
    mutationFn: async ({ symbol, name, asset_type }) => {
      if (watchlist.some(w => w.symbol === symbol)) return;
      const newItem = { id: generateId(), symbol, name, asset_type, sort_order: watchlist.length + 1 };
      return savePrefs({ watchlist: [...watchlist, newItem] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userPrefs'] }),
  });

  const removeFromWatchlist = useMutation({
    mutationFn: async (symbol) => {
      return savePrefs({ watchlist: watchlist.filter(w => w.symbol !== symbol) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userPrefs'] }),
  });

  const reorderWatchlist = async (newList) => {
    const reindexed = newList.map((item, idx) => ({ ...item, sort_order: idx + 1 }));
    return savePrefs({ watchlist: reindexed });
  };

  // ─── Portfolio ────────────────────────────────────────────────────────────

  const portfolio = prefs?.portfolio ?? [];

  const addToPortfolio = useMutation({
    mutationFn: async ({ symbol, name, asset_type, quantity, buy_price }) => {
      const newItem = { id: generateId(), symbol, name, asset_type, quantity, buy_price };
      return savePrefs({ portfolio: [...portfolio, newItem] });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userPrefs'] }),
  });

  const updatePortfolioItem = useMutation({
    mutationFn: async ({ id, quantity, buy_price }) => {
      const updated = portfolio.map(h => h.id === id ? { ...h, quantity, buy_price } : h);
      return savePrefs({ portfolio: updated });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userPrefs'] }),
  });

  const removeFromPortfolio = useMutation({
    mutationFn: async (id) => {
      return savePrefs({ portfolio: portfolio.filter(h => h.id !== id) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userPrefs'] }),
  });

  return {
    prefs,
    isLoading,
    // Watchlist
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlist,
    // Portfolio
    portfolio,
    addToPortfolio,
    updatePortfolioItem,
    removeFromPortfolio,
    // Generic patch (for xp, streak, etc.)
    savePrefs,
  };
}