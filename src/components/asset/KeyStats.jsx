import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

// Ambient scanner: random chars that slowly cycle — calm, never looks "stuck"
const SCAN_CHARS = '0123456789ABCDEF.$%';
function randomChar() { return SCAN_CHARS[Math.floor(Math.random() * SCAN_CHARS.length)]; }

function ScanLoader() {
  const [chars, setChars] = useState(() => Array.from({ length: 6 }, randomChar));

  useEffect(() => {
    // Replace one random char at a time, slowly — calm rhythm
    const id = setInterval(() => {
      setChars(prev => {
        const next = [...prev];
        const i = Math.floor(Math.random() * next.length);
        next[i] = randomChar();
        return next;
      });
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="glass rounded-xl p-3 relative overflow-hidden group">
      {/* Gentle ambient glow pulse — very slow, not demanding */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-violet-500/5"
        animate={{ opacity: [0, 0.4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="text-[10px] text-white/20 mb-1.5 font-mono tracking-widest">SCANNING</div>
      <div className="flex gap-0.5">
        {chars.map((c, i) => (
          <span
            key={i}
            className="text-[11px] font-mono font-bold text-violet-400/40"
            style={{ transition: 'opacity 0.15s', opacity: 0.3 + Math.random() * 0.5 }}
          >
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatCell({ label, value, isLoading }) {
  // Show scanner only while request is in flight
  if (isLoading) return <ScanLoader />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="glass rounded-xl p-3"
    >
      <div className="text-[10px] text-white/30 mb-1">{label}</div>
      <div className="text-sm font-semibold text-white">
        {value ?? <span className="text-white/20 font-normal">N/A</span>}
      </div>
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
          <motion.span
            className="ml-auto text-[10px] font-mono text-violet-400/40"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            SCANNING…
          </motion.span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <StatCell key={row.label} label={row.label} value={row.value} isLoading={isLoading} />
        ))}
      </div>
    </div>
  );
}