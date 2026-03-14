import React from 'react';
import { motion } from 'framer-motion';
import MarketIndices from '../components/dashboard/MarketIndices';
import QuickStats from '../components/dashboard/QuickStats';
import MarketSentiment from '../components/dashboard/MarketSentiment';
import TrendingTickers from '../components/dashboard/TrendingTickers';
import LatestNews from '../components/dashboard/LatestNews';
import AppPromo from '../components/dashboard/AppPromo';

export default function Dashboard() {
  return (
    <div className="space-y-6 pb-20 md:pb-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2"
      >
        <div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">AI</span>Vestor
            </h1>
            <p className="text-sm text-white/30 mt-0.5">Your AI edge in the market · Real-time intel</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-white/30">Markets Open</span>
        </div>
      </motion.div>

      {/* Market Ticker Strip */}
      <MarketIndices />

      {/* Quick Stats */}
      <QuickStats />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-5">
          <TrendingTickers />
          <LatestNews />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-5">
          <MarketSentiment />
          <AppPromo />
        </div>
      </div>
    </div>
  );
}