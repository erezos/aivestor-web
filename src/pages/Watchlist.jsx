import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMultiQuote } from '../components/marketData';
import { Link } from 'react-router-dom';
import AssetSearchDialog from '../components/shared/AssetSearchDialog';
import { useUserPrefs } from '@/lib/useUserPrefs';

export default function Watchlist() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { watchlist, isLoading: prefsLoading, addToWatchlist, removeFromWatchlist } = useUserPrefs();

  const symbols = watchlist.map(w => w.symbol);
  const { data: prices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['multiQuote', symbols.join(',')],
    queryFn: () => fetchMultiQuote(symbols),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = prefsLoading || (symbols.length > 0 && pricesLoading);

  const enriched = watchlist.map(w => {
    const q = prices[w.symbol];
    return { ...w, price: q?.price, pct: q?.pct ?? 0, positive: (q?.pct ?? 0) >= 0 };
  });

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Watchlist</h1>
          </div>
          <p className="text-sm text-white/30">Track your favourite assets in real-time</p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="glass rounded-2xl h-16 animate-pulse" />)}
        </div>
      ) : watchlist.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-14 text-center border border-dashed border-white/10"
        >
          <Star className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white/50 mb-1">No assets yet</h3>
          <p className="text-sm text-white/25 mb-5">Add stocks or crypto to watch their prices</p>
          <button onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Add First Asset
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {enriched.map((w, i) => (
              <motion.div key={w.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-2xl p-4 flex items-center gap-3"
              >
                <Link to={`/Asset?symbol=${w.symbol}`}
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0"
                >
                  <span className="text-xs font-bold text-violet-300">{w.symbol.slice(0, 2)}</span>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/Asset?symbol=${w.symbol}`} className="text-sm font-bold text-white hover:text-violet-300 transition-colors">
                    {w.symbol}
                  </Link>
                  <div className="text-[11px] text-white/30 truncate">{w.name}</div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-white">
                    {w.price != null ? `$${w.price.toLocaleString()}` : '—'}
                  </span>
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${w.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {w.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {w.pct >= 0 ? '+' : ''}{w.pct.toFixed(2)}%
                  </span>
                </div>
                <button onClick={() => removeFromWatchlist.mutate(w.symbol)}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-rose-400 transition-all ml-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AssetSearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={(asset) => addToWatchlist.mutate(asset)}
        existingSymbols={symbols}
        title="Add to Watchlist"
      />
    </div>
  );
}