import React from 'react';
import { Flame, TrendingUp, TrendingDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingTickers } from '../marketData';

const SIGNALS = {
  'NVDA': 'Strong Buy', 'TSLA': 'Buy', 'AAPL': 'Hold',
  'META': 'Hold', 'MSFT': 'Buy', 'BTC': 'Hold',
  'AMZN': 'Strong Buy', 'GOOGL': 'Buy',
};

function getSignalColor(signal) {
  if (signal === 'Strong Buy') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (signal === 'Buy') return 'bg-green-500/15 text-green-400 border-green-500/20';
  if (signal === 'Hold') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
  if (signal === 'Sell') return 'bg-red-500/15 text-red-400 border-red-500/20';
  return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
}

const SKELETON_COUNT = 6;

function TickerRow({ ticker }) {
  const signal = SIGNALS[ticker.symbol] || 'Hold';
  return (
    <Link
      to={`/Asset?symbol=${ticker.symbol}`}
      className="flex items-center justify-between py-2.5 px-3 rounded-xl glass-hover transition-all group cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center">
          <span className="text-xs font-bold text-violet-300">{ticker.symbol.slice(0, 2)}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">{ticker.symbol}</div>
          <div className="text-[11px] text-white/30">{ticker.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getSignalColor(signal)}`}>
          {signal}
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
  );
}

export default function TrendingTickers() {
  const { data: tickers, isLoading } = useQuery({
    queryKey: ['trendingTickers'],
    queryFn: fetchTrendingTickers,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const validTickers = Array.isArray(tickers) ? tickers.filter(t => t && typeof t.symbol === 'string') : [];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h3 className="text-sm font-semibold text-white/80">Trending Now</h3>
          {!isLoading && validTickers.length > 0 && (
            <span className="text-[10px] text-white/20 font-medium">Live</span>
          )}
        </div>
        <Link to="/HotBoard" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
          View All →
        </Link>
      </div>

      <div className="space-y-1">
        {isLoading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-16 bg-white/5 rounded animate-pulse" />
                    <div className="h-2.5 w-24 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-1.5 text-right">
                  <div className="h-3.5 w-16 bg-white/5 rounded animate-pulse" />
                  <div className="h-2.5 w-12 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))
          : validTickers.map(ticker => (
              <TickerRow key={ticker.symbol} ticker={ticker} />
            ))
        }
      </div>
    </div>
  );
}