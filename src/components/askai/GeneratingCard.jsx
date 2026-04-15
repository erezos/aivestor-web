import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, TrendingUp, Shield, Activity, FileText, CheckCircle2, Zap } from 'lucide-react';

const STEPS = [
  { icon: Activity,   label: 'Fetching live price & market data',         durationMs: 3000  },
  { icon: TrendingUp, label: 'Calculating RSI, MACD & Bollinger Bands',   durationMs: 5000  },
  { icon: Shield,     label: 'Scanning options flow, short interest & insiders', durationMs: 8000  },
  { icon: Zap,        label: 'Analyzing macro context & earnings calendar', durationMs: 10000 },
  { icon: Brain,      label: 'Running CFA-level AI synthesis…',            durationMs: 60000 },
  { icon: FileText,   label: 'Structuring your Edge Report',               durationMs: 90000 },
];

const FACTS = [
  'Our AI reads 8+ data signals simultaneously — far more than any single analyst.',
  'Technical indicators are computed from 120+ days of real OHLCV bar data.',
  'The AI cross-validates price action against analyst consensus and news sentiment.',
  'Deep reports use Claude Sonnet — one of the world\'s most capable reasoning models.',
  'Insider transaction data is sourced from SEC Form 4 filings via Finnhub.',
  'The system flags earnings dates so you\'re never blindsided by binary events.',
  'Options Put/Call ratio is used to gauge institutional hedging activity.',
  'Short interest data reveals whether professional bears are loading up.',
];

export default function GeneratingCard({ symbol }) {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const ticker = setInterval(() => {
      const ms = Date.now() - start;
      setElapsed(ms);
      // advance steps based on elapsed time
      let step = 0;
      for (let i = 0; i < STEPS.length; i++) {
        if (ms >= STEPS[i].durationMs) step = i + 1;
      }
      setActiveStep(Math.min(step, STEPS.length - 1));
    }, 500);
    const factTicker = setInterval(() => setFactIdx(i => (i + 1) % FACTS.length), 5000);
    return () => { clearInterval(ticker); clearInterval(factTicker); };
  }, []);

  const elapsedSec = Math.floor(elapsed / 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass rounded-2xl p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-30 animate-ping" />
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Brain className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base">Analyzing <span className="text-violet-300">{symbol}</span></p>
          <p className="text-white/40 text-xs mt-0.5">CFA-level multi-signal analysis in progress…</p>
          <p className="text-white/20 text-[10px] mt-1">{elapsedSec}s elapsed · Deep reports take 30–120s</p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const done    = i < activeStep;
          const active  = i === activeStep;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: done || active ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all ${
                active ? 'bg-violet-500/10 border border-violet-500/20' :
                done   ? 'bg-white/3' : ''
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              ) : active ? (
                <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin flex-shrink-0" />
              ) : (
                <StepIcon className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
              )}
              <span className={`text-xs ${done ? 'text-white/50 line-through' : active ? 'text-white/80 font-medium' : 'text-white/25'}`}>
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Rotating fun fact */}
      <div className="border-t border-white/5 pt-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={factIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="text-[11px] text-white/25 text-center leading-relaxed"
          >
            💡 {FACTS[factIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Don't close warning */}
      <p className="text-[10px] text-white/15 text-center">
        Please keep this page open while the report generates
      </p>
    </motion.div>
  );
}