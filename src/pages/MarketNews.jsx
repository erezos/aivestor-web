import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Clock, TrendingUp, TrendingDown, Sparkles, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketNews } from '../components/marketData';

const CATEGORIES = ['All', 'Stocks', 'Crypto', 'Economy', 'Tech', 'Commodities'];

const sentimentConfig = {
  bullish: { color: 'text-emerald-400', icon: TrendingUp },
  bearish: { color: 'text-rose-400', icon: TrendingDown },
  neutral: { color: 'text-amber-400', icon: Sparkles },
};

export default function MarketNews() {
  const [activeCategory, setActiveCategory] = useState('All');

  const { data: articles, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['marketNews'],
    queryFn: fetchMarketNews,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const filtered = (articles || []).filter(a =>
    activeCategory === 'All' || a.category === activeCategory
  );

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Newspaper className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Market News</h1>
          </div>
          <p className="text-sm text-white/30">AI-curated market intelligence • Live</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-xl glass glass-hover transition-all"
        >
          <RefreshCw className={`w-4 h-4 text-white/40 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </motion.div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              activeCategory === cat
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'glass text-white/40 hover:text-white/60'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* News Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-4 flex gap-4">
              <div className="w-24 h-24 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-4 bg-white/5 rounded animate-pulse" />
                <div className="h-4 w-4/5 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-3/5 bg-white/5 rounded animate-pulse mt-2" />
                <div className="h-3 w-2/5 bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((article, i) => {
              const sConfig = sentimentConfig[article.sentiment] || sentimentConfig.neutral;
              const SentimentIcon = sConfig.icon;
              return (
                <motion.article
                  key={article.title + i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.04 }}
                  layout
                  className="glass rounded-2xl overflow-hidden group cursor-pointer glass-hover transition-all"
                >
                  <div className="flex gap-4 p-4">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-white/5 flex items-center justify-center flex-shrink-0">
                      <Newspaper className="w-6 h-6 text-white/10" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-violet-300 transition-colors line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-[11px] text-white/30 mt-1.5 line-clamp-2 leading-relaxed">{article.summary}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-semibold text-white/40">{article.source}</span>
                        <span className="text-white/10">•</span>
                        <span className="text-[10px] text-white/20 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {article.time}
                        </span>
                        <span className="text-white/10">•</span>
                        <span className={`text-[10px] font-semibold flex items-center gap-1 ${sConfig.color}`}>
                          <SentimentIcon className="w-2.5 h-2.5" />
                          {article.sentiment}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && !isLoading && (
            <div className="col-span-2 text-center py-12 text-white/30">
              No articles in this category yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}