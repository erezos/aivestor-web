// Fast key statistics — no AI, just fundamentals. Cached 1hr.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CACHE_TTL_MS = 60 * 60000; // 1 hour

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

async function fhGet(path) {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch { return null; }
}

async function getStockStats(symbol) {
  const [profile, metrics, quote] = await Promise.all([
    fhGet(`/stock/profile2?symbol=${symbol}`),
    fhGet(`/stock/basic-financials?symbol=${symbol}&metric=all`),
    fhGet(`/quote?symbol=${symbol}`),
  ]);

  const m = metrics?.metric || {};

  // Market cap: profile field (in millions) OR live price × shares outstanding
  let mcap = null;
  if (profile?.marketCapitalization) {
    mcap = profile.marketCapitalization * 1e6;
  } else if (profile?.shareOutstanding && quote?.c) {
    mcap = profile.shareOutstanding * 1e6 * quote.c;
  }

  // Try multiple PE fields in order of reliability
  const peRaw = m.peBasicExclExtraTTM ?? m.peTTM ?? m.pe ?? m.peExclExtraTTM ?? null;
  const pe = peRaw != null
    ? (peRaw <= 0 ? 'N/A' : peRaw.toFixed(1))
    : null;

  // Volume: 10-day avg (in millions of shares) → absolute shares
  const vol = m['10DayAverageTradingVolume']
    ? m['10DayAverageTradingVolume'] * 1e6
    : null;

  // 52W: from metrics or fall back to quote's high/low
  const high52 = m['52WeekHigh'] ?? quote?.h ?? null;
  const low52  = m['52WeekLow']  ?? quote?.l  ?? null;

  return {
    name:      profile?.name || symbol,
    sector:    profile?.finnhubIndustry || null,
    marketCap: fmt(mcap),
    pe,
    volume:    fmt(vol),
    high52,
    low52,
    isCrypto:  false,
  };
}

async function getCryptoStats(symbol) {
  const geckoId = CRYPTO_MAP[symbol];

  const [binance, gecko] = await Promise.all([
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`)
      .then(r => r.ok ? r.json() : null).catch(() => null),
    geckoId
      ? fetch(`https://api.coingecko.com/api/v3/coins/${geckoId}?localization=false&tickers=false&community_data=false&developer_data=false`)
          .then(r => r.ok ? r.json() : null).catch(() => null)
      : Promise.resolve(null),
  ]);

  const mcap = gecko?.market_data?.market_cap?.usd ?? null;
  const vol  = binance?.quoteVolume ? parseFloat(binance.quoteVolume) : null;
  const high = gecko?.market_data?.high_24h?.usd
    ?? (binance?.highPrice ? parseFloat(binance.highPrice) : null);
  const low  = gecko?.market_data?.low_24h?.usd
    ?? (binance?.lowPrice  ? parseFloat(binance.lowPrice)  : null);

  return {
    name:      gecko?.name || symbol,
    sector:    'Crypto',
    marketCap: fmt(mcap),
    pe:        'N/A',
    volume:    fmt(vol),
    high52:    high,
    low52:     low,
    isCrypto:  true,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const isCrypto = CRYPTO_SET.has(cleanSym);
    const cacheKey = `stats_${cleanSym}`;

    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached   = rows[0];
    const cacheAge = cached ? Date.now() - new Date(cached.refreshed_at).getTime() : Infinity;

    // Serve from cache if fresh
    if (cached && cacheAge < CACHE_TTL_MS) {
      return Response.json(JSON.parse(cached.data));
    }

    // Fetch fresh stats
    const stats = isCrypto
      ? await getCryptoStats(cleanSym)
      : await getStockStats(cleanSym);

    // Persist cache (bg update if stale, await if new)
    const payload = { cache_key: cacheKey, data: JSON.stringify(stats), refreshed_at: new Date().toISOString() };
    if (cached) {
      base44.asServiceRole.entities.CachedData.update(cached.id, payload); // non-blocking
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(stats);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});