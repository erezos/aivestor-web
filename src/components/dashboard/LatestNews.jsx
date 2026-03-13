import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ExternalLink, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const NEWS = [
  { title: 'NVIDIA Reports Record Q4 Earnings, Data Center Revenue Surges 150%', source: 'Reuters', time: '2h ago', category: 'Earnings', sentiment: 'bullish' },
  { title: 'Federal Reserve Signals Potential Rate Cut in June Meeting', source: 'Bloomberg', time: '3h ago', category: 'Economy', sentiment: 'bullish' },
  { title: 'Bitcoin Approaches $100K as Institutional Demand Accelerates', source: 'CoinDesk', time: '4h ago', category: 'Crypto', sentiment: 'bullish' },
  { title: 'Apple Unveils New AI Features for iPhone, Stock Hits All-Time High', source: 'CNBC', time: '5h ago', category: 'Tech', sentiment: 'bullish' },
  { title: 'Oil Prices Drop 3% on China Demand Concerns', source: 'FT', time: '6h ago', category: 'Commodities', sentiment: 'bearish' },
];

const sentimentColors = {
  bullish: 'text-emerald-400',
  bearish: 'text-rose-400',
  neutral: 'text-amber-400',
};

export default function LatestNews() {
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
        {NEWS.map((article, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06 }}
            className="py-3 px-3 rounded-xl glass-hover transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className={`w-1 h-10 rounded-full flex-shrink-0 mt-0.5 ${article.sentiment === 'bullish' ? 'bg-gain' : article.sentiment === 'bearish' ? 'bg-loss' : 'bg-amber-400'}`} />
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
                  <span className={`text-[10px] font-semibold ${sentimentColors[article.sentiment]}`}>
                    {article.sentiment}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}