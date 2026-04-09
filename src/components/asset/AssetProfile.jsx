import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { BookOpen, ShieldAlert, TrendingUp, Zap, Users, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

const SECTIONS = [
  { key: 'overview',          label: 'Business Overview',    icon: BookOpen   },
  { key: 'revenue_model',     label: 'Revenue & Metrics',    icon: BarChart3  },
  { key: 'moat',              label: 'Competitive Moat',     icon: ShieldAlert },
  { key: 'catalysts',         label: 'Recent Catalysts',     icon: Zap        },
  { key: 'risks',             label: 'Key Risks',            icon: TrendingUp },
  { key: 'who_should_invest', label: 'Who Should Consider',  icon: Users      },
];

function Skeleton({ className }) {
  return <div className={`bg-white/5 rounded animate-pulse ${className}`} />;
}

export default function AssetProfile({ symbol }) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ['asset_profile', symbol],
    queryFn: () => base44.functions.invoke('generateAssetProfile', { symbol }).then(r => r.data),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
    select: (data) => {
      if (!data || data.error) return data;
      const flatten = (v) => {
        if (typeof v === 'string') return v;
        if (typeof v === 'object' && v !== null) return Object.values(v).filter(x => typeof x === 'string').join(' ');
        return String(v ?? '');
      };
      return {
        ...data,
        overview: flatten(data.overview),
        revenue_model: flatten(data.revenue_model),
        moat: flatten(data.moat),
        risks: flatten(data.risks),
        catalysts: flatten(data.catalysts),
        who_should_invest: flatten(data.who_should_invest),
      };
    },

  if (isLoading) return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-full" />
        </div>
      ))}
    </div>
  );

  if (!profile || profile.error) return null;

  const ageHours = profile.generated_at
    ? Math.floor((Date.now() - new Date(profile.generated_at)) / (1000 * 60 * 60))
    : null;
  const ageLabel = ageHours === null ? '' : ageHours < 1 ? 'Just generated' : ageHours < 24 ? `${ageHours}h ago` : `${Math.floor(ageHours / 24)}d ago`;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center gap-2 mb-5">
        <BookOpen className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/80">AI Investment Profile</h3>
        <span className="ml-auto text-[10px] text-white/20">{ageLabel}</span>
      </div>

      <div className="space-y-4">
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const content = profile[key];
          if (!content) return null;
          return (
            <div key={key} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className="w-3 h-3 text-violet-400/60" />
                <span className="text-[10px] font-bold text-violet-400/70 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">{content}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}