import React from 'react';
import { Clock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketNews } from '../marketData';

const sentimentColors = {
  bullish: 'text-emerald-400',
  bearish: 'text-rose-400',
  neutral: 'text-amber-400',
};

export default function LatestNews() {
  const { data: articles, isLoading } = useQuery({
    queryKey: ['marketNews'],
    queryFn: fetchMarketNews,
    staleTime: 10 * 60 * 1000, // 10 min cache
    retry: 1,
  });

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-semibold text-white/80">AI-Curated News</h3>
        </div>
        <Link to="/News" className="text-xs text-violet-400 hover:text-violet-300 font-medium">
          All News →
        </Link>
      </div>

      <div className="space-y-1">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-3 px-3 rounded-xl flex items-start gap-3">
                <div className="w-1 h-10 rounded-full bg-white/5 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-full bg-white/5 rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse" />
                  <div className="h-2.5 w-1/3 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            ))
          : (articles || []).filter(Boolean).slice(0, 5).map((article, i) => (
              <div
                key={i}
                className="py-3 px-3 rounded-xl glass-hover transition-all cursor-pointer group"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-1 h-10 rounded-full flex-shrink-0 mt-0.5 ${
                    article.sentiment === 'bullish' ? 'bg-gain' :
                    article.sentiment === 'bearish' ? 'bg-loss' : 'bg-amber-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-semibold text-white/30">{article.source}</span>
                      <span className="text-white/10">•</span>
                      <span className="text-[10px] text-white/20 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {article.time}
                      </span>
                      <span className="text-white/10">•</span>
                      <span className={`text-[10px] font-semibold ${sentimentColors[article.sentiment] || 'text-amber-400'}`}>
                        {article.sentiment}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}