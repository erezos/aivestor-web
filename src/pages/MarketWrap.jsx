import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Newspaper, Share2, Copy, TrendingUp, TrendingDown,
  Zap, RefreshCw, Mail, Check, ArrowLeft, BarChart3, Globe, ShieldAlert
} from 'lucide-react';
import { Link } from 'react-router-dom';

function WrapSection({ title, content, icon: Icon, accentClass }) {
  if (!content) return null;
  return (
    <div className={`glass rounded-2xl p-5 border ${accentClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accentClass.replace('border-', 'text-').replace('/20', '')}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${accentClass.replace('border-', 'text-').replace('/20', '')}`}>{title}</span>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{content}</p>
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`bg-white/5 rounded animate-pulse ${className}`} />;
}

export default function MarketWrap() {
  const today = new Date().toISOString().split('T')[0];
  const [email, setEmail]         = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: wrap, isLoading, refetch } = useQuery({
    queryKey: ['market_wrap_page', today],
    queryFn: async () => {
      const rows = await base44.entities.CachedData.filter({ cache_key: `market_wrap_${today}` });
      return rows[0]?.data ? JSON.parse(rows[0].data) : null;
    },
    staleTime: 30 * 60 * 1000,
  });

  const handleGenerate = async () => {
    setGenerating(true);
    await base44.functions.invoke('generateMarketWrap', {});
    await refetch();
    setGenerating(false);
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    await base44.entities.EmailSubscriber.create({ email, source: 'market_wrap' });
    setSubscribed(true);
    setEmail('');
  };

  const pageUrl = window.location.href;
  const shareText = wrap?.headline ? `📊 ${wrap.headline} — AIVestor Daily Market Wrap` : 'AIVestor Daily Market Wrap';

  const handleCopy = () => {
    navigator.clipboard.writeText(pageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24 md:pb-8">

      {/* Back */}
      <Link to="/Dashboard" className="inline-flex items-center gap-2 text-white/30 hover:text-white/60 text-xs transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
      </Link>

      {/* Masthead */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <Newspaper className="w-4 h-4 text-violet-400" />
          <span className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em]">AIVestor Daily</span>
        </div>
        <p className="text-[11px] text-white/20">{formattedDate}</p>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4 mt-2">
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : wrap ? (
        <>
          {/* Headline + intro */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.1 } }}>
            <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">{wrap.headline}</h1>
            <p className="text-sm text-white/55 mt-3 leading-relaxed">{wrap.intro_paragraph}</p>
          </motion.div>

          {/* Share bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-white/20 uppercase tracking-wider mr-1">Share</span>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glass-hover text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              <Share2 className="w-3 h-3" /> Twitter/X
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glass-hover text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              <Share2 className="w-3 h-3" /> LinkedIn
            </a>
            <button onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glass-hover text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>

          {/* Top movers strip */}
          {wrap.top_movers?.length > 0 && (
            <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-white/20 uppercase tracking-wider">Top Movers</span>
              {wrap.top_movers.map(m => (
                <Link key={m.symbol} to={`/Asset?symbol=${m.symbol}`}
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                    m.positive
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                  }`}
                >
                  {m.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {m.symbol} {m.change}
                </Link>
              ))}
            </div>
          )}

          {/* Article sections */}
          <div className="space-y-4">
            <WrapSection title="Equities" content={wrap.equities_section} icon={BarChart3} accentClass="border-emerald-500/20" />
            <WrapSection title="Crypto" content={wrap.crypto_section} icon={Zap} accentClass="border-amber-500/20" />
            <WrapSection title="Macro Outlook" content={wrap.macro_outlook} icon={Globe} accentClass="border-blue-500/20" />
            {wrap.ai_insight && (
              <div className="glass rounded-2xl p-5 border border-fuchsia-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-fuchsia-400" />
                  <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">AI Insight</span>
                  <span className="ml-auto text-[10px] text-white/20">Powered by AIVestor</span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed font-medium italic">"{wrap.ai_insight}"</p>
              </div>
            )}
          </div>

          {/* Email subscribe */}
          <div className="glass rounded-2xl p-6 border border-violet-500/10 text-center">
            <Mail className="w-7 h-7 text-violet-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">Get the Daily Wrap in Your Inbox</h3>
            <p className="text-xs text-white/30 mb-4">Free market intelligence every morning before the open</p>
            {subscribed ? (
              <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-semibold">
                <Check className="w-4 h-4" /> You're subscribed — see you tomorrow!
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" required
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/20 outline-none focus:border-violet-500/50 transition-colors"
                />
                <button type="submit"
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all whitespace-nowrap"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

          {/* CTA */}
          <div className="glass rounded-2xl p-5 text-center border border-white/5">
            <p className="text-xs text-white/25 mb-3">See live AI signals for every asset mentioned above</p>
            <Link to="/HotBoard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              View Live AI Signals <TrendingUp className="w-4 h-4" />
            </Link>
          </div>
        </>
      ) : (
        /* Not yet generated */
        <div className="glass rounded-2xl p-10 text-center border border-violet-500/10 mt-4">
          <Newspaper className="w-10 h-10 text-violet-400/30 mx-auto mb-4" />
          <h2 className="text-base font-bold text-white mb-2">Today's Wrap Hasn't Been Generated Yet</h2>
          <p className="text-sm text-white/30 mb-6">The daily market wrap is auto-generated at 6:30 AM.<br />You can generate it manually now.</p>
          <button onClick={handleGenerate} disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition-all disabled:opacity-60"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {generating ? 'Generating… (~5 seconds)' : 'Generate Now (1 credit)'}
          </button>
        </div>
      )}
    </div>
  );
}