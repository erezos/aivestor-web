import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, Plus, RefreshCw, Flame, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function getRefillCountdown(lastAccrualDate) {
  if (!lastAccrualDate) return null;
  const last = new Date(lastAccrualDate + 'T00:00:00Z');
  const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
  const now = new Date();
  const diff = next - now;
  if (diff <= 0) return 'Refilling soon...';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `+1 free token in ${h}h ${m}m`;
}

export default function WalletBar({ walletData, onBuyTokens, onRefresh, isLoggedIn }) {
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (!walletData) return;
    setCountdown(getRefillCountdown(walletData.lastFreeAccrualDate));
    const t = setInterval(() => setCountdown(getRefillCountdown(walletData.lastFreeAccrualDate)), 30000);
    return () => clearInterval(t);
  }, [walletData]);

  const free = walletData?.freeBalance ?? 0;
  const paid = walletData?.paidBalance ?? 0;
  const total = free + paid;
  const cap = walletData?.rules?.freeCap ?? 3;

  if (isLoggedIn === false) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="glass rounded-2xl p-4 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Coins className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Sign in to use your tokens</p>
            <p className="text-xs text-white/30 mt-0.5">You get 1 free token every day — no card needed</p>
          </div>
        </div>
        <button
          onClick={() => base44.auth.redirectToLogin(window.location.href)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold hover:opacity-90 transition-opacity flex-shrink-0"
        >
          <LogIn className="w-3 h-3" /> Sign In
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
      className="glass rounded-2xl p-4 flex items-center justify-between gap-3"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <Coins className="w-5 h-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          {walletData ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-white">{total}</span>
                <span className="text-xs text-white/30 font-medium">tokens</span>
                {free > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-semibold">
                    {free} free
                  </span>
                )}
                {paid > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/20 font-semibold">
                    {paid} paid
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex gap-0.5">
                  {Array.from({ length: cap }).map((_, i) => (
                    <div key={i} className={`w-3 h-1.5 rounded-full transition-all ${i < free ? 'bg-emerald-400' : 'bg-white/10'}`} />
                  ))}
                </div>
                {countdown && (
                  <span className="text-[10px] text-white/25 flex items-center gap-1">
                    <Flame className="w-2.5 h-2.5 text-amber-500/50" /> {countdown}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onRefresh} className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/5 transition-all" title="Refresh balance">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button onClick={onBuyTokens}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3 h-3" /> Get Tokens
        </button>
      </div>
    </motion.div>
  );
}