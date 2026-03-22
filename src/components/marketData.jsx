/**
 * marketData.js — ALL data fetching now goes through backend functions.
 * No more client-side CORS proxies. No more per-user AI calls.
 * AI is pre-computed by scheduled tasks and served from DB cache.
 */
import { base44 } from '@/api/base44Client';

// ─── 1. Market Indices — server-side Yahoo, no AI ─────────────────────────────
export async function fetchMarketIndices() {
  const res = await base44.functions.invoke('getMarketData', { type: 'indices' });
  return res.data || [];
}

// ─── 2. Trending Tickers — server-side Yahoo, no AI ──────────────────────────
export async function fetchTrendingTickers() {
  const res = await base44.functions.invoke('getMarketData', { type: 'trending' });
  return res.data || [];
}

// ─── 3. Hot Board — reads from DB cache (populated by scheduler every 5 min) ─
export async function fetchHotBoard() {
  const rows = await base44.entities.CachedData.filter({ cache_key: 'hotboard' });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  // First ever load — trigger refresh on-demand
  await base44.functions.invoke('refreshHotBoard', {});
  const fresh = await base44.entities.CachedData.filter({ cache_key: 'hotboard' });
  if (fresh.length > 0) return JSON.parse(fresh[0].data);
  return [];
}

// ─── 4. Market Sentiment — Fear & Greed (lightweight, no AI) ─────────────────
export async function fetchMarketSentiment() {
  const res = await fetch('https://api.alternative.me/fng/?limit=1&format=json');
  const json = await res.json();
  const item = json?.data?.[0];
  const overall = item ? parseInt(item.value) : 50;
  const vary = (base, offset) => Math.min(100, Math.max(0, base + offset));
  return {
    overall,
    indicators: [
      { name: 'Market Momentum',  value: vary(overall, +8) },
      { name: 'Stock Strength',   value: vary(overall, -5) },
      { name: 'Put/Call Ratio',   value: vary(overall, +3) },
      { name: 'Volatility (VIX)', value: vary(overall, -10) },
    ],
  };
}

// ─── 5. Market News — reads from DB cache (populated by scheduler every 15 min)
export async function fetchMarketNews() {
  const rows = await base44.entities.CachedData.filter({ cache_key: 'news' });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  // First ever load — trigger refresh on-demand
  await base44.functions.invoke('refreshMarketNews', {});
  const fresh = await base44.entities.CachedData.filter({ cache_key: 'news' });
  if (fresh.length > 0) return JSON.parse(fresh[0].data);
  return [];
}

// ─── 6. Asset Detail — AI cached 30 min per symbol on server ─────────────────
export async function fetchAssetData(symbol) {
  const res = await base44.functions.invoke('getAssetAnalysis', { symbol });
  return res.data || {};
}

// ─── 7. Earnings — reads from DB cache (populated by scheduler daily) ────────
function expandEarning(e) {
  // Support both old full-key format and new compact format
  if (e.symbol) return e;
  return {
    symbol:             e.s,
    reportDate:         e.d,
    reportTime:         e.t,
    epsEstimate:        e.ep,
    revenueEstimate:    e.re,
    isNotable:          e.n === 1,
    volatilityForecast: e.vf,
    volatilityReason:   e.vr,
    sentimentBias:      e.sb,
  };
}

export async function fetchEarnings() {
  const rows = await base44.entities.CachedData.filter({ cache_key: 'earnings' });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data).map(expandEarning);
  // First ever load — trigger refresh on-demand
  await base44.functions.invoke('refreshEarnings', {});
  const fresh = await base44.entities.CachedData.filter({ cache_key: 'earnings' });
  if (fresh.length > 0) return JSON.parse(fresh[0].data).map(expandEarning);
  return [];
}

// ─── 8. Multi-symbol price batch — for Watchlist & Portfolio pages ────────────
export async function fetchMultiQuote(symbols) {
  if (!symbols.length) return {};
  const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols });
  return res.data || {};
}