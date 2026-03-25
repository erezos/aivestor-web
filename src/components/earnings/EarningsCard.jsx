import React from 'react';
import { motion } from 'framer-motion';
import CompanyLogo, { getGradient } from './CompanyLogo';

const VOL_ICON = { High: '🔥', Medium: '⚡', Low: '✓' };
const VOL_COLOR = {
  High:   'text-rose-400 border-rose-500/40 bg-rose-500/10',
  Medium: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  Low:    'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
};

function EpsBadge({ actual, estimate }) {
  if (actual == null || estimate == null) return null;
  const beat = actual >= estimate;
  const diff = ((actual - estimate) / Math.abs(estimate) * 100).toFixed(1);
  return (
    <span className={`text-[9px] font-black px-1 py-0.5 rounded-md ${beat ? 'bg-emerald-500/25 text-emerald-400' : 'bg-rose-500/25 text-rose-400'}`}>
      {beat ? `+${diff}%` : `${diff}%`}
    </span>
  );
}

export default function EarningsCard({ earning, index, onClick }) {
  const { symbol, volatilityForecast, epsEstimate, epsActual, reportTime, isNotable } = earning;
  const hasActual = epsActual != null;
  const gradient = getGradient(symbol);
  const volCfg = VOL_COLOR[volatilityForecast] || VOL_COLOR.Medium;

  return (
    <motion.button
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      onClick={() => onClick(earning)}
      className={`w-full text-left rounded-2xl p-2.5 border transition-all duration-200
        hover:scale-[1.03] active:scale-[0.97] cursor-pointer group relative overflow-hidden
        ${hasActual
          ? 'bg-white/4 border-white/10'
          : isNotable
            ? 'bg-white/5 border-white/15 hover:border-white/25'
            : 'bg-white/3 border-white/8 hover:border-white/15'
        }
      `}
    >
      {/* Subtle gradient glow on hover */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 rounded-2xl`} />

      {/* Logo + symbol row */}
      <div className="flex items-center gap-2 mb-1.5">
        <CompanyLogo symbol={symbol} size="sm" />
        <div className="flex-1 min-w-0">
          <div className={`text-[11px] font-black truncate ${isNotable ? 'text-white' : 'text-white/75'}`}>
            {symbol}
          </div>
          <div className="text-[9px] text-white/25 leading-none">
            {reportTime === 'BMO' ? 'Pre-mkt' : reportTime === 'AMC' ? 'After-mkt' : 'During'}
          </div>
        </div>
        {/* Vol badge or actual badge */}
        {hasActual ? (
          <EpsBadge actual={epsActual} estimate={epsEstimate} />
        ) : (
          <span className={`text-[9px] font-black px-1 py-0.5 rounded-md border flex-shrink-0 ${volCfg}`}>
            {VOL_ICON[volatilityForecast] || '⚡'}
          </span>
        )}
      </div>

      {/* EPS row */}
      {hasActual ? (
        <div className="text-[10px] text-white/40">
          EPS <span className="text-white/70 font-bold">${epsActual}</span>
        </div>
      ) : epsEstimate != null ? (
        <div className="text-[10px] text-white/30">
          Est <span className="text-white/55 font-semibold">${epsEstimate.toFixed(2)}</span>
        </div>
      ) : null}
    </motion.button>
  );
}