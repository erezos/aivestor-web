import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Crown, Sparkles, Loader2, Shield, ChevronRight, Star, TrendingUp, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// What users unlock with tokens — shown in the hero
const BENEFITS = [
  { icon: '📊', text: 'CFA-level stock & crypto analysis' },
  { icon: '⚡', text: 'Real-time technicals + options flow' },
  { icon: '🎯', text: 'Entry points, targets & invalidation' },
  { icon: '🧠', text: 'AI with 20+ data signals per report' },
];

// Pack metadata for UI treatment
const PACK_META = {
  starter_5_pack:  { badge: '🎁 Welcome Offer', badgeColor: 'from-emerald-500 to-teal-500',  highlight: false, popular: false },
  tokens_5_pack:   { badge: null,                badgeColor: '',                              highlight: false, popular: false },
  tokens_15_pack:  { badge: null,                badgeColor: '',                              highlight: false, popular: false },
  tokens_40_pack:  { badge: '🔥 Most Popular',   badgeColor: 'from-violet-500 to-fuchsia-600', highlight: true,  popular: true  },
  second_25_pack:  { badge: '⚡ Limited Offer',  badgeColor: 'from-amber-500 to-orange-500',  highlight: false, popular: false },
  tokens_100_pack: { badge: '💎 Best Value',     badgeColor: 'from-blue-500 to-cyan-500',     highlight: false, popular: false },
  tokens_250_pack: { badge: '🐋 Whale Pack',     badgeColor: 'from-amber-400 to-orange-500',  highlight: false, popular: false },
};

function PackCard({ pack, onBuy, loading }) {
  const meta = PACK_META[pack.packId] || {};
  const perToken = (pack.price / pack.tokens).toFixed(2);
  const isHighlight = meta.highlight;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-2xl cursor-pointer transition-all duration-200 ${
        isHighlight
          ? 'ring-2 ring-violet-500/60 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10'
          : 'bg-white/4 hover:bg-white/7 ring-1 ring-white/8 hover:ring-white/15'
      }`}
      onClick={() => !loading && onBuy(pack)}
    >
      {/* Badge */}
      {meta.badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r ${meta.badgeColor} text-white text-[11px] font-black whitespace-nowrap shadow-lg`}>
          {meta.badge}
        </div>
      )}

      <div className={`p-4 ${meta.badge ? 'pt-5' : ''}`}>
        <div className="flex items-center justify-between">
          {/* Left: token count + label */}
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${isHighlight ? 'text-white' : 'text-white/90'}`}>
                {pack.tokens}
              </span>
              <span className="text-sm text-white/40 font-medium">AI Reports</span>
            </div>
            <div className="text-[11px] text-white/30 mt-0.5">${perToken} per report</div>
          </div>

          {/* Right: price + buy button */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`text-xl font-black ${isHighlight ? 'text-white' : 'text-white/80'}`}>
                ${pack.price}
              </div>
              {pack.oneTime && (
                <div className="text-[9px] text-white/25 uppercase tracking-wide">one-time</div>
              )}
            </div>

            <button
              disabled={!!loading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex-shrink-0 ${
                isHighlight
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/30'
                  : 'bg-white/8 hover:bg-white/15 text-white/80 hover:text-white border border-white/10'
              }`}
            >
              {loading === pack.packId ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <img
                    src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png"
                    alt="PayPal"
                    className="h-3"
                  />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar showing value relative to max */}
        {isHighlight && (
          <div className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function TokenPacksModal({ open, onClose }) {
  const [loadingPack, setLoadingPack] = useState(null);

  const handlePayPal = async (pack) => {
    setLoadingPack(pack.packId);
    try {
      const returnUrl = `${window.location.origin}${window.location.pathname}?pack_id=${pack.packId}&pack_tokens=${pack.tokens}`;
      const res = await base44.functions.invoke('createPaypalOrder', {
        packId: pack.packId,
        tokens: pack.tokens,
        price: pack.price,
        returnUrl,
      });
      if (res.data?.approvalUrl) {
        window.location.href = res.data.approvalUrl;
      } else {
        alert('Failed to create PayPal order. Please try again.');
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setLoadingPack(null);
    }
  };

  const { data: packsData } = useQuery({
    queryKey: ['tokenPacks'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listTokenPacks', { includeOffers: true, requestId: crypto.randomUUID() });
      return res.data?.data?.packs ?? [];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Sheet — bottom on mobile, centered on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 md:bottom-auto md:w-[480px] z-50 max-h-[92vh] md:max-h-[88vh] flex flex-col"
          >
            <div className="bg-[#0d0d1a] border border-white/10 rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden shadow-2xl">

              {/* ── HERO SECTION ── */}
              <div className="relative overflow-hidden px-6 pt-6 pb-5 flex-shrink-0">
                {/* Background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600/15 via-transparent to-fuchsia-600/10 pointer-events-none" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative">
                  {/* Close */}
                  <button onClick={onClose} className="absolute right-0 top-0 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                    <X className="w-4 h-4" />
                  </button>

                  {/* Pull handle (mobile) */}
                  <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-4 md:hidden" />

                  {/* Headline */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-bold mb-3">
                      <Sparkles className="w-3 h-3" /> AI Edge Reports
                    </div>
                    <h2 className="text-2xl font-black text-white leading-tight">
                      Unlock Wall Street<br />
                      <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        Grade Analysis
                      </span>
                    </h2>
                    <p className="text-white/40 text-xs mt-1.5">1 token = 1 deep AI Edge Report on any stock or crypto</p>
                  </div>

                  {/* Benefits pills */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {BENEFITS.map((b, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/4 rounded-xl px-3 py-2">
                        <span className="text-base leading-none">{b.icon}</span>
                        <span className="text-[11px] text-white/55 leading-tight">{b.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── PACK LIST (scrollable) ── */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-3 min-h-0">
                {/* Free token reminder */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                  <span className="text-base">🎁</span>
                  <p className="text-[11px] text-emerald-400/80 leading-snug">
                    <strong>Free daily token:</strong> You get 1 free report every day — stacks up to 3.
                  </p>
                </div>

                {!packsData ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-16 rounded-2xl bg-white/3 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {packsData.map((pack, i) => (
                      <PackCard
                        key={pack.packId}
                        pack={pack}
                        onBuy={handlePayPal}
                        loading={loadingPack}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── TRUST FOOTER ── */}
              <div className="flex-shrink-0 px-5 pb-5 pt-2">
                <div className="flex items-center justify-center gap-4 text-[10px] text-white/20">
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure via PayPal</span>
                  <span>·</span>
                  <span>Instant token delivery</span>
                  <span>·</span>
                  <span>Works on web &amp; mobile</span>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}