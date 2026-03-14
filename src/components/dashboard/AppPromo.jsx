import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, ArrowRight, Zap, Bell, BarChart3, Star } from 'lucide-react';

export default function AppPromo() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-transparent border border-violet-500/20 p-6"
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-3xl" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center ring-1 ring-fuchsia-400/30">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-xs font-black text-white tracking-tight">Technical-Analysis<span className="text-fuchsia-400">.AI</span></span>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-2 h-2 fill-amber-400 text-amber-400" />)}
                <span className="text-[9px] text-white/30 ml-0.5">4.9</span>
              </div>
            </div>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">FREE</span>
        </div>
        
        <h3 className="text-base font-bold text-white mb-1.5">Level up on mobile 📱</h3>
        <p className="text-xs text-white/40 mb-3 leading-relaxed">
          AI signals, push alerts & copy trading — your edge, always in your pocket.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <Bell className="w-3 h-3 text-fuchsia-400" /> Push Alerts
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <Zap className="w-3 h-3 text-violet-400" /> AI Signals
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <BarChart3 className="w-3 h-3 text-violet-400" /> Copy Trade
          </div>
        </div>

        <div className="flex gap-2">
          <a
            href="https://apps.apple.com/us/app/technical-analysis-ai/id6746874804"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-600 hover:to-fuchsia-600 text-white text-xs font-bold transition-all border border-violet-500/20"
          >
            🍎 App Store
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.ioa.TipSync"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-xs font-bold transition-all border border-white/10"
          >
            🤖 Google Play
          </a>
        </div>
      </div>
    </motion.div>
  );
}