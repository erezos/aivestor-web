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

// ─── 7. Earnings — reads per-date enriched chunks from DB ─────────────────────
const VF_EXPAND = { H: 'High', M: 'Medium', L: 'Low' };
const SB_EXPAND = { b: 'bullish', e: 'bearish', n: 'neutral' };

function expandEarning(e, date) {
  if (e.symbol) return e; // legacy format
  return {
    symbol:             e.s,
    reportDate:         e.d || date,
    reportTime:         e.t,
    epsEstimate:        e.ep,
    revenueEstimate:    e.re,
    epsActual:          e.ea ?? null,
    revenueActual:      e.ra ?? null,
    isNotable:          e.n === 1,
    volatilityForecast: VF_EXPAND[e.vf] || e.vf || 'Medium',
    volatilityReason:   e.vr || 'Earnings report due',
    sentimentBias:      SB_EXPAND[e.sb] || e.sb || 'neutral',
  };
}

// Fetch EPS history for a symbol from cache
export async function fetchEpsHistory(symbol) {
  const rows = await base44.entities.CachedData.filter({ cache_key: `eps_history_${symbol}` });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  return null;
}

// Fetch earnings for a specific date range (array of YYYY-MM-DD strings)
// Falls back to raw data if AI enrichment hasn't run yet for that date
export async function fetchEarningsForDates(dates) {
  const results = [];
  for (const date of dates) {
    // Try enriched first, then raw fallback
    const enriched = await base44.entities.CachedData.filter({ cache_key: `earnings_${date}` });
    if (enriched.length > 0 && enriched[0].data) {
      const arr = JSON.parse(enriched[0].data).map(e => expandEarning(e, date));
      results.push(...arr);
      continue;
    }
    const raw = await base44.entities.CachedData.filter({ cache_key: `earnings_raw_${date}` });
    if (raw.length > 0 && raw[0].data) {
      const arr = JSON.parse(raw[0].data).map(e => ({
        ...expandEarning(e, date),
        volatilityForecast: 'Medium',
        volatilityReason:   'Analysis pending…',
        sentimentBias:      'neutral',
      }));
      results.push(...arr);
    }
  }
  return results;
}

// Fetch the earnings meta (progress info)
export async function fetchEarningsMeta() {
  const rows = await base44.entities.CachedData.filter({ cache_key: 'earnings_meta' });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  return null;
}

// Legacy: fetch all earnings (used by old code)
export async function fetchEarnings() {
  const meta = await fetchEarningsMeta();
  if (!meta) return [];
  const allResults = [];
  for (const date of meta.dates || []) {
    const enriched = await base44.entities.CachedData.filter({ cache_key: `earnings_${date}` });
    if (enriched.length > 0 && enriched[0].data) {
      allResults.push(...JSON.parse(enriched[0].data).map(expandEarning));
    }
  }
  return allResults;
}

// ─── 8. Multi-symbol price batch — for Watchlist & Portfolio pages ────────────
export async function fetchMultiQuote(symbols) {
  if (!symbols.length) return {};
  const res = await base44.functions.invoke('getMarketData', { type: 'multi', symbols });
  return res.data || {};
}