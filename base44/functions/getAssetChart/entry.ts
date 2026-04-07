/**
 * getAssetChart — Phase 2. Candle data for asset chart.
 * Cache key: chart_<SYMBOL>_<RANGE>_<INTERVAL>
 *
 * Request: { symbol, range, interval?, adjusted?, requestId? }
 * Allowed ranges/intervals:
 *   1D -> 1m|5m|15m  |  1W -> 5m|15m|1h  |  1M -> 30m|1h|1d  |  6M|1Y|5Y -> 1d|1wk
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const ALPACA_KEY = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const CRYPTO_SET = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

const VALID_COMBOS = {
  '1D': ['1m','5m','15m'],
  '1W': ['5m','15m','1h'],
  '1M': ['30m','1h','1d'],
  '6M': ['1d','1wk'], '1Y': ['1d','1wk'], '5Y': ['1d','1wk'],
};

// Map user-facing interval to Alpaca timeframe
const INTERVAL_MAP = { '1m':'1Min','5m':'5Min','15m':'15Min','30m':'30Min','1h':'1Hour','1d':'1Day','1wk':'1Week' };

const RANGE_DAYS = { '1D': 3, '1W': 8, '1M': 35, '6M': 185, '1Y': 370, '5Y': 1830 };
const CHART_TTL  = { '1D': 15, '1W': 60, '1M': 900, '6M': 900, '1Y': 900, '5Y': 900 };

function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: meta.requestId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: meta.cache || { hit: false, ttlSec: 30 }, source: 'alpaca', ...meta }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body?.symbol) return err('INVALID_INPUT', 'symbol is required');

    const sym      = body.symbol.replace(/-USD$/i, '').toUpperCase().trim();
    const range    = (body.range || '1D').toUpperCase();
    const isCrypto = CRYPTO_SET.has(sym);
    const reqId    = body.requestId || crypto.randomUUID();
    const t0       = Date.now();

    const allowedIntervals = VALID_COMBOS[range];
    if (!allowedIntervals) return err('INVALID_RANGE', `range must be one of: ${Object.keys(VALID_COMBOS).join(', ')}`);

    const interval = body.interval || allowedIntervals[1] || allowedIntervals[0]; // default middle option
    if (!allowedIntervals.includes(interval)) return err('INVALID_INTERVAL', `For range ${range}, interval must be one of: ${allowedIntervals.join(', ')}`);

    const cacheKey = `chart_${sym}_${range}_${interval}`;
    const ttlSec   = CHART_TTL[range] || 900;

    const rows   = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0];
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < ttlSec * 1000) {
      return ok(JSON.parse(cached.data), { requestId: reqId, cache: { hit: true, ttlSec }, latencyMs: Date.now() - t0 });
    }

    const tf    = INTERVAL_MAP[interval] || '1Day';
    const start = new Date(Date.now() - (RANGE_DAYS[range] || 35) * 86400000).toISOString();
    let candles = [];

    try {
      if (isCrypto) {
        const alpacaSym = `${sym}/USD`;
        const res = await fetch(`https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(alpacaSym)}&timeframe=${tf}&start=${start}&limit=1000&sort=asc`, { headers: ALPACA_HDR });
        if (res.ok) {
          const json = await res.json();
          candles = (json.bars?.[alpacaSym] || []).map(b => ({ t: b.t, o: +b.o.toFixed(4), h: +b.h.toFixed(4), l: +b.l.toFixed(4), c: +b.c.toFixed(4), v: b.v }));
        }
      } else {
        const res = await fetch(`https://data.alpaca.markets/v2/stocks/${encodeURIComponent(sym)}/bars?timeframe=${tf}&start=${start}&limit=1000&sort=asc`, { headers: ALPACA_HDR });
        if (res.ok) {
          const json = await res.json();
          candles = (json.bars || []).map(b => ({ t: b.t, o: +b.o.toFixed(4), h: +b.h.toFixed(4), l: +b.l.toFixed(4), c: +b.c.toFixed(4), v: b.v }));
        }
      }
    } catch (_) { /* fallthrough to stale */ }

    // Return stale on provider failure — always prefer stale over hard error
    if (!candles.length && cached) {
      return ok({ ...JSON.parse(cached.data), stale: true }, { requestId: reqId, cache: { hit: true, ttlSec: 0 }, source: 'stale_cache', latencyMs: Date.now() - t0 });
    }
    if (!candles.length) {
      // Last resort: return empty candles payload rather than 503 if symbol was valid
      return ok({ symbol: sym, range, interval, candles: [] }, { requestId: reqId, cache: { hit: false, ttlSec: 0 }, source: 'provider_empty', latencyMs: Date.now() - t0 });
    }

    // Sort ascending by time (guarantee)
    candles.sort((a, b) => a.t < b.t ? -1 : 1);

    const data = { symbol: sym, range, interval, candles };
    const payload = { cache_key: cacheKey, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return ok(data, { requestId: reqId, cache: { hit: false, ttlSec }, latencyMs: Date.now() - t0 });
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});