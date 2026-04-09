import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Clock, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const STANCE_META = {
  bullish: { color: 'text-emerald-400', icon: TrendingUp  },
  bearish: { color: 'text-rose-400',    icon: TrendingDown },
  neutral: { color: 'text-amber-400',   icon: Minus        },
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AskAiHistory({ onSelect }) {
  const { data, isLoading } = useQuery({
    queryKey: ['askAiHistory'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAskAiHistory', { limit: 20, requestId: crypto.randomUUID() });
      return res.data?.data?.items ?? [];
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-lg bg-white/5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-16 bg-white/5 rounded" />
              <div className="h-2.5 w-32 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="text-center py-8 text-white/20 text-sm">
        No past reports yet. Generate your first AI Edge Report above!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const sm = STANCE_META[item.stance] || STANCE_META.neutral;
        const Icon = sm.icon;
        const pct = Math.round((item.confidence ?? 0.5) * 100);
        return (
          <motion.button key={item.id || i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => onSelect(item.report, item.asset)}
            className="w-full glass glass-hover rounded-xl p-3 flex items-center gap-3 text-left transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-white/5 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-black text-violet-300">{item.asset?.slice(0, 2)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{item.asset}</span>
                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${sm.color}`}>
                  <Icon className="w-2.5 h-2.5" /> {item.stance}
                </span>
                <span className="text-[10px] text-white/20">{pct}%</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-white/25 capitalize">{item.depth} · {item.timeframe}</span>
                <span className="text-white/15">·</span>
                <span className="text-[10px] text-white/25 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" /> {timeAgo(item.createdAt)}
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/15 group-hover:text-white/40 transition-colors flex-shrink-0" />
          </motion.button>
        );
      })}
    </div>
  );
}