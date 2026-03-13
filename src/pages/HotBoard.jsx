import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Zap, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchHotBoard } from '../components/marketData';
import MiniChart from '../components/dashboard/MiniChart';

const filters = ['All', 'Stocks', 'Crypto'];
const sortOptions = ['AI Score', 'Change %'];

function getSignalStyle(signal) {
  if (signal === 'Strong Buy') return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  if (signal === 'Buy') return 'bg-green-500/12 text-green-400 border-green-500/15';
  if (signal === 'Hold') return 'bg-amber-500/12 text-amber-400 border-amber-500/15';
  if (signal === 'Sell') return 'bg-red-500/12 text-red-400 border-red-500/15';
  return 'bg-rose-500/15 text-rose-400 border-rose-500/20';
}

function getAiScoreColor(score) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-rose-400';
}

export default function HotBoard() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [sortBy, setSortBy] = useState('AI Score');

  const { data: allTickers, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['hotBoard'],
    queryFn: fetchHotBoard,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const filtered = (allTickers || [])
    .filter(t => {
      if (activeFilter === 'Stocks') return t.category === 'stock';
      if (activeFilter === 'Crypto') return t.category === 'crypto';
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'AI Score') return b.aiScore - a.aiScore;
      if (sortBy === 'Change %') return parseFloat(b.change) - parseFloat(a.change);
      return 0;
    });

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Flame className="w-6 h-6 text-orange-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Hot Board</h1>
          </div>
          <p className="text-sm text-white/30">AI-ranked trending assets by signal strength • Live</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-xl glass glass-hover transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {filters.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === f ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'glass text-white/40 hover:text-white/60'
              }`}
            >{f}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {sortOptions.map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                sortBy === s ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'
              }`}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* Ticker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
              <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="w-12 h-8 bg-white/5 rounded animate-pulse" />
              <div className="space-y-1.5 text-right">
                <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-12 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map((ticker, i) => (
              <motion.div key={ticker.symbol}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                layout
              >
                <Link to={`/Asset?symbol=${ticker.symbol}`}
                  className="glass rounded-2xl p-4 flex items-center gap-4 glass-hover transition-all group block"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-white/30">#{i + 1}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-violet-300">{ticker.symbol.slice(0,2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">{ticker.symbol}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSignalStyle(ticker.signal)}`}>
                        {ticker.signal}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/25 mt-0.5">{ticker.name} • {ticker.sector}</div>
                  </div>
                  <div className="hidden sm:block">
                    <MiniChart positive={ticker.positive} />
                  </div>
                  <div className="text-center flex-shrink-0">
                    <div className={`text-lg font-bold ${getAiScoreColor(ticker.aiScore)}`}>{ticker.aiScore}</div>
                    <div className="text-[9px] text-white/20 font-medium">AI Score</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-white">${ticker.price}</div>
                    <div className={`text-xs font-semibold ${ticker.positive ? 'text-gain' : 'text-loss'}`}>
                      {ticker.change}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Affiliate CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-6 text-center border border-violet-500/10"
      >
        <Zap className="w-8 h-8 text-violet-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Start Trading These Signals</h3>
        <p className="text-xs text-white/30 mb-4 max-w-md mx-auto">
          Connect to ZuluTrade and copy top traders' strategies automatically. AI-powered, hands-free trading.
        </p>
        <a href="https://www.zulutrade.com" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start Copy Trading <TrendingUp className="w-4 h-4" />
        </a>
      </motion.div>
    </div>
  );
}