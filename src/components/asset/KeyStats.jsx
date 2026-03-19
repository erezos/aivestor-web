import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const LOADERS = [
  { label: 'Scanning fundamentals', color: 'from-violet-500 to-fuchsia-500' },
  { label: 'Fetching metrics', color: 'from-cyan-500 to-blue-500' },
  { label: 'Crunching numbers', color: 'from-amber-500 to-orange-500' },
  { label: 'Analyzing data', color: 'from-emerald-500 to-teal-500' },
  { label: 'Almost there', color: 'from-pink-500 to-rose-500' },
  { label: 'Pulling stats', color: 'from-indigo-500 to-violet-500' },
];

function StatLoader({ index }) {
  const cfg = LOADERS[index % LOADERS.length];
  return (
    <div className="glass rounded-xl p-3 overflow-hidden relative">
      <div className="text-[10px] text-white/25 mb-2">{cfg.label}…</div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${cfg.color}`}
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.18 }}
        />
      </div>
    </div>
  );
}

function StatCell({ label, value, index }) {
  if (value == null) return <StatLoader index={index} />;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-3"
    >
      <div className="text-[10px] text-white/30 mb-1">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </motion.div>
  );
}

export default function KeyStats({ symbol }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', symbol],
    queryFn: () => base44.functions.invoke('getAssetStats', { symbol }).then(r => r.data),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  const rows = [
    { label: 'Market Cap', value: stats?.marketCap ?? null },
    { label: stats?.isCrypto ? '24h Volume' : 'Avg Volume', value: stats?.volume ?? null },
    { label: 'P/E Ratio',  value: stats?.pe ?? null },
    { label: '52W High',   value: stats?.high52 != null ? `$${Number(stats.high52).toLocaleString()}` : null },
    { label: '52W Low',    value: stats?.low52  != null ? `$${Number(stats.low52).toLocaleString()}`  : null },
    { label: 'Sector',     value: stats?.sector ?? null },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/80">Key Statistics</h3>
        {isLoading && (
          <span className="ml-auto text-[10px] text-violet-400/60 animate-pulse">Loading…</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row, i) => (
          <StatCell key={row.label} label={row.label} value={row.value} index={i} />
        ))}
      </div>
    </div>
  );
}