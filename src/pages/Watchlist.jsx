import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Plus, Trash2, TrendingUp, TrendingDown, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { fetchMultiQuote } from '../components/marketData';
import { Link } from 'react-router-dom';
import MiniChart from '../components/dashboard/MiniChart';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useUserPrefs } from '@/lib/useUserPrefs';
import AssetSearchDialog from '../components/shared/AssetSearchDialog';

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
  const [orderedList, setOrderedList] = useState([]);

  const { watchlist, isLoading: prefsLoading, addToWatchlist, removeFromWatchlist, reorderWatchlist } = useUserPrefs();

  useEffect(() => {
    if (watchlist.length) {
      setOrderedList([...watchlist].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
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

  const isLoading = prefsLoading || (symbols.length > 0 && pricesLoading);

  const handleAdd = (asset) => {
    addToWatchlist.mutate(
      { symbol: asset.symbol, name: asset.name, asset_type: asset.asset_type },
      {
        onSuccess: () => toast.success(`${asset.symbol} added to watchlist`),
        onError: (err) => toast.error('Failed to add: ' + (err?.message || 'Unknown error')),
      }
    );
  };

  const onDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const newList = Array.from(orderedList);
    const [moved] = newList.splice(result.source.index, 1);
    newList.splice(result.destination.index, 0, moved);
    setOrderedList(newList);
    await reorderWatchlist(newList);
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

                          <button onClick={() => removeFromWatchlist.mutate(item.symbol)}
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

      <AssetSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleAdd}
        existingSymbols={orderedList.map(w => w.symbol)}
        title="Add to Watchlist"
      />
    </div>
  );
}