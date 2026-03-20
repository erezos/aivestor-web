import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';

const BROKERS = [
  {
    name: 'Vantage Markets',
    tagline: 'Trade Stocks, Forex & Crypto',
    offer: 'Start with $50 — Ultra-low spreads',
    badge: 'TRUSTED PARTNER',
    badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    cta: 'Open Account →',
    url: /Mobi|Android/i.test(navigator.userAgent)
      ? 'https://h5.vantagemarketapp.com/h5/thirdparty/support/register?agentAccount=MjQwMDAzOTk=&invitecode=tQciI764'
      : 'https://www.vantagemarkets.com/open-live-account/?affid=MjQwMDAzOTk=&invitecode=tQciI764',
    gradient: 'from-violet-600/15 to-fuchsia-600/10',
    border: 'border-violet-500/20',
  },
  {
    name: 'eToro',
    tagline: 'Social Trading & Investing',
    offer: 'Copy top traders — No commission on stocks',
    badge: 'POPULAR',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cta: 'Start Trading →',
    url: 'https://www.etoro.com',
    gradient: 'from-emerald-600/15 to-teal-600/10',
    border: 'border-emerald-500/20',
  },
  {
    name: 'XTB',
    tagline: 'Award-Winning Trading Platform',
    offer: '0% commission on stocks & ETFs',
    badge: 'TOP RATED',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    cta: 'Trade Now →',
    url: 'https://www.xtb.com',
    gradient: 'from-amber-600/15 to-orange-600/10',
    border: 'border-amber-500/20',
  },
];

export default function AffiliateBanner() {
  const [index, setIndex] = useState(0);
  const broker = BROKERS[index];

  // Auto-rotate every 6 seconds
  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % BROKERS.length), 6000);
    return () => clearInterval(id);
  }, []);

  const prev = () => setIndex(i => (i - 1 + BROKERS.length) % BROKERS.length);
  const next = () => setIndex(i => (i + 1) % BROKERS.length);

  return (
    <div className="relative">
      {/* Sponsored label */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[9px] text-white/15 uppercase tracking-widest">Sponsored</span>
        <div className="flex items-center gap-1">
          {BROKERS.map((_, i) => (
            <button key={i} onClick={() => setIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === index ? 'bg-white/40' : 'bg-white/10'}`}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.a
          key={index}
          href={broker.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className={`group block relative overflow-hidden rounded-2xl bg-gradient-to-br ${broker.gradient} border ${broker.border} p-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${broker.badgeColor}`}>
                  {broker.badge}
                </span>
              </div>
              <div className="text-sm font-bold text-white">{broker.name}</div>
              <div className="text-[10px] text-white/40 mt-0.5">{broker.tagline}</div>
              <div className="text-[11px] text-white/60 mt-1.5 font-medium">{broker.offer}</div>
            </div>
            <div className="flex-shrink-0 ml-3 flex flex-col items-end gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white/50" />
              </div>
              <span className="text-[10px] font-semibold text-white/50 group-hover:text-white/80 transition-colors whitespace-nowrap flex items-center gap-1">
                {broker.cta} <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
        </motion.a>
      </AnimatePresence>

      {/* Nav arrows */}
      <button onClick={prev} className="absolute left-2 top-1/2 translate-y-1/4 p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/30 hover:text-white/60 transition-all">
        <ChevronLeft className="w-3 h-3" />
      </button>
      <button onClick={next} className="absolute right-2 top-1/2 translate-y-1/4 p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/30 hover:text-white/60 transition-all">
        <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}