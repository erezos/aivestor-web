import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMultiQuote } from '../components/marketData';
import { Link } from 'react-router-dom';
import MiniChart from '../components/dashboard/MiniChart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const POPULAR_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com', type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', type: 'stock' },
  { symbol: 'AMD', name: 'AMD Inc', type: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', type: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', type: 'crypto' },
  { symbol: 'XRP', name: 'Ripple', type: 'crypto' },
];

export default function Watchlist() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: watchlist = [], isLoading: watchlistLoading } = useQuery({
    queryKey: ['watchlist', currentUser?.email],
    queryFn: () => base44.entities.Watchlist.filter({ created_by: currentUser.email }, '-created_date'),
    enabled: !!currentUser,
  });

  const symbols = watchlist.map(w => w.symbol);
  const { data: prices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['multiQuote', symbols.join(',')],
    queryFn: () => fetchMultiQuote(symbols),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = watchlistLoading || (symbols.length > 0 && pricesLoading);

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Watchlist.create(data),
    onSuccess: (_, variables) => {
      // Use prefix key so it matches regardless of whether currentUser is loaded
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setDialogOpen(false);
      setSearchQuery('');
      toast.success(`${variables.symbol} added to watchlist`);
    },
    onError: (err) => {
      toast.error('Failed to add asset: ' + (err?.message || 'Unknown error'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Watchlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success('Removed from watchlist');
    },
    onError: () => toast.error('Failed to remove asset'),
  });

  const [customLoading, setCustomLoading] = useState(false);

  const filteredSymbols = POPULAR_SYMBOLS.filter(s =>
    !watchlist.some(w => w.symbol === s.symbol) &&
    (s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const trimmed = searchQuery.trim().toUpperCase();
  const alreadyInWatchlist = watchlist.some(w => w.symbol === trimmed);
  const showCustomAdd = trimmed.length >= 1 && filteredSymbols.length === 0 && !alreadyInWatchlist;

  const addCustomSymbol = async () => {
    if (!trimmed) return;
    setCustomLoading(true);
    let name = trimmed;
    let asset_type = 'stock';
    try {
      const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols: [trimmed] });
      const info = res.data?.[trimmed];
      if (info?.name) name = info.name;
      if (['BTC','ETH','SOL','XRP','DOGE','ADA','DOT'].includes(trimmed) || trimmed.endsWith('-USD')) asset_type = 'crypto';
    } catch {}
    addMutation.mutate({ symbol: trimmed, name, asset_type });
    setCustomLoading(false);
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Star className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Watchlist</h1>
          </div>
          <p className="text-sm text-white/30">Track your favorite assets • Live prices</p>
        </div>
        <button onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </motion.div>

      {/* Watchlist Items */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse" />)}
        </div>
      ) : watchlist.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-14 text-center border border-dashed border-white/10"
        >
          <Star className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white/50 mb-1">No assets yet</h3>
          <p className="text-sm text-white/25 mb-5">Star any asset from its detail page, or add from here</p>
          <button onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Add Your First Asset
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {watchlist.map((item, i) => {
              const q = prices[item.symbol];
              return (
                <motion.div key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.04 }}
                  className="glass rounded-2xl p-4 flex items-center gap-4 glass-hover transition-all group"
                >
                  <Link to={`/Asset?symbol=${item.symbol}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-300">{item.symbol.slice(0,2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">{item.symbol}</div>
                      <div className="text-[11px] text-white/25">{item.name}</div>
                    </div>
                    <div className="hidden sm:block">
                      <MiniChart positive={q?.positive ?? true} />
                    </div>
                    <div className="text-right">
                      {q ? (
                        <>
                          <div className="text-sm font-bold text-white">${q.price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                          <div className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${q.positive ? 'text-gain' : 'text-loss'}`}>
                            {q.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {q.change}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-white/20">—</div>
                      )}
                    </div>
                  </Link>
                  <button onClick={() => deleteMutation.mutate(item.id)}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-rose-400 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#12121a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Add to Watchlist</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {filteredSymbols.map(s => {
                const isAdding = addMutation.isPending && addMutation.variables?.symbol === s.symbol;
                return (
                  <button key={s.symbol}
                    onClick={() => addMutation.mutate({ symbol: s.symbol, name: s.name, asset_type: s.type })}
                    disabled={addMutation.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-all disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-violet-300">{s.symbol.slice(0,2)}</span>
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-semibold">{s.symbol}</div>
                        <div className="text-[11px] text-white/30">{s.name}</div>
                      </div>
                    </div>
                    {isAdding
                      ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                      : <Plus className="w-4 h-4 text-white/30" />}
                  </button>
                );
              })}
              {filteredSymbols.length === 0 && !showCustomAdd && <p className="text-center text-white/30 text-sm py-6">No more symbols to add</p>}
              {showCustomAdd && (
                <button
                  onClick={addCustomSymbol}
                  disabled={customLoading || addMutation.isPending}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-dashed border-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-violet-300">{trimmed.slice(0,2)}</span>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-semibold">{trimmed}</div>
                      <div className="text-[11px] text-white/30">Add custom symbol</div>
                    </div>
                  </div>
                  {customLoading || addMutation.isPending ? (
                    <div className="w-4 h-4 border border-white/20 border-t-violet-400 rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 text-violet-400" />
                  )}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}