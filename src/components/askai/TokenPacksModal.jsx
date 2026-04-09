import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Coins, Zap, Crown, Sparkles, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const PACK_ICONS = { starter: Zap, standard: Coins, heavy: Crown };
const PACK_COLORS = {
  starter:  { from: 'from-emerald-500', to: 'to-teal-500',   border: 'border-emerald-500/20', bg: 'bg-emerald-500/5'  },
  standard: { from: 'from-violet-500',  to: 'to-fuchsia-500', border: 'border-violet-500/20',  bg: 'bg-violet-500/5'   },
  heavy:    { from: 'from-amber-500',   to: 'to-orange-500',  border: 'border-amber-500/20',   bg: 'bg-amber-500/5'    },
};

function getKind(pack) {
  if (pack.kind === 'starter') return 'starter';
  if (pack.kind === 'heavy')   return 'heavy';
  return 'standard';
}

export default function TokenPacksModal({ open, onClose, onPurchaseComplete }) {
  const [loadingPack, setLoadingPack] = useState(null);

  const handlePayPal = async (pack) => {
    setLoadingPack(pack.packId);
    try {
      const returnUrl = window.location.origin + window.location.pathname;
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div initial={{ opacity: 0, scale: 0.92, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 40 }}
            className="fixed inset-x-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50"
          >
            <div className="bg-[#0f0f1a] border border-white/8 rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" /> Token Packs
                  </h2>
                  <p className="text-xs text-white/30 mt-0.5">Power your AI Edge Reports</p>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Free token reminder */}
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/15 flex items-start gap-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-400/80">
                  <strong>Free tokens:</strong> You get 1 free token every day (up to 3 stacked). Quick analyses cost 1, Standard 2, Deep 3.
                </p>
              </div>

              {!packsData ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-white/3 animate-pulse" />)}
                </div>
              ) : (
                <div className="space-y-3">
                  {packsData.map((pack, i) => {
                    const kind = getKind(pack);
                    const colors = PACK_COLORS[kind] || PACK_COLORS.standard;
                    const Icon = PACK_ICONS[kind] || Coins;
                    const perToken = (pack.price / pack.tokens).toFixed(2);
                    return (
                      <motion.div key={pack.packId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        className={`relative rounded-xl border ${colors.border} ${colors.bg} p-4`}
                      >
                        {pack.offerEligible && (
                          <div className="absolute -top-2 left-4 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-black text-white">
                            🔥 Special Offer
                          </div>
                        )}
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{pack.tokens} Tokens</span>
                              {pack.oneTime && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/8">One-time</span>}
                            </div>
                            <div className="text-[10px] text-white/30 mt-0.5">${perToken}/token · {pack.currency}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-black text-white">${pack.price}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handlePayPal(pack)}
                          disabled={!!loadingPack}
                          className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0070ba] hover:bg-[#005ea6] text-white text-xs font-bold transition-all disabled:opacity-50"
                        >
                          {loadingPack === pack.packId ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png" alt="PayPal" className="h-3.5" />
                          )}
                          {loadingPack === pack.packId ? 'Redirecting...' : 'Pay with PayPal'}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 p-3 rounded-xl bg-white/3 border border-white/8 text-center">
                <p className="text-[10px] text-white/30">Payments are processed securely via PayPal. Your token balance syncs instantly across web &amp; mobile.</p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}