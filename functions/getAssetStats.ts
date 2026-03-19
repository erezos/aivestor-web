/**
 * getAssetStats — Key Statistics, zero extra Finnhub calls.
 * 
 * Strategy (in priority order):
 * 1. Read from the existing asset_${sym} cache (written by getAssetAnalysis).
 *    If it exists, stats come for FREE — no extra API calls at all.
 * 2. For 52W High/Low + Avg Volume: compute from Alpaca 1yr daily bars (reliable, always works).
 * 3. For Market Cap / Sector / PE on cold start: try ONE Finnhub profile call.
 * 4. Crypto: CoinGecko (no auth needed, generous limits).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY  = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY   = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC   = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR   = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const STATS_TTL    = 60 * 60000;  // 1 hour

const CRYPTO_MAP = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple',
  DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2', DOT: 'polkadot',
  MATIC: 'matic-network', LINK: 'chainlink', BNB: 'binancecoin',
};
const CRYPTO_SET = new Set(Object.keys(CRYPTO_MAP));

function fmt(n) {
  if (n == null || isNaN(n) || n === 0) return null;
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

async function safeJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers } });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch { return null; }
}

// ─── Alpaca: 1yr daily bars → 52W high, 52W low, avg daily volume ─────────────
async function alpacaStats(symbol) {
  const start = new Date(Date.now() - 366 * 86400000).toISOString();
  const url   = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Day&start=${start}&limit=500&sort=asc`;
  const json  = await safeJson(url, ALPACA_HDR);
  const bars  = json?.bars || [];
  if (!bars.length) return null;
  const high52 = Math.max(...bars.map(b => b.h));
  const low52  = Math.min(...bars.map(b => b.l));
  const volume = bars.slice(-10).reduce((s, b) => s + b.v, 0) / Math.min(bars.length, 10);
  return { high52, low52, volume };
}

// ─── Finnhub: profile (name, sector, mcap) + quote (pe fallback) — 1 call each
async function finnhubProfile(symbol) {
  const data = await safeJson(
    `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`
  );
  if (!data || data.error) return null;
  return {
    name:   data.name   || null,
    sector: data.finnhubIndustry || null,
    mcap:   data.marketCapitalization ? data.marketCapitalization * 1e6 : null,
  };
}

async function finnhubMetrics(symbol) {
  const data = await safeJson(
    `https://finnhub.io/api/v1/stock/basic-financials?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`
  );
  const m = data?.metric || {};
  return {
    pe:     m.peBasicExclExtraTTM ?? m.peTTM ?? null,
    high52: m['52WeekHigh'] ?? null,
    low52:  m['52WeekLow']  ?? null,
  };
}

// ─── CoinGecko: crypto fundamentals, no auth ─────────────────────────────────
async function geckoStats(symbol) {
  const id   = CRYPTO_MAP[symbol];
  if (!id) return null;
  const data = await safeJson(
    `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false`
  );
  if (!data) return null;
  const md = data.market_data || {};
  return {
    name:     data.name || symbol,
    sector:   'Crypto',
    marketCap: fmt(md.market_cap?.usd ?? null),
    volume:    fmt(md.total_volume?.usd ?? null),
    pe:       'N/A',
    high52:   md['ath']?.usd ?? md.high_24h?.usd ?? null,
    low52:    md['atl']?.usd ?? md.low_24h?.usd ?? null,
    isCrypto: true,
  };
}

// ─── Build stock stats: Alpaca is guaranteed, Finnhub is best-effort ──────────
async function buildStockStats(symbol) {
  // Fire Alpaca (reliable) + Finnhub profile in parallel — only 1 Finnhub call
  const [alpaca, profile, metrics] = await Promise.all([
    alpacaStats(symbol),
    finnhubProfile(symbol),
    finnhubMetrics(symbol),
  ]);

  // 52W: Alpaca wins (calculated from actual bars), Finnhub as fallback
  const high52 = alpaca?.high52 ?? metrics?.high52 ?? null;
  const low52  = alpaca?.low52  ?? metrics?.low52  ?? null;
  const volume = alpaca?.volume ?? null;

  // Fundamentals from Finnhub (best effort)
  const pe      = metrics?.pe != null ? (metrics.pe <= 0 ? 'N/A' : metrics.pe.toFixed(1)) : null;
  const mcap    = profile?.mcap ?? null;
  const sector  = profile?.sector ?? null;
  const name    = profile?.name   ?? symbol;

  return {
    name, sector,
    marketCap: fmt(mcap),
    volume:    fmt(volume),
    pe,
    high52,
    low52,
    isCrypto: false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44   = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const isCrypto = CRYPTO_SET.has(cleanSym);
    const statsKey = `stats_${cleanSym}`;
    const assetKey = `asset_${cleanSym}`;

    // ── 1. Check stats-specific cache ──────────────────────────────────────
    let statsCache = null;
    try {
      const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: statsKey });
      statsCache = rows[0] || null;
    } catch (_) {}

    if (statsCache) {
      const age = Date.now() - new Date(statsCache.refreshed_at).getTime();
      if (age < STATS_TTL) return Response.json(JSON.parse(statsCache.data));
    }

    // ── 2. Read from asset analysis cache (getAssetAnalysis writes this) ───
    // If analysis already ran, we get all stats for FREE — no API calls needed.
    try {
      const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: assetKey });
      const assetCache = rows[0];
      if (assetCache) {
        const d = JSON.parse(assetCache.data);
        // Only use if it has the fields we need
        if (d.sector || d.marketCap || d.pe) {
          const result = {
            name: d.name, sector: d.sector,
            marketCap: d.marketCap, volume: d.volume,
            pe: d.pe, high52: d.high52, low52: d.low52,
            isCrypto: isCrypto,
          };
          // Write to stats cache too
          base44.asServiceRole.entities.CachedData.create({
            cache_key: statsKey, data: JSON.stringify(result), refreshed_at: new Date().toISOString()
          }).catch(() => {});
          return Response.json(result);
        }
      }
    } catch (_) {}

    // ── 3. Build fresh stats ───────────────────────────────────────────────
    const stats = isCrypto
      ? (await geckoStats(cleanSym) || { name: cleanSym, sector: 'Crypto', marketCap: null, volume: null, pe: 'N/A', high52: null, low52: null, isCrypto: true })
      : await buildStockStats(cleanSym);

    // Persist to stats cache
    try {
      const payload = { cache_key: statsKey, data: JSON.stringify(stats), refreshed_at: new Date().toISOString() };
      if (statsCache) await base44.asServiceRole.entities.CachedData.update(statsCache.id, payload);
      else await base44.asServiceRole.entities.CachedData.create(payload);
    } catch (_) {}

    return Response.json(stats);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});