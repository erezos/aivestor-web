/**
 * getMarketQuotes — Phase 2. Batch quote endpoint for watchlist + top bars.
 * Supports up to 50 symbols. Returns missing[] instead of hard failing.
 * Cache per symbol: quote_<SYMBOL> with TTL 10s open / 180s closed.
 *
 * Request: { symbols: string[], requestId?: string }
 * Response: standard envelope { data: { quotes, missing }, meta, error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

const QUOTE_TTL_OPEN   = 10;   // seconds
const QUOTE_TTL_CLOSED = 180;  // seconds

function ok(data, meta = {}) {
  return Response.json({ data, meta: { requestId: meta.requestId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: meta.cache || { hit: false, ttlSec: QUOTE_TTL_OPEN }, source: 'finnhub', ...meta }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

function isMarketOpen() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false;
  const h = now.getUTCHours();
  return h >= 13 && h < 20; // 9:30–4pm ET ≈ 13:30–20:00 UTC (approximate)
}

async function fetchFhQuote(symbol, isCrypto) {
  try {
    if (isCrypto) {
      const r1 = await fetch(`https://finnhub.io/api/v1/quote?symbol=BINANCE:${symbol}USDT&token=${FINNHUB_KEY}`);
      const d1 = r1.ok ? await r1.json() : null;
      if (d1?.c) return d1;
      const r2 = await fetch(`https://finnhub.io/api/v1/quote?symbol=COINBASE:${symbol}USD&token=${FINNHUB_KEY}`);
      return r2.ok ? r2.json() : null;
    }
    const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
    return r.ok ? r.json() : null;
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => null);
    if (!body?.symbols?.length) return err('INVALID_INPUT', 'symbols array is required and must not be empty');

    // Dedupe + normalize + cap
    const symbols = [...new Set(body.symbols.map(s => String(s).toUpperCase().trim()))].slice(0, 50);
    if (body.symbols.length > 50) return err('INVALID_INPUT', 'Max 50 symbols per request');

    const reqId   = body.requestId || crypto.randomUUID();
    const open    = isMarketOpen();
    const ttlSec  = open ? QUOTE_TTL_OPEN : QUOTE_TTL_CLOSED;
    const t0      = Date.now();

    // Load all cache entries in parallel
    const cacheRows = await Promise.all(
      symbols.map(sym => base44.asServiceRole.entities.CachedData.filter({ cache_key: `quote_${sym}` }).then(r => ({ sym, row: r[0] || null })))
    );

    const quotes  = [];
    const missing = [];
    const fetchNeeded = [];

    for (const { sym, row } of cacheRows) {
      if (row && (Date.now() - new Date(row.refreshed_at).getTime()) < ttlSec * 1000) {
        quotes.push({ ...JSON.parse(row.data), stale: false });
      } else {
        fetchNeeded.push({ sym, existingRow: row });
      }
    }

    // Fetch stale/missing symbols from provider in parallel
    if (fetchNeeded.length > 0) {
      const providerResults = await Promise.all(
        fetchNeeded.map(({ sym }) => fetchFhQuote(sym, CRYPTO_SET.has(sym)).then(d => ({ sym, d })))
      );

      const cacheWrites = [];
      for (const { sym, d } of providerResults) {
        const existing = fetchNeeded.find(f => f.sym === sym)?.existingRow;
        if (!d?.c) {
          // Provider miss — return stale if available, otherwise add to missing
          if (existing?.data) {
            quotes.push({ ...JSON.parse(existing.data), stale: true });
          } else {
            missing.push(sym);
          }
          continue;
        }
        const quote = {
          symbol: sym, price: d.c, change: d.d || 0, changePct: d.dp || 0,
          currency: 'USD', marketState: open ? 'OPEN' : 'CLOSED',
          asOf: new Date().toISOString(), stale: false,
        };
        quotes.push(quote);
        const payload = { cache_key: `quote_${sym}`, data: JSON.stringify(quote), refreshed_at: new Date().toISOString() };
        cacheWrites.push(existing
          ? base44.asServiceRole.entities.CachedData.update(existing.id, payload)
          : base44.asServiceRole.entities.CachedData.create(payload)
        );
      }
      // Fire cache writes async
      Promise.all(cacheWrites).catch(() => {});
    }

    const cacheHit = fetchNeeded.length === 0;
    return ok({ quotes, missing }, { requestId: reqId, cache: { hit: cacheHit, ttlSec }, source: 'finnhub', latencyMs: Date.now() - t0 });
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});