import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

const INDICES = [
  { symbol: 'S&P 500', value: '5,892.34', change: '+1.23%', positive: true },
  { symbol: 'NASDAQ', value: '19,234.56', change: '+1.67%', positive: true },
  { symbol: 'DOW', value: '43,567.89', change: '+0.89%', positive: true },
  { symbol: 'BTC/USD', value: '97,432.10', change: '-2.14%', positive: false },
  { symbol: 'ETH/USD', value: '3,245.67', change: '-1.87%', positive: false },
  { symbol: 'GOLD', value: '2,934.50', change: '+0.43%', positive: true },
  { symbol: 'EUR/USD', value: '1.0923', change: '-0.12%', positive: false },
  { symbol: 'VIX', value: '14.32', change: '-3.45%', positive: true },
];

export default function MarketIndices() {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {INDICES.map((index, i) => (
          <motion.div
            key={index.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 min-w-[140px] flex-shrink-0 cursor-pointer glass-hover transition-all"
          >
            <div className="text-xs text-white/40 font-medium mb-1">{index.symbol}</div>
            <div className="text-sm font-bold text-white">{index.value}</div>
            <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${index.positive ? 'text-gain' : 'text-loss'}`}>
              {index.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {index.change}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}