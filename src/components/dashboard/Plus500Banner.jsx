import React, { useState } from 'react';
import { TrendingUp, Zap, Shield, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const AFFILIATE_URL = 'https://www.plus500.com/en/multiplatformdownload?clt=Web&id=138803&tags=first-link&pl=2';

const PERKS = [
  { icon: Zap,        label: 'Instant Execution' },
  { icon: TrendingUp, label: '2,800+ Instruments' },
  { icon: Shield,     label: 'Regulated Broker' },
];

export default function Plus500Banner() {
  const [hovered, setHovered] = useState(false);

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
          <div className="text-white font-black text-base leading-tight">Trade Stocks & Crypto</div>
          <div className="text-white/40 text-xs mt-0.5">Join millions of traders on Plus500</div>
        </div>
      </div>

      {/* Perks */}
      <div className="flex items-center gap-3 flex-wrap">
        {PERKS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="w-3 h-3 text-violet-400 flex-shrink-0" />
            <span className="text-[11px] text-white/50">{label}</span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <a
        href={AFFILIATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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

      {/* Regulatory risk disclaimer — required by Plus500 affiliate rules */}
      <p className="text-[9px] text-white/20 leading-relaxed">
        CFDs are complex instruments and come with a high risk of losing money rapidly due to leverage.
        82% of retail investor accounts lose money when trading CFDs with this provider.
        You should consider whether you understand how CFDs work and whether you can afford to take the high risk of losing your money.
      </p>
    </div>
  );
}