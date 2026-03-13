import React from 'react';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const TRENDING = [
  { symbol: 'NVDA', name: 'NVIDIA Corp', price: '892.45', change: '+5.67%', positive: true, signal: 'Strong Buy', volume: '89.2M' },
  { symbol: 'TSLA', name: 'Tesla Inc', price: '248.32', change: '+3.21%', positive: true, signal: 'Buy', volume: '124.5M' },
  { symbol: 'AAPL', name: 'Apple Inc', price: '198.76', change: '+1.45%', positive: true, signal: 'Hold', volume: '67.3M' },
  { symbol: 'META', name: 'Meta Platforms', price: '567.89', change: '-0.89%', positive: false, signal: 'Hold', volume: '45.1M' },
  { symbol: 'MSFT', name: 'Microsoft Corp', price: '445.23', change: '+2.34%', positive: true, signal: 'Buy', volume: '32.8M' },
  { symbol: 'BTC', name: 'Bitcoin', price: '97,432', change: '-2.14%', positive: false, signal: 'Hold', volume: '48.9B' },
  { symbol: 'AMZN', name: 'Amazon.com', price: '212.56', change: '+1.89%', positive: true, signal: 'Strong Buy', volume: '56.7M' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', price: '178.90', change: '+0.67%', positive: true, signal: 'Buy', volume: '28.4M' },
];

function getSignalColor(signal) {
  if (signal === 'Strong Buy') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (signal === 'Buy') return 'bg-green-500/15 text-green-400 border-green-500/20';
  if (signal === 'Hold') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (signal === 'Sell') return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
}

export default function TrendingTickers() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white/80">Trending Now</h3>
        </div>
        <Link to="/HotBoard" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
          View All →
        </Link>
      </div>

      <div className="space-y-1">
        {TRENDING.map((ticker, i) => (
          <motion.div
            key={ticker.symbol}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/Asset?symbol=${ticker.symbol}`}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl glass-hover transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-300">{ticker.symbol.slice(0,2)}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">{ticker.symbol}</div>
                  <div className="text-[11px] text-white/30">{ticker.name}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSignalColor(ticker.signal)}`}>
                  {ticker.signal}
                </span>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">${ticker.price}</div>
                  <div className={`text-xs font-medium flex items-center gap-0.5 justify-end ${ticker.positive ? 'text-gain' : 'text-loss'}`}>
                    {ticker.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {ticker.change}
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}