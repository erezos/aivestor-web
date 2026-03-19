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
          <div className="glass rounded-2xl p-4 flex flex-col items-center gap-2">
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Sponsored</p>
            <div style={{ width: '100%', maxWidth: 336, aspectRatio: '336/280', overflow: 'hidden' }}>
              <iframe
                src="https://cdn.plus500.com/Media/Banners/336x280/98235/index.html?set=affiliates3 - Indonesia Local Banners - April 2025&language=EN&country=ID&crId=98235&url=https%3A%2F%2Fwww.plus500.com%2Fen--1%2Fmultiplatformdownload%3Fclt%3DWeb%26id%3D138803%26pl%3D2%26crId%3D98235"
                width="336"
                height="280"
                scrolling="no"
                frameBorder="0"
                style={{ border: 'none', width: '100%', height: '100%' }}
                title="Plus500 Promotion"
              />
            </div>
          </div>
          <AppPromo />
        </div>
      </div>
    </div>
  );
}