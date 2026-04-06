/**
 * getAssetSnapshot — Phase 1.5 Flutter unblock.
 * One-call payload: overview + chart + news for initial asset screen load.
 * All data sourced from existing functions/cache layer.
 *
 * Request: { symbol, range?, interval?, newsLimit? }
 * Response: standard envelope { data: { overview, chart, news }, meta, error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY  = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC  = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR  = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };

const CRYPTO_SET = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

// ── Envelope helpers ──────────────────────────────────────────────────────────
function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: meta.requestId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: meta.cache || { hit: false, ttlSec: 30 }, source: meta.source || 'finnhub', ...meta }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

// Allowed range → interval combos
const VALID_COMBOS = {
  '1D': ['1m','5m','15m'],
  '1W': ['5m','15m','1h'],
  '1M': ['30m','1h','1d'],
  '6M': ['1d','1wk'], '1Y': ['1d','1wk'], '5Y': ['1d','1wk'],
};

// Alpaca range config
const ALPACA_CFG = {
  '1D': { tf: '5Min',  days: 3   },
  '1W': { tf: '30Min', days: 8   },
  '1M': { tf: '1Day',  days: 35  },
  '6M': { tf: '1Day',  days: 185 },
  '1Y': { tf: '1Day',  days: 370 },
  '5Y': { tf: '1Week', days: 1830},
};

const CHART_TTL = { '1D': 15, '1W': 60, '1M': 900, '6M': 900, '1Y': 900, '5Y': 900 };
const NEWS_TTL  = 300; // 5 min
const OV_TTL    = 45;  // 45 sec

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

async function getOverview(sym, isCrypto, base44) {
  const cacheKey = `overview_${sym}`;
  const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
  const cached = rows[0];
  if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < OV_TTL * 1000) {
    return { data: JSON.parse(cached.data), cacheHit: true };
  }

  const [quote, profile, metrics] = await Promise.all([
    isCrypto
      ? fhGet(`/quote?symbol=BINANCE:${sym}USDT`).then(r => r?.c ? r : fhGet(`/quote?symbol=COINBASE:${sym}USD`))
      : fhGet(`/quote?symbol=${sym}`),
    isCrypto ? null : fhGet(`/stock/profile2?symbol=${sym}`),
    isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${sym}&metric=all`),
  ]);

  const data = {
    symbol: sym,
    name: profile?.name || sym,
    exchange: profile?.exchange || (isCrypto ? 'CRYPTO' : 'US'),
    assetType: isCrypto ? 'CRYPTO' : 'EQUITY',
    price: quote?.c || 0,
    change: quote?.d || 0,
    changePct: quote?.dp || 0,
    currency: 'USD',
    marketState: quote?.c ? 'OPEN' : 'CLOSED',
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
    pe: metrics?.metric?.peBasicExclExtraTTM || null,
    week52High: metrics?.metric?.['52WeekHigh'] || quote?.h || null,
    week52Low: metrics?.metric?.['52WeekLow'] || quote?.l || null,
    volume: metrics?.metric?.['10DayAverageTradingVolume'] ? Math.round(metrics.metric['10DayAverageTradingVolume'] * 1e6) : null,
    avgVolume: metrics?.metric?.['3MonthAverageTradingVolume'] ? Math.round(metrics.metric['3MonthAverageTradingVolume'] * 1e6) : null,
  };

  // Cache async (don't block response)
  const payload = { cache_key: cacheKey, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
  else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

  return { data, cacheHit: false };
}

async function getChart(sym, isCrypto, range, base44) {
  const cacheKey = `chart_${sym}_${range}_default`;
  const ttlSec = CHART_TTL[range] || 900;
  const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
  const cached = rows[0];
  if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < ttlSec * 1000) {
    return { data: JSON.parse(cached.data), cacheHit: true };
  }

  const cfg = ALPACA_CFG[range] || ALPACA_CFG['1M'];
  const start = new Date(Date.now() - cfg.days * 86400000).toISOString();
  let candles = [];

  try {
    if (isCrypto) {
      const alpacaSym = `${sym}/USD`;
      const res = await fetch(`https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(alpacaSym)}&timeframe=${cfg.tf}&start=${start}&limit=1000&sort=asc`, { headers: ALPACA_HDR });
      if (res.ok) {
        const json = await res.json();
        candles = (json.bars?.[alpacaSym] || []).map(b => ({ t: b.t, o: +b.o.toFixed(2), h: +b.h.toFixed(2), l: +b.l.toFixed(2), c: +b.c.toFixed(2), v: b.v }));
      }
    } else {
      const res = await fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${cfg.tf}&start=${start}&limit=1000&sort=asc`, { headers: ALPACA_HDR });
      if (res.ok) {
        const json = await res.json();
        candles = (json.bars || []).map(b => ({ t: b.t, o: +b.o.toFixed(2), h: +b.h.toFixed(2), l: +b.l.toFixed(2), c: +b.c.toFixed(2), v: b.v }));
      }
    }
  } catch (_) { /* return stale if available */ }

  if (!candles.length && cached) return { data: JSON.parse(cached.data), cacheHit: true, stale: true };

  const data = { symbol: sym, range, interval: cfg.tf, candles };
  const payload = { cache_key: cacheKey, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
  else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

  return { data, cacheHit: false };
}

async function getNews(sym, isCrypto, limit, base44) {
  const cacheKey = `news_${sym}`;
  const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
  const cached = rows[0];
  if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < NEWS_TTL * 1000) {
    const d = JSON.parse(cached.data);
    return { data: { items: (d.articles || d.items || []).slice(0, limit), nextCursor: null }, cacheHit: true };
  }

  if (isCrypto) return { data: { items: [], nextCursor: null }, cacheHit: false };

  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const articles = await fhGet(`/company-news?symbol=${sym}&from=${from}&to=${to}`);
  if (!articles?.length) return { data: { items: [], nextCursor: null }, cacheHit: false };

  const BULLISH = /surge|jump|soar|rally|gain|beat|record|growth|rise|profit|boost|upgrade|buy|bullish/i;
  const BEARISH = /fall|drop|plunge|decline|miss|loss|risk|warn|downgrade|sell|bearish|weak|tumble/i;
  const seen = new Set();
  const items = [];
  for (const a of articles) {
    const key = (a.url || '') + (a.headline || '');
    if (seen.has(key)) continue;
    seen.add(key);
    const text = `${a.headline} ${a.summary || ''}`;
    const bull = (text.match(BULLISH) || []).length;
    const bear = (text.match(BEARISH) || []).length;
    const sentiment = bull > bear ? 'bullish' : bear > bull ? 'bearish' : 'neutral';
    items.push({ id: `news_${a.id}`, symbol: sym, title: a.headline?.slice(0, 120), summary: a.summary?.slice(0, 200) || null, url: a.url || '', source: a.source || 'Financial News', publishedAt: new Date(a.datetime * 1000).toISOString(), sentiment });
    if (items.length >= limit) break;
  }

  const payload = { cache_key: cacheKey, data: JSON.stringify({ items }), refreshed_at: new Date().toISOString() };
  if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
  else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

  return { data: { items, nextCursor: null }, cacheHit: false };
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.symbol) return err('INVALID_INPUT', 'symbol is required');

    const sym    = body.symbol.replace(/-USD$/i, '').toUpperCase().trim();
    const range  = (body.range || '1D').toUpperCase();
    const newsLimit = Math.min(parseInt(body.newsLimit) || 10, 50);

    if (!VALID_COMBOS[range]) return err('INVALID_RANGE', `range must be one of: ${Object.keys(VALID_COMBOS).join(', ')}`);

    const base44   = createClientFromRequest(req);
    const isCrypto = CRYPTO_SET.has(sym);
    const reqId    = body.requestId || crypto.randomUUID();
    const t0       = Date.now();

    // Fetch all three in parallel
    const [ovResult, chartResult, newsResult] = await Promise.all([
      getOverview(sym, isCrypto, base44),
      getChart(sym, isCrypto, range, base44),
      getNews(sym, isCrypto, newsLimit, base44),
    ]);

    const allCached = ovResult.cacheHit && chartResult.cacheHit && newsResult.cacheHit;

    return ok(
      { overview: ovResult.data, chart: chartResult.data, news: newsResult.data },
      { requestId: reqId, asOf: new Date().toISOString(), cache: { hit: allCached, ttlSec: 30 }, source: 'finnhub+alpaca', latencyMs: Date.now() - t0 }
    );
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});