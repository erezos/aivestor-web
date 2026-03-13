import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketIndices } from '../marketData';

const FALLBACK = [
  { symbol: 'S&P 500', value: '—', change: '—', positive: true },
  { symbol: 'NASDAQ', value: '—', change: '—', positive: true },
  { symbol: 'DOW', value: '—', change: '—', positive: true },
  { symbol: 'BTC/USD', value: '—', change: '—', positive: true },
  { symbol: 'ETH/USD', value: '—', change: '—', positive: true },
  { symbol: 'GOLD', value: '—', change: '—', positive: true },
  { symbol: 'EUR/USD', value: '—', change: '—', positive: true },
  { symbol: 'VIX', value: '—', change: '—', positive: true },
];

export default function MarketIndices() {
  const { data: indices, isLoading } = useQuery({
    queryKey: ['marketIndices'],
    queryFn: fetchMarketIndices,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const items = indices || FALLBACK;

  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {items.map((index, i) => (
          <motion.div
            key={index.symbol}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 min-w-[140px] flex-shrink-0 cursor-pointer glass-hover transition-all"
          >
            <div className="text-xs text-white/40 font-medium mb-1">{index.symbol}</div>
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-12 bg-white/5 rounded animate-pulse" />
              </div>
            ) : (
              <>
                <div className="text-sm font-bold text-white">{index.value}</div>
                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${index.positive ? 'text-gain' : 'text-loss'}`}>
                  {index.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {index.change}
                </div>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}