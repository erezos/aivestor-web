/**
 * getAssetOverview — Phase 2. Header + key stats for asset page.
 * Cache key: overview_<SYMBOL>, TTL 45s.
 *
 * Request: { symbol: string, requestId?: string }
 * Response: standard envelope
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);
const TTL_SEC     = 45;

function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: meta.requestId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: meta.cache || { hit: false, ttlSec: TTL_SEC }, source: 'finnhub', ...meta }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body?.symbol) return err('INVALID_INPUT', 'symbol is required');

    const sym      = body.symbol.replace(/-USD$/i, '').toUpperCase().trim();
    const isCrypto = CRYPTO_SET.has(sym);
    const cacheKey = `overview_${sym}`;
    const reqId    = body.requestId || crypto.randomUUID();
    const t0       = Date.now();

    // Cache check
    const rows   = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0];
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < TTL_SEC * 1000) {
      return ok(JSON.parse(cached.data), { requestId: reqId, cache: { hit: true, ttlSec: TTL_SEC }, latencyMs: Date.now() - t0 });
    }

    // Fetch from Finnhub in parallel
    const [quote, profile, metrics] = await Promise.all([
      isCrypto
        ? fhGet(`/quote?symbol=BINANCE:${sym}USDT`).then(r => r?.c ? r : fhGet(`/quote?symbol=COINBASE:${sym}USD`))
        : fhGet(`/quote?symbol=${sym}`),
      isCrypto ? null : fhGet(`/stock/profile2?symbol=${sym}`),
      isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${sym}&metric=all`),
    ]);

    if (!quote?.c) {
      if (cached) return ok({ ...JSON.parse(cached.data), stale: true }, { requestId: reqId, cache: { hit: true, ttlSec: 0 }, source: 'stale_cache' });
      return err('SYMBOL_NOT_FOUND', `No quote data found for ${sym}`, true, 404);
    }

    const data = {
      symbol: sym,
      name: profile?.name || sym,
      exchange: profile?.exchange || (isCrypto ? 'CRYPTO' : 'US'),
      assetType: isCrypto ? 'CRYPTO' : 'EQUITY',
      price: quote.c,
      change: quote.d || 0,
      changePct: quote.dp || 0,
      currency: 'USD',
      marketState: 'OPEN',
      marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null,
      pe: metrics?.metric?.peBasicExclExtraTTM || null,
      week52High: metrics?.metric?.['52WeekHigh'] || null,
      week52Low: metrics?.metric?.['52WeekLow'] || null,
      volume: quote.v || null,
      avgVolume: metrics?.metric?.['10DayAverageTradingVolume'] ? Math.round(metrics.metric['10DayAverageTradingVolume'] * 1e6) : null,
    };

    const payload = { cache_key: cacheKey, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return ok(data, { requestId: reqId, cache: { hit: false, ttlSec: TTL_SEC }, latencyMs: Date.now() - t0 });
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});