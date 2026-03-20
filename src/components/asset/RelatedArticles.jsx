import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Newspaper, Zap, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

const SENTIMENT_CFG = {
  Bullish:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: TrendingUp },
  Bearish:  { color: 'text-rose-400',    bg: 'bg-rose-500/10 border-rose-500/20',       icon: TrendingDown },
  Neutral:  { color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',     icon: Minus },
};

const IMPACT_DOT = { 1: 'bg-white/20', 2: 'bg-amber-400', 3: 'bg-rose-400' };

function SponsoredCard() {
  return (
    <a
      href="https://www.vantagemarkets.com/open-live-account/?affid=MjQwMDAzOTk=&invitecode=tQciI764"
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="group block glass rounded-xl p-4 border border-amber-500/10 glass-hover transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold bg-amber-500/10 border-amber-500/20 text-amber-400">
          Sponsored
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 group-hover:text-white leading-snug transition-colors">
            Trade Stocks & Crypto with Ultra-Low Spreads — Open a Free Account on Vantage Markets
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-white/20">vantagemarkets.com</span>
          </div>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </a>
  );
}

function ArticleCard({ article, index }) {
  const cfg = SENTIMENT_CFG[article.sentiment] || SENTIMENT_CFG.Neutral;
  const Icon = cfg.icon;
  const timeAgo = article.datetime
    ? formatDistanceToNow(new Date(article.datetime * 1000), { addSuffix: true })
    : '';

  return (
    <motion.a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group block glass rounded-xl p-4 glass-hover transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Sentiment badge */}
        <div className={`flex-shrink-0 mt-0.5 flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
          <Icon className="w-3 h-3" />
          {article.sentiment}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-white/80 group-hover:text-white leading-snug line-clamp-2 transition-colors">
            {article.headline}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-white/20">{timeAgo}</span>
            {/* Impact dots */}
            <div className="flex items-center gap-0.5 ml-auto">
              {[1, 2, 3].map(d => (
                <span key={d} className={`w-1.5 h-1.5 rounded-full ${d <= article.impact ? IMPACT_DOT[article.impact] : 'bg-white/10'}`} />
              ))}
            </div>
          </div>
        </div>

        <ExternalLink className="w-3.5 h-3.5 text-white/15 group-hover:text-white/40 flex-shrink-0 mt-1 transition-colors" />
      </div>
    </motion.a>
  );
}

export default function RelatedArticles({ symbol }) {
  const { data, isLoading } = useQuery({
    queryKey: ['assetNews', symbol],
    queryFn: () => base44.functions.invoke('getAssetNews', { symbol }).then(r => r.data),
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache
    retry: 1,
  });

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white/80">Related News</h3>
        {isLoading && (
          <motion.span
            className="ml-auto text-[10px] font-mono text-violet-400/40"
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            LOADING…
          </motion.span>
        )}
      </div>

      {/* AI Narrative — the "magic" summary */}
      {data?.narrative && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl bg-violet-500/8 border border-violet-500/15"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <Zap className="w-3 h-3 text-violet-400" />
            <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">AI Market Pulse</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">{data.narrative}</p>
        </motion.div>
      )}

      {/* Skeleton */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      )}

      {/* Articles */}
      {!isLoading && data?.articles?.length > 0 && (
        <div className="space-y-2">
          {data.articles.map((article, i) => (
            <React.Fragment key={article.id || i}>
              <ArticleCard article={article} index={i} />
              {i === 1 && <SponsoredCard />}
            </React.Fragment>
          ))}
        </div>
      )}

      {!isLoading && (!data?.articles || data.articles.length === 0) && (
        <p className="text-sm text-white/20 text-center py-6">No recent news found</p>
      )}

      {/* Impact legend */}
      {!isLoading && data?.articles?.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-3 text-[10px] text-white/20">
          <span>Price impact:</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" /> Low</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" /> Medium</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" /> High</span>
        </div>
      )}
    </div>
  );
}