import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Search, ChevronDown, Clock, Zap, BarChart2, Brain, AlertTriangle, BookOpen, Target, Info, TrendingUp, Shield, Activity, FileText, CheckCircle2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import WalletBar from '@/components/askai/WalletBar';
import AskAiReport from '@/components/askai/AskAiReport';
import AskAiHistory from '@/components/askai/AskAiHistory';
import TokenPacksModal from '@/components/askai/TokenPacksModal';
import GeneratingCard from '@/components/askai/GeneratingCard';

const TIMEFRAME_OPTIONS = [
  { id: 'scalp',    label: 'Scalp',     desc: 'Minutes to hours' },
  { id: 'swing',    label: 'Swing',     desc: '2–10 days' },
  { id: 'longterm', label: 'Long-term', desc: 'Weeks to months' },
];

const POPULAR = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'BTC', 'ETH', 'SPY', 'AMZN', 'META', 'GOOGL'];

export default function AskAI() {
  const urlParams = new URLSearchParams(window.location.search);
  const preloadSymbol = urlParams.get('symbol') || '';

  const [symbol, setSymbol] = useState(preloadSymbol);
  const depth = 'deep';
  const [timeframe, setTimeframe] = useState('swing');
  const [report, setReport] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPacks, setShowPacks] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [paypalSuccess, setPaypalSuccess] = useState(false);
  const reportRef = useRef(null);
  const qc = useQueryClient();

  const [isLoggedIn, setIsLoggedIn] = useState(null);
  useEffect(() => {
    base44.auth.isAuthenticated().then(setIsLoggedIn);
  }, []);

  const { data: walletData, refetch: refetchWallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getWallet', { requestId: crypto.randomUUID() });
      return res.data?.data;
    },
    staleTime: 30 * 1000,
    enabled: isLoggedIn === true,
  });

  // Handle PayPal return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('paypal_order_id') || params.get('token'); // PayPal returns 'token' param
    const packId = params.get('pack_id');
    const packTokens = params.get('pack_tokens');
    if (orderId && packId && packTokens) {
      base44.functions.invoke('capturePaypalOrder', { orderId, packId, tokens: parseInt(packTokens) })
        .then((res) => {
          if (res.data?.ok) {
            setPaypalSuccess(true);
            refetchWallet();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
            setTimeout(() => setPaypalSuccess(false), 5000);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Auto-generate if symbol pre-loaded from Asset page
  const hasAutoRun = useRef(false);
  useEffect(() => {
    if (preloadSymbol && !hasAutoRun.current) {
      hasAutoRun.current = true;
      // slight delay so wallet loads first
      setTimeout(() => handleGenerate(preloadSymbol.toUpperCase()), 600);
    }
  }, []);

  const cost = 1;
  const totalBalance = (walletData?.freeBalance ?? 0) + (walletData?.paidBalance ?? 0);
  const canAfford = totalBalance >= cost;

  async function handleGenerate(sym = symbol) {
    const s = sym.trim();
    if (!s) return;
    setError(null);
    setReport(null);
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('askAiAnalyze', {
        requestId: crypto.randomUUID(),
        asset: s,
        depth,
        timeframe,
        locale: 'en',
      });
      const d = res.data;
      if (d?.error) throw new Error(d.error.message || 'Analysis failed');
      setReport(d?.data?.report ?? null);
      await refetchWallet();
      qc.invalidateQueries({ queryKey: ['askAiHistory'] });
      setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6 pb-24 md:pb-8 max-w-3xl mx-auto">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3 h-3" /> AI Edge Reports
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
          Your Personal{' '}
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
            Wall Street Analyst
          </span>
        </h1>
        <p className="mt-2 text-sm text-white/40 max-w-sm mx-auto">
          CFA-level analysis on any stock or crypto — in seconds.
        </p>
      </motion.div>

      {/* Wallet Bar */}
      <WalletBar walletData={walletData} onBuyTokens={() => setShowPacks(true)} onRefresh={refetchWallet} isLoggedIn={isLoggedIn} />

      {/* Search Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-5 space-y-5"
      >
        {/* Symbol Input */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Stock, Ticker, or Company Name</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canAfford && !generating && handleGenerate()}
              placeholder="AAPL, BTC, מור השקעות, Volkswagen..."
              dir="auto"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white placeholder-white/20 text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/8 transition-all"
              maxLength={80}
            />
          </div>
          {/* Popular chips */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {POPULAR.map(s => (
              <button key={s} onClick={() => setSymbol(s.toUpperCase())}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${symbol === s ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-white/3 border-white/8 text-white/30 hover:text-white/60 hover:border-white/20'}`}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* Timeframe Selector */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Trading Timeframe</label>
          <div className="grid grid-cols-3 gap-2">
            {TIMEFRAME_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setTimeframe(opt.id)}
                className={`p-2.5 rounded-xl border text-center transition-all ${timeframe === opt.id ? 'border-violet-500/40 bg-violet-500/10' : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}
              >
                <div className={`text-xs font-bold ${timeframe === opt.id ? 'text-violet-300' : 'text-white/50'}`}>{opt.label}</div>
                <div className="text-[10px] text-white/25 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button */}
        <div className="space-y-2">
          {!canAfford && walletData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>You need <strong>{cost} tokens</strong> for this depth. You have <strong>{totalBalance}</strong>.</span>
              <button onClick={() => setShowPacks(true)} className="ml-auto text-amber-300 underline font-semibold whitespace-nowrap">Get tokens</button>
            </motion.div>
          )}

          <button
            onClick={() => isLoggedIn ? handleGenerate() : base44.auth.redirectToLogin(window.location.href)}
            disabled={!symbol || generating || (isLoggedIn && !canAfford)}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all relative overflow-hidden group disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/20"
          >
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.span key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2"
                >
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating AI Edge Report...
                </motion.span>
              ) : (
                <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate AI Edge Report · {cost} 🪙
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        {paypalSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"
          >
            ✅ Tokens purchased successfully! Your balance has been updated.
          </motion.div>
        )}

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* Generating animation */}
      <AnimatePresence>
        {generating && <GeneratingCard symbol={symbol} />}
      </AnimatePresence>

      {/* Report Output */}
      <AnimatePresence>
        {report && !generating && (
          <motion.div ref={reportRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AskAiReport report={report} symbol={symbol} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Toggle */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <button onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl glass glass-hover text-sm text-white/50 hover:text-white/70 transition-all"
        >
          <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> Past Reports</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showHistory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="pt-3">
                <AskAiHistory onSelect={(r, sym) => { setReport(r); setSymbol(sym); setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth' }), 100); }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Token Packs Modal */}
      <TokenPacksModal open={showPacks} onClose={() => setShowPacks(false)} />
    </div>
  );
}