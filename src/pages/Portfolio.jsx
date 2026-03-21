import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PieChart, Plus, Trash2, TrendingUp, TrendingDown, Edit3, Check, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMultiQuote } from '../components/marketData';
import { Link } from 'react-router-dom';
import AddAssetDialog from '../components/portfolio/AddAssetDialog';
import PortfolioSummary from '../components/portfolio/PortfolioSummary';
import AssetSearchDialog from '../components/shared/AssetSearchDialog';
import { useUserPrefs } from '@/lib/useUserPrefs';

export default function Portfolio() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const { portfolio, isLoading: prefsLoading, addToPortfolio, updatePortfolioItem, removeFromPortfolio } = useUserPrefs();

  const symbols = [...new Set(portfolio.map(h => h.symbol))];
  const { data: prices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['multiQuote', symbols.join(',')],
    queryFn: () => fetchMultiQuote(symbols),
    enabled: symbols.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = prefsLoading || (symbols.length > 0 && pricesLoading);

  const enriched = portfolio.map(h => {
    const q = prices[h.symbol];
    const currentPrice = q?.price ?? 0;
    const totalCost = h.quantity * h.buy_price;
    const currentValue = h.quantity * currentPrice;
    const pnl = currentValue - totalCost;
    const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
    return { ...h, currentPrice, currentValue, totalCost, pnl, pnlPct, pct: q?.pct ?? 0, positive: (q?.pct ?? 0) >= 0 };
  });

  const startEdit = (h) => {
    setEditingId(h.id);
    setEditForm({ quantity: h.quantity, buy_price: h.buy_price });
  };

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <PieChart className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Portfolio</h1>
          </div>
          <p className="text-sm text-white/30">Track your investments with live P&L</p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
        >
          <Plus className="w-4 h-4" /> Add Position
        </button>
      </motion.div>

      <PortfolioSummary enriched={enriched} isLoading={isLoading} />

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : portfolio.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass rounded-2xl p-14 text-center border border-dashed border-white/10"
        >
          <PieChart className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white/50 mb-1">No positions yet</h3>
          <p className="text-sm text-white/25 mb-5">Add your first investment to track performance</p>
          <button onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" /> Add First Position
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {enriched.map((h, i) => (
              <motion.div key={h.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -80 }}
                transition={{ delay: i * 0.04 }}
                className="glass rounded-2xl p-4"
              >
                {editingId === h.id ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-300">{h.symbol.slice(0,2)}</span>
                    </div>
                    <span className="text-sm font-bold text-white w-16">{h.symbol}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-white/30">Qty</span>
                        <input
                          type="number" value={editForm.quantity} step="any"
                          onChange={e => setEditForm(f => ({...f, quantity: e.target.value}))}
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-white/30">Buy Price $</span>
                        <input
                          type="number" value={editForm.buy_price} step="any"
                          onChange={e => setEditForm(f => ({...f, buy_price: e.target.value}))}
                          className="w-28 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 ml-auto">
                      <button onClick={() => updatePortfolioItem.mutate({ id: h.id, quantity: parseFloat(editForm.quantity), buy_price: parseFloat(editForm.buy_price) }, { onSuccess: () => setEditingId(null) })}
                        className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-all">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-2 rounded-lg hover:bg-white/5 text-white/30 transition-all">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Link to={`/Asset?symbol=${h.symbol}`} className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-violet-300">{h.symbol.slice(0,2)}</span>
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link to={`/Asset?symbol=${h.symbol}`} className="text-sm font-bold text-white hover:text-violet-300 transition-colors">{h.symbol}</Link>
                        <span className="text-[10px] text-white/25">{h.name}</span>
                      </div>
                      <div className="text-[11px] text-white/30 mt-0.5">
                        {h.quantity} units · avg ${h.buy_price.toLocaleString()}
                      </div>
                    </div>

                    <div className="hidden sm:flex flex-col items-end">
                      <span className="text-[10px] text-white/25">Today</span>
                      <span className={`text-xs font-semibold flex items-center gap-0.5 ${h.positive ? 'text-gain' : 'text-loss'}`}>
                        {h.positive ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                        {h.pct >= 0 ? '+' : ''}{h.pct.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-white">${h.currentValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                      <span className="text-[10px] text-white/30">${h.currentPrice.toLocaleString()}/unit</span>
                    </div>

                    <div className={`flex flex-col items-end min-w-[64px] px-2 py-1 rounded-lg ${h.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      <span className={`text-xs font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnl >= 0 ? '+' : ''}${Math.abs(h.pnl).toLocaleString('en-US', {maximumFractionDigits: 2})}
                      </span>
                      <span className={`text-[10px] font-semibold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%
                      </span>
                    </div>

                    <div className="flex gap-1">
                      <button onClick={() => startEdit(h)} className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-violet-400 transition-all">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeFromPortfolio.mutate(h.id)} className="p-2 rounded-lg hover:bg-white/5 text-white/20 hover:text-rose-400 transition-all">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AddAssetDialog open={addOpen} onClose={() => setAddOpen(false)} existingSymbols={portfolio.map(h => h.symbol)} onAdd={(data) => addToPortfolio.mutate(data, { onSuccess: () => setAddOpen(false) })} />
    </div>
  );
}