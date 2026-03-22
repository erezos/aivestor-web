import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Zap, TrendingUp, TrendingDown, Clock, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fetchEarningsForDates, fetchEarningsMeta } from '../components/marketData';

const VOL = {
  High:   { color: 'text-rose-400',    bg: 'bg-rose-500/15',    border: 'border-rose-500/30',    dot: 'bg-rose-400' },
  Medium: { color: 'text-amber-400',   bg: 'bg-amber-500/15',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  Low:    { color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
};

const SENT = {
  bullish: { icon: TrendingUp,   color: 'text-emerald-400' },
  bearish: { icon: TrendingDown, color: 'text-rose-400' },
  neutral: { icon: Zap,          color: 'text-amber-400' },
};

const DAYS = ['Mon','Tue','Wed','Thu','Fri'];

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0,0,0,0);
  return d;
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function formatHeaderDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isToday(dateStr) {
  return dateStr === toDateStr(new Date());
}

export default function Earnings() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  const weekStart = getWeekStart(weekOffset);
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return { date: toDateStr(d), label: DAYS[i], display: formatHeaderDate(d), d };
  });

  const weekDates = weekDays.map(d => d.date);

  const { data: meta } = useQuery({
    queryKey: ['earnings_meta'],
    queryFn: fetchEarningsMeta,
    staleTime: 5 * 60 * 1000,
  });

  const { data: earnings = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['earnings', weekDates.join(',')],
    queryFn: () => fetchEarningsForDates(weekDates),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const byDate = earnings.reduce((acc, e) => {
    if (!acc[e.reportDate]) acc[e.reportDate] = [];
    acc[e.reportDate].push(e);
    return acc;
  }, {});

  const weekLabel = `${formatHeaderDate(weekDays[0].d)} – ${formatHeaderDate(weekDays[4].d)}`;
  const totalThisWeek = weekDays.reduce((sum, d) => sum + (byDate[d.date]?.length || 0), 0);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <CalendarDays className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Earnings Calendar</h1>
          </div>
          <p className="text-sm text-white/30">
            AI volatility forecasts ·{' '}
            {meta ? (
              meta.completed
                ? `${meta.total} companies · fully enriched`
                : `${meta.enriched_dates?.length || 0}/${meta.dates?.length || 0} dates AI-enriched`
            ) : `${earnings.length} companies`}
          </p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-xl glass glass-hover transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Week Navigator */}
      <div className="flex items-center justify-between glass rounded-2xl px-5 py-3">
        <button onClick={() => setWeekOffset(w => w - 1)}
          className="p-1.5 rounded-lg glass-hover text-white/40 hover:text-white/80 transition-all">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-sm font-bold text-white">{weekLabel}</div>
          <div className="text-[11px] text-white/30 mt-0.5">{totalThisWeek} report{totalThisWeek !== 1 ? 's' : ''} this week</div>
        </div>
        <button onClick={() => setWeekOffset(w => w + 1)}
          className="p-1.5 rounded-lg glass-hover text-white/40 hover:text-white/80 transition-all">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-white/30">
        <span className="text-violet-300 font-semibold flex items-center gap-1"><Zap className="w-3 h-3" /> AI Volatility:</span>
        {Object.entries(VOL).map(([k, v]) => (
          <span key={k} className={`flex items-center gap-1 font-semibold ${v.color}`}>
            <span className={`w-2 h-2 rounded-full ${v.dot}`} />{k}
          </span>
        ))}
        <span className="ml-auto text-white/20">Click any card for details</span>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-2">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
              {[1,2,3].map(j => <div key={j} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-2">
          {weekDays.map(({ date, label, display }) => {
            const dayEarnings = byDate[date] || [];
            const today = isToday(date);
            return (
              <div key={date} className="space-y-2">
                <div className={`rounded-xl px-2 py-2 text-center ${today ? 'bg-violet-500/20 border border-violet-500/30' : 'glass'}`}>
                  <div className={`text-xs font-black ${today ? 'text-violet-300' : 'text-white/50'}`}>{label}</div>
                  <div className={`text-[10px] ${today ? 'text-violet-400/70' : 'text-white/20'}`}>{display}</div>
                  {today && <div className="text-[9px] text-violet-400 font-bold mt-0.5">TODAY</div>}
                </div>

                {dayEarnings.length === 0 ? (
                  <div className="h-12 rounded-xl border border-white/3 flex items-center justify-center">
                    <span className="text-[10px] text-white/10">—</span>
                  </div>
                ) : (
                  dayEarnings.map((e, i) => {
                    const vCfg = VOL[e.volatilityForecast] || VOL.Medium;
                    return (
                      <motion.button
                        key={e.symbol}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        onClick={() => setSelected(e)}
                        className={`w-full text-left rounded-xl p-2 border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${vCfg.bg} ${vCfg.border} ${e.isNotable ? 'ring-1 ring-violet-500/20' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-[11px] font-black ${e.isNotable ? 'text-white' : 'text-white/70'} truncate`}>{e.symbol}</span>
                          <span className={`text-[9px] font-bold ${vCfg.color} flex-shrink-0`}>
                            {e.volatilityForecast === 'High' ? '🔥' : e.volatilityForecast === 'Medium' ? '⚡' : '✓'}
                          </span>
                        </div>
                        <div className="text-[9px] text-white/30 mt-0.5">{e.reportTime}</div>
                        {e.epsEstimate != null && (
                          <div className="text-[9px] text-white/25 mt-0.5">EPS ${e.epsEstimate.toFixed(2)}</div>
                        )}
                      </motion.button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ type: 'spring', bounce: 0.25 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-3xl p-6 w-full max-w-sm border border-white/10 relative"
            >
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors">
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
                  <span className="text-sm font-black text-violet-300">{selected.symbol.slice(0,2)}</span>
                </div>
                <div>
                  <div className="text-xl font-black text-white">{selected.symbol}</div>
                  <div className="text-xs text-white/30 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selected.reportTime === 'BMO' ? 'Before Market Open' : selected.reportTime === 'AMC' ? 'After Market Close' : 'During Market Hours'}
                  </div>
                </div>
              </div>

              {(() => {
                const vCfg = VOL[selected.volatilityForecast] || VOL.Medium;
                const sCfg = SENT[selected.sentimentBias] || SENT.neutral;
                const SIcon = sCfg.icon;
                return (
                  <div className="space-y-3 mb-5">
                    <div className={`rounded-2xl p-4 ${vCfg.bg} border ${vCfg.border}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/40 font-semibold">AI Volatility Forecast</span>
                        <Zap className="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div className={`text-2xl font-black ${vCfg.color} mb-1`}>{selected.volatilityForecast}</div>
                      <div className="text-xs text-white/40">{selected.volatilityReason}</div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1 glass rounded-xl p-3 text-center">
                        <div className="text-[10px] text-white/30 mb-1">Sentiment</div>
                        <SIcon className={`w-5 h-5 mx-auto ${sCfg.color}`} />
                        <div className={`text-xs font-bold mt-1 capitalize ${sCfg.color}`}>{selected.sentimentBias}</div>
                      </div>
                      {selected.epsEstimate != null && (
                        <div className="flex-1 glass rounded-xl p-3 text-center">
                          <div className="text-[10px] text-white/30 mb-1">EPS Est.</div>
                          <div className="text-lg font-black text-white">${selected.epsEstimate.toFixed(2)}</div>
                        </div>
                      )}
                      {selected.revenueEstimate && selected.revenueEstimate !== '—' && (
                        <div className="flex-1 glass rounded-xl p-3 text-center">
                          <div className="text-[10px] text-white/30 mb-1">Rev. Est.</div>
                          <div className="text-sm font-black text-white">{selected.revenueEstimate}</div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <Link to={`/Asset?symbol=${selected.symbol}`} onClick={() => setSelected(null)}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                View AI Analysis <TrendingUp className="w-4 h-4" />
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}