import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Filter, Sparkles, BarChart3, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import MiniChart from '../components/dashboard/MiniChart';

const ALL_TICKERS = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: '892.45', change: '+5.67%', positive: true, signal: 'Strong Buy', category: 'stock', sector: 'Tech', rsi: 72, volume: '89.2M', aiScore: 94 },
  { symbol: 'TSLA', name: 'Tesla Inc', price: '248.32', change: '+3.21%', positive: true, signal: 'Buy', category: 'stock', sector: 'Auto', rsi: 65, volume: '124.5M', aiScore: 82 },
  { symbol: 'AAPL', name: 'Apple Inc', price: '198.76', change: '+1.45%', positive: true, signal: 'Hold', category: 'stock', sector: 'Tech', rsi: 55, volume: '67.3M', aiScore: 68 },
  { symbol: 'BTC', name: 'Bitcoin', price: '97,432', change: '-2.14%', positive: false, signal: 'Hold', category: 'crypto', sector: 'Crypto', rsi: 48, volume: '48.9B', aiScore: 61 },
  { symbol: 'ETH', name: 'Ethereum', price: '3,245.67', change: '-1.87%', positive: false, signal: 'Buy', category: 'crypto', sector: 'Crypto', rsi: 42, volume: '18.3B', aiScore: 74 },
  { symbol: 'META', name: 'Meta Platforms', price: '567.89', change: '-0.89%', positive: false, signal: 'Hold', category: 'stock', sector: 'Tech', rsi: 51, volume: '45.1M', aiScore: 58 },
  { symbol: 'MSFT', name: 'Microsoft Corp', price: '445.23', change: '+2.34%', positive: true, signal: 'Buy', category: 'stock', sector: 'Tech', rsi: 63, volume: '32.8M', aiScore: 79 },
  { symbol: 'AMZN', name: 'Amazon.com', price: '212.56', change: '+1.89%', positive: true, signal: 'Strong Buy', category: 'stock', sector: 'Tech', rsi: 68, volume: '56.7M', aiScore: 88 },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: '178.90', change: '+0.67%', positive: true, signal: 'Buy', category: 'stock', sector: 'Tech', rsi: 58, volume: '28.4M', aiScore: 75 },
  { symbol: 'SOL', name: 'Solana', price: '187.34', change: '+4.23%', positive: true, signal: 'Strong Buy', category: 'crypto', sector: 'Crypto', rsi: 71, volume: '3.2B', aiScore: 91 },
  { symbol: 'XRP', name: 'Ripple', price: '2.34', change: '+6.12%', positive: true, signal: 'Buy', category: 'crypto', sector: 'Crypto', rsi: 67, volume: '5.8B', aiScore: 77 },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: '234.56', change: '+0.89%', positive: true, signal: 'Hold', category: 'stock', sector: 'Finance', rsi: 54, volume: '12.1M', aiScore: 65 },
  { symbol: 'GS', name: 'Goldman Sachs', price: '578.90', change: '+1.23%', positive: true, signal: 'Buy', category: 'stock', sector: 'Finance', rsi: 61, volume: '4.5M', aiScore: 72 },
  { symbol: 'AMD', name: 'AMD Inc', price: '178.45', change: '+3.45%', positive: true, signal: 'Strong Buy', category: 'stock', sector: 'Tech', rsi: 70, volume: '78.9M', aiScore: 89 },
];

const filters = ['All', 'Stocks', 'Crypto'];
const sortOptions = ['AI Score', 'Change %', 'Volume'];

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

  const filtered = ALL_TICKERS.filter(t => {
    if (activeFilter === 'Stocks') return t.category === 'stock';
    if (activeFilter === 'Crypto') return t.category === 'crypto';
    return true;
  }).sort((a, b) => {
    if (sortBy === 'AI Score') return b.aiScore - a.aiScore;
    if (sortBy === 'Change %') return parseFloat(b.change) - parseFloat(a.change);
    return 0;
  });

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Flame className="w-6 h-6 text-orange-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Hot Board</h1>
        </div>
        <p className="text-sm text-white/30">AI-ranked trending assets by signal strength</p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeFilter === f
                  ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                  : 'glass text-white/40 hover:text-white/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {sortOptions.map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                sortBy === s
                  ? 'bg-white/10 text-white'
                  : 'text-white/30 hover:text-white/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Ticker Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((ticker, i) => (
            <motion.div
              key={ticker.symbol}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              layout
            >
              <Link
                to={`/Asset?symbol=${ticker.symbol}`}
                className="glass rounded-2xl p-4 flex items-center gap-4 glass-hover transition-all group block"
              >
                {/* Rank */}
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white/30">#{i + 1}</span>
                </div>

                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-300">{ticker.symbol.slice(0,2)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">{ticker.symbol}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSignalStyle(ticker.signal)}`}>
                      {ticker.signal}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/25 mt-0.5">{ticker.name} • {ticker.sector}</div>
                </div>

                {/* Chart */}
                <div className="hidden sm:block">
                  <MiniChart positive={ticker.positive} />
                </div>

                {/* AI Score */}
                <div className="text-center flex-shrink-0">
                  <div className={`text-lg font-bold ${getAiScoreColor(ticker.aiScore)}`}>{ticker.aiScore}</div>
                  <div className="text-[9px] text-white/20 font-medium">AI Score</div>
                </div>

                {/* Price */}
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
      </div>

      {/* Affiliate CTA */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-2xl p-6 text-center border border-violet-500/10"
      >
        <Zap className="w-8 h-8 text-violet-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-1">Start Trading These Signals</h3>
        <p className="text-xs text-white/30 mb-4 max-w-md mx-auto">
          Connect to ZuluTrade and copy top traders' strategies automatically. AI-powered, hands-free trading.
        </p>
        <a
          href="https://www.zulutrade.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Start Copy Trading
          <TrendingUp className="w-4 h-4" />
        </a>
      </motion.div>
    </div>
  );
}