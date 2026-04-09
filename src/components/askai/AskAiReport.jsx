import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ChevronDown, CheckCircle, AlertCircle, BarChart2, Newspaper, GitBranch, AlertTriangle, Target, ShieldAlert, Sparkles } from 'lucide-react';

const SECTION_ICONS = {
  market_snapshot:      BarChart2,
  ai_conclusion:        Sparkles,
  technical_view:       BarChart2,
  sentiment_news_pulse: Newspaper,
  scenario_paths:       GitBranch,
  risks_invalidations:  AlertTriangle,
  action_playbook:      Target,
  disclaimer:           ShieldAlert,
};

const STANCE_CONFIG = {
  bullish:  { label: 'Bullish',  color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', icon: TrendingUp,   glow: 'shadow-emerald-500/20' },
  bearish:  { label: 'Bearish',  color: 'text-rose-400',    bg: 'bg-rose-400/10',    border: 'border-rose-400/20',    icon: TrendingDown, glow: 'shadow-rose-500/20' },
  neutral:  { label: 'Neutral',  color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/20',   icon: Minus,        glow: 'shadow-amber-500/20' },
};

function ConfidenceMeter({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F43F5E';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-wider">Confidence</span>
        <span className="text-sm font-black" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ background: color }}
        />
      </div>
    </div>
  );
}

function SectionCard({ section, index }) {
  const [open, setOpen] = useState(index < 2);
  const Icon = SECTION_ICONS[section.id] || BarChart2;
  const isDisclaimer = section.id === 'disclaimer';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      className={`glass rounded-xl overflow-hidden ${isDisclaimer ? 'opacity-50' : ''}`}
    >
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors"
      >
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-white/80 flex-1">{section.title}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
              {section.content && (
                <p className="text-xs text-white/50 leading-relaxed">{section.content}</p>
              )}
              {section.bullets?.length > 0 && (
                <ul className="space-y-2">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                      <div className="w-1 h-1 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                      <span className="leading-relaxed">{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AskAiReport({ report, symbol }) {
  if (!report) return null;

  const stance = report.stance || 'neutral';
  const sc = STANCE_CONFIG[stance] || STANCE_CONFIG.neutral;
  const StanceIcon = sc.icon;
  const contentSections = (report.sections || []).filter(s => s.id !== 'disclaimer');
  const disclaimer = (report.sections || []).find(s => s.id === 'disclaimer');

  return (
    <div className="space-y-4">
      {/* Report Hero */}
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className={`glass rounded-2xl p-5 border ${sc.border} shadow-xl ${sc.glow}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs text-white/30 mb-1">AI Edge Report</div>
            <h2 className="text-2xl font-black text-white">{symbol}</h2>
            <div className="text-xs text-white/25 mt-0.5">{report.assetMeta?.timeframe} · {new Date(report.generatedAt).toLocaleString()}</div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl ${sc.bg} border ${sc.border}`}>
            <StanceIcon className={`w-4 h-4 ${sc.color}`} />
            <span className={`text-sm font-black ${sc.color}`}>{sc.label}</span>
          </div>
        </div>

        <ConfidenceMeter value={report.confidence ?? 0.5} />

        {report.summary && (
          <p className="mt-4 text-sm text-white/60 leading-relaxed border-t border-white/5 pt-4">{report.summary}</p>
        )}

        {/* Thesis */}
        {report.thesis?.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Bull Thesis</div>
            {report.thesis.map((t, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-emerald-400/80">
                <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        )}

        {/* Risk Factors */}
        {report.riskFactors?.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="text-[10px] text-white/30 uppercase tracking-wider font-semibold">Key Risks</div>
            {report.riskFactors.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-rose-400/80">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Sections */}
      <div className="space-y-2">
        {contentSections.map((section, i) => (
          <SectionCard key={section.id} section={section} index={i} />
        ))}
      </div>

      {/* Disclaimer */}
      {disclaimer && (
        <div className="px-4 py-3 rounded-xl bg-white/2 border border-white/5 text-[10px] text-white/20 leading-relaxed">
          {disclaimer.content}
        </div>
      )}
    </div>
  );
}