import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Loader2, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const BENEFITS = [
  { icon: '📊', text: 'CFA-level stock & crypto analysis' },
  { icon: '⚡', text: 'Real-time technicals + options flow' },
  { icon: '🎯', text: 'Entry points, targets & invalidation' },
  { icon: '🧠', text: 'AI with 20+ data signals per report' },
];

const PACK_META = {
  starter_5_pack:  { badge: '🎁 Welcome Offer', badgeColor: 'from-emerald-500 to-teal-500',   highlight: false },
  tokens_5_pack:   { badge: null,                badgeColor: '',                               highlight: false },
  tokens_15_pack:  { badge: null,                badgeColor: '',                               highlight: false },
  tokens_40_pack:  { badge: '🔥 Most Popular',   badgeColor: 'from-violet-500 to-fuchsia-600', highlight: true  },
  second_25_pack:  { badge: '⚡ Limited Offer',  badgeColor: 'from-amber-500 to-orange-500',   highlight: false },
  tokens_100_pack: { badge: '💎 Best Value',     badgeColor: 'from-blue-500 to-cyan-500',      highlight: false },
  tokens_250_pack: { badge: '🐋 Whale Pack',     badgeColor: 'from-amber-400 to-orange-500',   highlight: false },
};

function PackCard({ pack, onBuy, loading }) {
  const meta = PACK_META[pack.packId] || {};
  const perToken = (pack.price / pack.tokens).toFixed(2);
  const isHighlight = meta.highlight;

  return (
    <div
      className={`relative rounded-2xl cursor-pointer transition-all duration-200 ${
        isHighlight
          ? 'ring-2 ring-violet-500/60 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10'
          : 'bg-white/4 hover:bg-white/7 ring-1 ring-white/8 hover:ring-white/15'
      }`}
      onClick={() => !loading && onBuy(pack)}
    >
      {meta.badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r ${meta.badgeColor} text-white text-[11px] font-black whitespace-nowrap shadow-lg z-10`}>
          {meta.badge}
        </div>
      )}

      <div className={`p-4 ${meta.badge ? 'pt-5' : ''}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{pack.tokens}</span>
              <span className="text-sm text-white/40 font-medium">AI Reports</span>
            </div>
            <div className="text-[11px] text-white/30 mt-0.5">${perToken} per report{pack.oneTime ? ' · one-time' : ''}</div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-xl font-black text-white">${pack.price}</div>
            <button
              disabled={!!loading}
              className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                isHighlight
                  ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90 shadow-lg shadow-violet-500/30'
                  : 'bg-white/8 hover:bg-white/15 text-white/80 border border-white/10'
              }`}
            >
              {loading === pack.packId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <img
                  src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png"
                  alt="PayPal"
                  className="h-3.5"
                />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
            onClick={onClose}
          />

          {/* Wrapper — full-height column so inner scroll works */}
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="pointer-events-auto w-full md:w-[480px] flex flex-col"
              style={{ maxHeight: '90vh' }}
            >
              <div className="bg-[#0d0d1a] border border-white/10 rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>

                {/* ── HERO (fixed, non-scrolling) ── */}
                <div className="flex-shrink-0 relative overflow-hidden px-6 pt-6 pb-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/15 via-transparent to-fuchsia-600/10 pointer-events-none" />
                  <div className="relative">
                    <button onClick={onClose} className="absolute right-0 top-0 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                    <div className="w-10 h-1 rounded-full bg-white/15 mx-auto mb-3 md:hidden" />
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-300 text-xs font-bold mb-2">
                        <Sparkles className="w-3 h-3" /> AI Edge Reports
                      </div>
                      <h2 className="text-xl font-black text-white leading-tight">
                        Unlock Wall Street{' '}
                        <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                          Grade Analysis
                        </span>
                      </h2>
                      <p className="text-white/35 text-xs mt-1">1 token = 1 deep AI Edge Report on any stock or crypto</p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 mt-3">
                      {BENEFITS.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/4 rounded-xl px-3 py-1.5">
                          <span className="text-sm leading-none">{b.icon}</span>
                          <span className="text-[10px] text-white/50 leading-tight">{b.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── SCROLLABLE PACKS ── */}
                <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-3 overscroll-contain" style={{ minHeight: 0 }}>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                    <span>🎁</span>
                    <p className="text-[11px] text-emerald-400/80">
                      <strong>Free daily token:</strong> You get 1 free report every day — stacks up to 3.
                    </p>
                  </div>

                  {!packsData ? (
                    <>
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-16 rounded-2xl bg-white/3 animate-pulse" />
                      ))}
                    </>
                  ) : (
                    packsData.map((pack) => (
                      <PackCard
                        key={pack.packId}
                        pack={pack}
                        onBuy={handlePayPal}
                        loading={loadingPack}
                      />
                    ))
                  )}
                </div>

                {/* ── TRUST FOOTER (fixed, non-scrolling) ── */}
                <div className="flex-shrink-0 px-5 py-3 border-t border-white/5">
                  <div className="flex items-center justify-center gap-3 text-[10px] text-white/20 flex-wrap">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure via PayPal</span>
                    <span>·</span>
                    <span>Instant token delivery</span>
                    <span>·</span>
                    <span>Works on web &amp; mobile</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}