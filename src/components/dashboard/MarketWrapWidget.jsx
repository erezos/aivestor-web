import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Newspaper, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

function Skeleton({ className }) {
  return <div className={`bg-white/5 rounded animate-pulse ${className}`} />;
}

export default function MarketWrapWidget() {
  const today = new Date().toISOString().split('T')[0];

  const { data: wrap, isLoading } = useQuery({
    queryKey: ['market_wrap_widget', today],
    queryFn: async () => {
      const rows = await base44.entities.CachedData.filter({ cache_key: `market_wrap_${today}` });
      return rows[0]?.data ? JSON.parse(rows[0].data) : null;
    },
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );

  if (!wrap) return (
    <Link to="/MarketWrap"
      className="glass rounded-2xl p-5 border border-white/5 flex items-center gap-3 hover:border-violet-500/20 transition-all group"
    >
      <Newspaper className="w-5 h-5 text-violet-400/40 group-hover:text-violet-400 transition-colors flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-white/50">Daily Market Wrap</p>
        <p className="text-[11px] text-white/25">Not yet generated today · click to generate</p>
      </div>
      <ArrowRight className="w-4 h-4 text-white/20 ml-auto group-hover:text-violet-400 transition-colors" />
    </Link>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 border border-violet-500/10"
    >
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="w-4 h-4 text-violet-400" />
        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Daily Market Wrap</span>
        <span className="ml-auto text-[10px] text-white/20">{today}</span>
      </div>

      <h3 className="text-sm font-bold text-white leading-snug mb-2 line-clamp-2">{wrap.headline}</h3>
      <p className="text-xs text-white/40 leading-relaxed line-clamp-2">{wrap.intro_paragraph}</p>

      {wrap.top_movers?.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {wrap.top_movers.slice(0, 5).map(m => (
            <span key={m.symbol}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                m.positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
              }`}
            >
              {m.positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {m.symbol} {m.change}
            </span>
          ))}
        </div>
      )}

      <Link to="/MarketWrap"
        className="flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300 transition-colors font-semibold"
      >
        Read full wrap <ArrowRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}