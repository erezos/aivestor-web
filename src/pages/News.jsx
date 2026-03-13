import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, Clock, TrendingUp, TrendingDown, Sparkles, ExternalLink } from 'lucide-react';

const CATEGORIES = ['All', 'Stocks', 'Crypto', 'Economy', 'Tech', 'Commodities'];

const NEWS_DATA = [
  { title: 'NVIDIA Reports Record Q4 Earnings, Data Center Revenue Surges 150%', summary: 'NVIDIA posted record quarterly revenue of $22.1 billion, beating estimates by 15%. The company\'s data center business continues to dominate the AI chip market.', source: 'Reuters', time: '2h ago', category: 'Stocks', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=200&h=120&fit=crop' },
  { title: 'Federal Reserve Signals Potential Rate Cut in June Meeting', summary: 'Fed Chair Jerome Powell indicated openness to rate cuts if inflation continues its downward trajectory, citing improving economic conditions.', source: 'Bloomberg', time: '3h ago', category: 'Economy', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=200&h=120&fit=crop' },
  { title: 'Bitcoin Approaches $100K as Institutional Demand Accelerates', summary: 'Bitcoin is within striking distance of the psychological $100,000 level as ETF inflows continue to surge and institutional adoption deepens.', source: 'CoinDesk', time: '4h ago', category: 'Crypto', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=200&h=120&fit=crop' },
  { title: 'Apple Unveils New AI Features for iPhone at Spring Event', summary: 'Apple announced sweeping AI enhancements across its product lineup, including advanced Siri capabilities and on-device AI processing.', source: 'CNBC', time: '5h ago', category: 'Tech', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=200&h=120&fit=crop' },
  { title: 'Oil Prices Drop 3% on China Demand Concerns', summary: 'Crude oil prices fell sharply as weak Chinese economic data raised concerns about future energy demand in the world\'s second-largest economy.', source: 'Financial Times', time: '6h ago', category: 'Commodities', sentiment: 'bearish', image: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=200&h=120&fit=crop' },
  { title: 'Tesla Cybertruck Deliveries Exceed Expectations in Q1', summary: 'Tesla delivered over 50,000 Cybertrucks in Q1 2026, far exceeding analyst expectations. The truck is now profitable on a per-unit basis.', source: 'Electrek', time: '7h ago', category: 'Stocks', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1617886903355-9354c5d92e53?w=200&h=120&fit=crop' },
  { title: 'Ethereum Completes Major Network Upgrade, Gas Fees Drop 80%', summary: 'Ethereum\'s latest protocol upgrade has dramatically reduced transaction costs, making the network more competitive with layer-2 solutions.', source: 'The Block', time: '8h ago', category: 'Crypto', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=200&h=120&fit=crop' },
  { title: 'Semiconductor Stocks Rally on AI Spending Forecast Upgrade', summary: 'Major semiconductor companies surged after industry group raised its 2026 AI infrastructure spending forecast to $500 billion globally.', source: 'MarketWatch', time: '9h ago', category: 'Tech', sentiment: 'bullish', image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=200&h=120&fit=crop' },
];

const sentimentConfig = {
  bullish: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: TrendingUp },
  bearish: { color: 'text-rose-400', bg: 'bg-rose-500/10', icon: TrendingDown },
  neutral: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Sparkles },
};

export default function News() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All' ? NEWS_DATA : NEWS_DATA.filter(n => n.category === activeCategory);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Newspaper className="w-6 h-6 text-violet-400" />
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Market News</h1>
        </div>
        <p className="text-sm text-white/30">AI-curated market intelligence</p>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((article, i) => {
            const sConfig = sentimentConfig[article.sentiment];
            const SentimentIcon = sConfig.icon;
            return (
              <motion.article
                key={article.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                layout
                className="glass rounded-2xl overflow-hidden group cursor-pointer glass-hover transition-all"
              >
                <div className="flex gap-4 p-4">
                  <img
                    src={article.image}
                    alt=""
                    className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white leading-snug group-hover:text-violet-300 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-[11px] text-white/30 mt-1.5 line-clamp-2 leading-relaxed">{article.summary}</p>
                    <div className="flex items-center gap-2 mt-2">
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
      </div>
    </div>
  );
}