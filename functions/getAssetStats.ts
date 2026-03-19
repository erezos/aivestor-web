// Fast key statistics — Finnhub + Yahoo Finance fallback, no AI. Cached 1hr.
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

async function safeJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().startsWith('<')) return null;
    return JSON.parse(text);
  } catch { return null; }
}

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  return safeJson(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
}

// Yahoo Finance v8 — no auth needed
async function yahooStats(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1y&includePrePost=false`;
  const data = await safeJson(url, {
    'User-Agent': 'Mozilla/5.0 (compatible; AIVestor/1.0)',
    'Accept': 'application/json',
  });
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  return meta;
}

// Yahoo Finance v10 quoteSummary
async function yahooSummary(symbol) {
  const modules = 'summaryDetail,defaultKeyStatistics,price';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules)}&corsDomain=finance.yahoo.com`;
  const data = await safeJson(url, {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  });
  const result = data?.quoteSummary?.result?.[0];
  if (!result) return null;
  return result;
}

async function getStockStats(symbol) {
  const [profile, metrics, quote, yahooChart, yahooSumm] = await Promise.all([
    fhGet(`/stock/profile2?symbol=${symbol}`),
    fhGet(`/stock/basic-financials?symbol=${symbol}&metric=all`),
    fhGet(`/quote?symbol=${symbol}`),
    yahooStats(symbol),
    yahooSummary(symbol),
  ]);

  const m = metrics?.metric || {};
  const sd = yahooSumm?.summaryDetail || {};
  const ks = yahooSumm?.defaultKeyStatistics || {};
  const yp = yahooSumm?.price || {};

  // Market Cap
  let mcap = null;
  if (yp?.marketCap?.raw) mcap = yp.marketCap.raw;
  else if (profile?.marketCapitalization) mcap = profile.marketCapitalization * 1e6;
  else if (profile?.shareOutstanding && quote?.c) mcap = profile.shareOutstanding * 1e6 * quote.c;

  // P/E ratio — try Yahoo first (more reliable), then Finnhub
  let peRaw = sd?.trailingPE?.raw ?? sd?.forwardPE?.raw ?? m.peBasicExclExtraTTM ?? m.peTTM ?? null;
  const pe = peRaw != null ? (peRaw <= 0 ? 'N/A' : peRaw.toFixed(1)) : null;

  // Volume — Yahoo's regular market volume
  const vol = sd?.averageVolume?.raw ?? sd?.averageVolume10days?.raw ?? m['10DayAverageTradingVolume'] * 1e6 ?? null;

  // 52W
  const high52 = sd?.fiftyTwoWeekHigh?.raw ?? m['52WeekHigh'] ?? yahooChart?.fiftyTwoWeekHigh ?? null;
  const low52  = sd?.fiftyTwoWeekLow?.raw  ?? m['52WeekLow']  ?? yahooChart?.fiftyTwoWeekLow  ?? null;

  // Name & sector — Finnhub profile is best
  const name   = profile?.name   || yp?.shortName || yp?.longName || symbol;
  const sector = profile?.finnhubIndustry || sd?.sector?.raw || null;

  return {
    name,
    sector,
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
    safeJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`),
    geckoId
      ? safeJson(`https://api.coingecko.com/api/v3/coins/${geckoId}?localization=false&tickers=false&community_data=false&developer_data=false`)
      : Promise.resolve(null),
  ]);

  const mcap = gecko?.market_data?.market_cap?.usd ?? null;
  const vol  = gecko?.market_data?.total_volume?.usd
    ?? (binance?.quoteVolume ? parseFloat(binance.quoteVolume) : null);
  const high = gecko?.market_data?.ath?.usd
    ?? gecko?.market_data?.high_24h?.usd
    ?? (binance?.highPrice ? parseFloat(binance.highPrice) : null);
  const low  = gecko?.market_data?.atl?.usd
    ?? gecko?.market_data?.low_24h?.usd
    ?? (binance?.lowPrice ? parseFloat(binance.lowPrice) : null);

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

    if (cached && cacheAge < CACHE_TTL_MS) {
      return Response.json(JSON.parse(cached.data));
    }

    const stats = isCrypto
      ? await getCryptoStats(cleanSym)
      : await getStockStats(cleanSym);

    const payload = { cache_key: cacheKey, data: JSON.stringify(stats), refreshed_at: new Date().toISOString() };
    if (cached) {
      base44.asServiceRole.entities.CachedData.update(cached.id, payload); // non-blocking bg update
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(stats);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});