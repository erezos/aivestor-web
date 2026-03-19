import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, Search, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchMultiQuote } from '../components/marketData';
import { Link } from 'react-router-dom';
import MiniChart from '../components/dashboard/MiniChart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getDeviceId } from '@/lib/useDeviceId';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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

function getMarketSession() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin  = now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay();
  const totalMin = utcHour * 60 + utcMin;
  const estMin = ((totalMin - 5 * 60) + 1440) % 1440;
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'closed';
  if (estMin >= 240 && estMin < 570)  return 'pre';
  if (estMin >= 570 && estMin < 960)  return 'open';
  if (estMin >= 960 && estMin < 1200) return 'after';
  return 'closed';
}

function MarketSessionBadge() {
  const session = getMarketSession();
  if (session === 'open') return null;
  const cfg = {
    pre:    { label: 'Pre-Market',    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
    after:  { label: 'After-Hours',   cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    closed: { label: 'Market Closed', cls: 'bg-white/5 text-white/30 border-white/10' },
  }[session];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1 opacity-70" />
      {cfg.label}
    </span>
  );
}

export default function Watchlist() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderedList, setOrderedList] = useState([]);
  const queryClient = useQueryClient();
  const deviceId = getDeviceId();

  const { data: watchlist = [], isLoading: watchlistLoading } = useQuery({
    queryKey: ['watchlist', deviceId],
    queryFn: () => base44.entities.Watchlist.filter({ device_id: deviceId }, 'sort_order'),
  });

  useEffect(() => {
    if (watchlist.length) {
      const sorted = [...watchlist].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      setOrderedList(sorted);
    } else {
      setOrderedList([]);
    }
  }, [watchlist]);

  const symbols = orderedList.map(w => w.symbol);
  const { data: prices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['multiQuote', symbols.join(',')],
    queryFn: () => fetchMultiQuote(symbols),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = watchlistLoading || (symbols.length > 0 && pricesLoading);

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.Watchlist.create({
      ...data,
      device_id: deviceId,
      sort_order: (orderedList.length > 0 ? Math.max(...orderedList.map(w => w.sort_order ?? 0)) : 0) + 1,
    }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      setDialogOpen(false);
      setSearchQuery('');
      toast.success(`${variables.symbol} added to watchlist`);
    },
    onError: (err) => toast.error('Failed to add: ' + (err?.message || 'Unknown error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Watchlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success('Removed from watchlist');
    },
  });

  const [customLoading, setCustomLoading] = useState(false);

  const filteredSymbols = POPULAR_SYMBOLS.filter(s =>
    !orderedList.some(w => w.symbol === s.symbol) &&
    (s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || s.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const trimmed = searchQuery.trim().toUpperCase();
  const alreadyInWatchlist = orderedList.some(w => w.symbol === trimmed);
  const showCustomAdd = trimmed.length >= 1 && filteredSymbols.length === 0 && !alreadyInWatchlist;

  const addCustomSymbol = async () => {
    if (!trimmed) return;
    setCustomLoading(true);
    let name = trimmed, asset_type = 'stock';
    try {
      const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols: [trimmed] });
      const info = res.data?.[trimmed];
      if (info?.name) name = info.name;
      if (['BTC','ETH','SOL','XRP','DOGE','ADA','DOT'].includes(trimmed) || trimmed.endsWith('-USD')) asset_type = 'crypto';
    } catch {}
    addMutation.mutate({ symbol: trimmed, name, asset_type });
    setCustomLoading(false);
  };

  const onDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const newList = Array.from(orderedList);
    const [moved] = newList.splice(result.source.index, 1);
    newList.splice(result.destination.index, 0, moved);
    setOrderedList(newList);
    await Promise.all(
      newList.map((item, idx) =>
        base44.entities.Watchlist.update(item.id, { sort_order: idx + 1 })
      )
    );
    queryClient.invalidateQueries({ queryKey: ['watchlist'] });
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <Star className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Watchlist</h1>
            <MarketSessionBadge />
          </div>
          <p className="text-sm text-white/30">Track your favorite assets • Drag to reorder</p>
        </div>
        <button onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Add Asset
        </button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse" />)}
        </div>
      ) : orderedList.length === 0 ? (
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
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="watchlist">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                {orderedList.map((item, i) => {
                  const q = prices[item.symbol];
                  return (
                    <Draggable key={item.id} draggableId={item.id} index={i}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          className={`glass rounded-2xl p-4 flex items-center gap-3 transition-all group ${snapshot.isDragging ? 'shadow-2xl border-violet-500/30 scale-[1.01]' : 'glass-hover'}`}
                        >
                          <div {...drag.dragHandleProps} className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors flex-shrink-0 touch-none">
                            <GripVertical className="w-4 h-4" />
                          </div>

                          <Link to={`/Asset?symbol=${item.symbol}`} className="flex items-center gap-3 flex-1 min-w-0">
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
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

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
                    {isAdding ? <Loader2 className="w-4 h-4 text-violet-400 animate-spin" /> : <Plus className="w-4 h-4 text-white/30" />}
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
                  {customLoading || addMutation.isPending
                    ? <div className="w-4 h-4 border border-white/20 border-t-violet-400 rounded-full animate-spin" />
                    : <Plus className="w-4 h-4 text-violet-400" />}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}