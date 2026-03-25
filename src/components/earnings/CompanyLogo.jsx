import React, { useState, useEffect } from 'react';

const CDN = 'https://cdn.tickerlogos.com';
const SEARCH = 'https://www.allinvestview.com/api/logo-search/?q=';

// In-memory cache so we don't re-fetch the same ticker multiple times
const domainCache = {};

// Hardcoded domains for the most common tickers (avoids extra API calls)
const KNOWN_DOMAINS = {
  AAPL: 'apple.com', MSFT: 'microsoft.com', GOOGL: 'google.com', GOOG: 'google.com',
  AMZN: 'amazon.com', META: 'meta.com', TSLA: 'tesla.com', NVDA: 'nvidia.com',
  NFLX: 'netflix.com', AMD: 'amd.com', INTC: 'intel.com', QCOM: 'qualcomm.com',
  JPM: 'jpmorganchase.com', GS: 'goldmansachs.com', MS: 'morganstanley.com',
  BAC: 'bankofamerica.com', V: 'visa.com', MA: 'mastercard.com',
  WMT: 'walmart.com', COST: 'costco.com', UBER: 'uber.com', LYFT: 'lyft.com',
  SNAP: 'snap.com', PYPL: 'paypal.com', SQ: 'block.xyz', COIN: 'coinbase.com',
  PLTR: 'palantir.com', BABA: 'alibaba.com', SHOP: 'shopify.com',
  CRM: 'salesforce.com', ORCL: 'oracle.com', ADBE: 'adobe.com',
  MU: 'micron.com', ARM: 'arm.com', DIS: 'thewaltdisneycompany.com',
  SBUX: 'starbucks.com', NKE: 'nike.com', PFE: 'pfizer.com',
  JNJ: 'jnj.com', UNH: 'unitedhealthgroup.com', CVX: 'chevron.com',
  XOM: 'exxonmobil.com', T: 'att.com', VZ: 'verizon.com',
  IBM: 'ibm.com', CSCO: 'cisco.com', HON: 'honeywell.com', CAT: 'caterpillar.com',
  BA: 'boeing.com', GE: 'ge.com', F: 'ford.com', GM: 'gm.com',
  RIVN: 'rivian.com', HOOD: 'robinhood.com', RBLX: 'roblox.com',
  EBAY: 'ebay.com', ADP: 'adp.com', EQIX: 'equinix.com', NCLH: 'nclhltd.com',
  MGM: 'mgmresorts.com', YUM: 'yum.com', GRMN: 'garmin.com', PSA: 'publicstorage.com',
};

// Vibrant gradient backgrounds per first letter (fallback when no logo)
const LETTER_GRADIENTS = {
  A: 'from-rose-500 to-pink-600',
  B: 'from-blue-500 to-indigo-600',
  C: 'from-cyan-500 to-blue-600',
  D: 'from-violet-500 to-purple-600',
  E: 'from-emerald-500 to-teal-600',
  F: 'from-orange-500 to-red-600',
  G: 'from-green-500 to-emerald-600',
  H: 'from-fuchsia-500 to-pink-600',
  I: 'from-indigo-500 to-blue-600',
  J: 'from-amber-500 to-orange-600',
  K: 'from-lime-500 to-green-600',
  L: 'from-sky-500 to-cyan-600',
  M: 'from-purple-500 to-violet-600',
  N: 'from-teal-500 to-emerald-600',
  O: 'from-orange-400 to-amber-600',
  P: 'from-pink-500 to-rose-600',
  Q: 'from-blue-400 to-cyan-600',
  R: 'from-red-500 to-rose-600',
  S: 'from-slate-400 to-slate-600',
  T: 'from-violet-400 to-indigo-600',
  U: 'from-sky-400 to-blue-600',
  V: 'from-indigo-400 to-violet-600',
  W: 'from-green-400 to-teal-600',
  X: 'from-gray-400 to-slate-600',
  Y: 'from-yellow-400 to-amber-600',
  Z: 'from-fuchsia-400 to-purple-600',
};

export function getGradient(symbol) {
  const letter = symbol?.[0]?.toUpperCase() || 'A';
  return LETTER_GRADIENTS[letter] || 'from-violet-500 to-fuchsia-600';
}

async function resolveDomain(symbol) {
  if (KNOWN_DOMAINS[symbol]) return KNOWN_DOMAINS[symbol];
  if (domainCache[symbol] !== undefined) return domainCache[symbol];
  try {
    const res = await fetch(`${SEARCH}${encodeURIComponent(symbol)}`);
    const json = await res.json();
    const domain = json?.results?.[0]?.website || null;
    domainCache[symbol] = domain;
    return domain;
  } catch {
    domainCache[symbol] = null;
    return null;
  }
}

export default function CompanyLogo({ symbol, size = 'md' }) {
  const [domain, setDomain] = useState(KNOWN_DOMAINS[symbol] || null);
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm:  'w-7 h-7 text-[10px]',
    md:  'w-9 h-9 text-xs',
    lg:  'w-12 h-12 text-sm',
    xl:  'w-16 h-16 text-base',
  };

  useEffect(() => {
    if (!KNOWN_DOMAINS[symbol]) {
      resolveDomain(symbol).then(setDomain);
    }
  }, [symbol]);

  const gradient = getGradient(symbol);
  const cls = sizeClasses[size] || sizeClasses.md;

  if (domain && !imgError) {
    return (
      <div className={`${cls} rounded-xl overflow-hidden flex-shrink-0 bg-white/5`}>
        <img
          src={`${CDN}/${domain}`}
          alt={symbol}
          className="w-full h-full object-contain p-0.5"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: gradient avatar with symbol initials
  return (
    <div className={`${cls} rounded-xl flex-shrink-0 bg-gradient-to-br ${gradient} flex items-center justify-center font-black text-white shadow-lg`}>
      {symbol.slice(0, 2)}
    </div>
  );
}