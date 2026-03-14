import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from 'lucide-react';

export default function PortfolioSummary({ enriched, isLoading }) {
  const totalValue   = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost    = enriched.reduce((s, h) => s + h.totalCost, 0);
  const totalPnl     = totalValue - totalCost;
  const totalPnlPct  = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dailyChange  = enriched.reduce((s, h) => s + (h.currentValue * h.pct / 100), 0);
  const dailyPct     = totalValue > 0 ? (dailyChange / totalValue) * 100 : 0;

  const cards = [
    {
      label: 'Total Value',
      value: `$${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      sub: `${enriched.length} position${enriched.length !== 1 ? 's' : ''}`,
      icon: DollarSign,
      color: 'from-violet-500 to-fuchsia-500',
    },
    {
      label: "Today's Change",
      value: `${dailyChange >= 0 ? '+' : ''}$${Math.abs(dailyChange).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      sub: `${dailyPct >= 0 ? '+' : ''}${dailyPct.toFixed(2)}%`,
      icon: dailyChange >= 0 ? TrendingUp : TrendingDown,
      positive: dailyChange >= 0,
      color: dailyChange >= 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500',
    },
    {
      label: 'Total P&L',
      value: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      sub: `${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(2)}% all time`,
      icon: BarChart3,
      positive: totalPnl >= 0,
      color: totalPnl >= 0 ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-pink-500',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1,2,3].map(i => <div key={i} className="glass rounded-2xl h-28 animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card, i) => (
        <motion.div key={card.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07 }}
          className="glass rounded-2xl p-5 relative overflow-hidden"
        >
          <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-5 rounded-full -translate-y-8 translate-x-8`} />
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
            <card.icon className="w-4 h-4 text-white" />
          </div>
          <div className={`text-xl font-bold ${card.positive === false ? 'text-rose-400' : card.positive === true ? 'text-emerald-400' : 'text-white'}`}>
            {card.value}
          </div>
          <div className="text-[11px] text-white/30 mt-0.5">{card.label}</div>
          <div className="text-[10px] text-white/20 mt-1">{card.sub}</div>
        </motion.div>
      ))}
    </div>
  );
}