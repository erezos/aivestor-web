import React from 'react';
import { motion } from 'framer-motion';
import { Smartphone, ArrowRight, Zap, Bell, BarChart3 } from 'lucide-react';

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
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Mobile App</span>
        </div>
        
        <h3 className="text-lg font-bold text-white mb-2">Get Real-Time Alerts</h3>
        <p className="text-xs text-white/40 mb-4 leading-relaxed">
          Never miss a trade. Get AI signals, push notifications & copy trading directly on your phone.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <Bell className="w-3 h-3 text-violet-400" /> Push Alerts
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
          >
            iOS App
            <ArrowRight className="w-3 h-3" />
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.ioa.TipSync"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10"
          >
            Android
            <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}