import React, { useState, useEffect } from 'react';
import { TrendingUp, Zap, Shield, ChevronRight, BarChart2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const CFD_URL     = 'https://www.plus500.com/en/multiplatformdownload?clt=Web&id=138803&tags=first-link&pl=2';
const FUTURES_URL = 'https://us.plus500.com/en/multisitelandingpage?id=138803&tags=first-link-futures&pl=2';

const CFD_PERKS = [
  { icon: Zap,        label: 'Instant Execution' },
  { icon: TrendingUp, label: 'CFDs on 2,800+ Instruments' },
  { icon: Shield,     label: 'Regulated by CySEC (#250/14)' },
];

const FUTURES_PERKS = [
  { icon: Zap,        label: 'Micro Contracts from $0.49' },
  { icon: BarChart2,  label: 'Futures & Options' },
  { icon: Shield,     label: 'CFTC/NFA Regulated' },
];

export default function Plus500Banner() {
  const [isUS, setIsUS] = useState(null); // null = loading

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setIsUS(d.country_code === 'US'))
      .catch(() => setIsUS(false));
  }, []);

  const [hovered, setHovered] = useState(false);

  if (isUS === null) return null; // wait for geo before rendering

  const url      = isUS ? FUTURES_URL : CFD_URL;
  const perks    = isUS ? FUTURES_PERKS : CFD_PERKS;
  const headline = isUS ? 'Trade Futures & Options' : 'Trade Stocks & Crypto';
  const sub      = isUS ? 'US-regulated futures on 50+ markets' : 'Join millions of traders on Plus500';
  const tag      = isUS ? 'FUTURES' : 'CFDs';

  const disclaimer = isUS
    ? 'Futures trading involves significant risk of loss and is not suitable for all investors. Plus500US is registered with the CFTC and is a member of the NFA (NFA ID: 0001398). Past performance is not indicative of future results.'
    : 'CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage. 82% of retail investor accounts lose money when trading CFDs with this provider. Consider whether you can afford to take the high risk of losing your money.';

  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4 border border-white/5 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/8 via-transparent to-fuchsia-600/8 pointer-events-none" />

      {/* Sponsor label */}
      <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Sponsored</p>

      {/* Logo + headline */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-[#1a1a2e] font-black text-sm tracking-tight">P500</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="text-white font-black text-base leading-tight">{headline}</div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">{tag}</span>
          </div>
          <div className="text-white/40 text-xs mt-0.5">{sub}</div>
        </div>
      </div>

      {/* Perks */}
      <div className="flex items-center gap-3 flex-wrap">
        {perks.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="w-3 h-3 text-violet-400 flex-shrink-0" />
            <span className="text-[11px] text-white/50">{label}</span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => base44.analytics.track({
          eventName: 'plus500_trade_now_clicked',
          properties: { source: 'dashboard_banner', product: isUS ? 'futures' : 'cfd' }
        })}
        className="relative flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-white transition-all duration-200 overflow-hidden"
        style={{
          background: hovered
            ? 'linear-gradient(135deg, #7c3aed, #a855f7, #ec4899)'
            : 'linear-gradient(135deg, #6d28d9, #9333ea, #db2777)',
          boxShadow: hovered ? '0 0 24px rgba(139,92,246,0.5)' : '0 0 12px rgba(139,92,246,0.25)',
          transform: hovered ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <TrendingUp className="w-4 h-4" />
        Trade Now
        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${hovered ? 'translate-x-1' : ''}`} />
      </a>

      {/* Regulatory disclaimer — product-specific, required by Plus500 affiliate rules */}
      <p className="text-[9px] text-white/20 leading-relaxed">{disclaimer}</p>
    </div>
  );
}