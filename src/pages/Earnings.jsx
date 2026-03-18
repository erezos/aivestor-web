import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, TrendingUp, TrendingDown, Zap, RefreshCw, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchEarnings } from '../components/marketData';

const volatilityConfig = {
  High:   { color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20',    bar: 'bg-rose-400',    width: 'w-full' },
  Medium: { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',  bar: 'bg-amber-400',   width: 'w-2/3' },
  Low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-400', width: 'w-1/3' },
};

const sentimentConfig = {
  bullish: { color: 'text-emerald-400', icon: TrendingUp },
  bearish: { color: 'text-rose-400',    icon: TrendingDown },
  neutral: { color: 'text-amber-400',   icon: Zap },
};

function groupByDate(earnings) {
  return earnings.reduce((acc, e) => {
    const d = e.reportDate;
    if (!acc[d]) acc[d] = [];
    acc[d].push(e);
    return acc;
  }, {});
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function isToday(dateStr) {
  return dateStr === new Date().toISOString().split('T')[0];
}

function isTomorrow(dateStr) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}

function dateLabel(dateStr) {
  if (isToday(dateStr)) return '📅 Today';
  if (isTomorrow(dateStr)) return '⏭ Tomorrow';
  return formatDate(dateStr);
}

export default function Earnings() {
  const [filter, setFilter] = useState('All');

  const { data: earnings = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['earnings'],
    queryFn: fetchEarningsWithForecasts,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const filtered = filter === 'All' ? earnings
    : earnings.filter(e => e.sector === filter);

  const sectors = ['All', ...new Set(earnings.map(e => e.sector).filter(Boolean))];
  const grouped = groupByDate(filtered);
  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Earnings Calendar</h1>
          </div>
          <p className="text-sm text-white/30">Upcoming reports + AI volatility forecasts</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="p-2 rounded-xl glass glass-hover transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Sector Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {sectors.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filter === s
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'glass text-white/40 hover:text-white/60'
            }`}
          >{s}</button>
        ))}
      </div>

      {/* AI Legend */}
      <div className="glass rounded-xl px-4 py-3 flex items-center gap-6 text-[11px]">
        <div className="flex items-center gap-1.5 text-white/40">
          <Zap className="w-3 h-3 text-violet-400" />
          <span className="text-violet-300 font-semibold">AI Forecast</span>
          <span>· predicted move volatility around earnings date</span>
        </div>
        <div className="hidden sm:flex items-center gap-4 ml-auto">
          {['High','Medium','Low'].map(v => {
            const cfg = volatilityConfig[v];
            return (
              <span key={v} className={`flex items-center gap-1 font-semibold ${cfg.color}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.bar}`} /> {v}
              </span>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-6">
          {[1,2,3].map(g => (
            <div key={g} className="space-y-2">
              <div className="h-4 w-28 bg-white/5 rounded animate-pulse" />
              {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-20 animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="glass rounded-2xl p-14 text-center text-white/20">No earnings data available</div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date, di) => (
            <motion.div key={date} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}>
              {/* Date Group Header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-bold ${isToday(date) ? 'text-violet-300' : 'text-white/60'}`}>
                  {dateLabel(date)}
                </span>
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-white/20">{grouped[date].length} reports</span>
              </div>

              {/* Earnings Rows */}
              <div className="space-y-2">
                {grouped[date].map((e, i) => {
                  const vCfg = volatilityConfig[e.volatilityForecast] || volatilityConfig.Medium;
                  const sCfg = sentimentConfig[e.sentimentBias] || sentimentConfig.neutral;
                  const SIcon = sCfg.icon;
                  return (
                    <Link key={e.symbol} to={`/Asset?symbol=${e.symbol}`}>
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: di * 0.05 + i * 0.03 }}
                        className="glass rounded-2xl p-4 glass-hover transition-all group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4"
                      >
                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-violet-300">{e.symbol.slice(0,2)}</span>
                        </div>

                        {/* Name + meta */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white group-hover:text-violet-300 transition-colors">{e.symbol}</span>
                            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${sCfg.color}`}>
                              <SIcon className="w-3 h-3" /> {e.sentimentBias}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/25 truncate">{e.companyName}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {e.reportTime === 'BMO' ? 'Before Open' : 'After Close'}
                            </span>
                            {e.epsEstimate != null && (
                              <span className="text-[10px] text-white/20">EPS est. <span className="text-white/40">${e.epsEstimate.toFixed(2)}</span></span>
                            )}
                            {e.revenueEstimate && (
                              <span className="text-[10px] text-white/20">Rev. <span className="text-white/40">{e.revenueEstimate}</span></span>
                            )}
                          </div>
                        </div>

                        {/* Revenue (desktop) */}
                        <div className="hidden sm:block text-right">
                          <div className="text-[10px] text-white/25">Sector</div>
                          <div className="text-xs text-white/50 font-medium">{e.sector}</div>
                        </div>

                        {/* AI Volatility Forecast */}
                        <div className="hidden sm:block text-right min-w-[80px]">
                          <div className="text-[10px] text-white/25 mb-1">AI Volatility</div>
                          <div className={`text-xs font-bold ${vCfg.color}`}>{e.volatilityForecast}</div>
                          <div className="w-full h-1 bg-white/5 rounded-full mt-1">
                            <div className={`h-1 rounded-full ${vCfg.bar} ${vCfg.width} transition-all`} />
                          </div>
                        </div>

                        {/* AI badge (mobile + desktop) */}
                        <div className={`text-right`}>
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border ${vCfg.bg} ${vCfg.color}`}>
                            <Zap className="w-2.5 h-2.5" />
                            {e.volatilityForecast}
                          </span>
                          <div className="text-[9px] text-white/20 mt-1 max-w-[100px] text-right leading-tight">{e.volatilityReason}</div>
                        </div>
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}