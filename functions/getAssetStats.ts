// Fast key statistics — Finnhub + Yahoo Finance v7, cached 1hr, no AI.
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
    const res = await fetch(url, { headers: { 'Accept': 'application/json', ...headers } });
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

// Yahoo Finance v7 quote — works without auth
async function yahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&fields=regularMarketPrice,regularMarketVolume,averageDailyVolume3Month,trailingPE,forwardPE,marketCap,fiftyTwoWeekHigh,fiftyTwoWeekLow,shortName,longName,sector,industry`;
  const data = await safeJson(url, {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
    'Referer': 'https://finance.yahoo.com',
  });
  return data?.quoteResponse?.result?.[0] ?? null;
}

async function getStockStats(symbol) {
  const [fhProfile, fhMetrics, fhQuote, yQuote] = await Promise.all([
    fhGet(`/stock/profile2?symbol=${symbol}`),
    fhGet(`/stock/basic-financials?symbol=${symbol}&metric=all`),
    fhGet(`/quote?symbol=${symbol}`),
    yahooQuote(symbol),
  ]);

  const m  = fhMetrics?.metric || {};

  // Market Cap — Yahoo first (live), then Finnhub profile
  const mcap =
    yQuote?.marketCap ??
    (fhProfile?.marketCapitalization ? fhProfile.marketCapitalization * 1e6 : null) ??
    (fhProfile?.shareOutstanding && fhQuote?.c ? fhProfile.shareOutstanding * 1e6 * fhQuote.c : null);

  // P/E — Yahoo trailing > forward, then Finnhub
  const peRaw = yQuote?.trailingPE ?? yQuote?.forwardPE ?? m.peBasicExclExtraTTM ?? m.peTTM ?? null;
  const pe = peRaw != null ? (peRaw <= 0 ? 'N/A' : peRaw.toFixed(1)) : null;

  // Volume — Yahoo 3-month avg, then Finnhub
  const vol =
    yQuote?.averageDailyVolume3Month ??
    yQuote?.regularMarketVolume ??
    (m['10DayAverageTradingVolume'] ? m['10DayAverageTradingVolume'] * 1e6 : null);

  // 52W — Yahoo, then Finnhub metrics
  const high52 = yQuote?.fiftyTwoWeekHigh ?? m['52WeekHigh'] ?? null;
  const low52  = yQuote?.fiftyTwoWeekLow  ?? m['52WeekLow']  ?? null;

  const name   = fhProfile?.name || yQuote?.shortName || yQuote?.longName || symbol;
  const sector = fhProfile?.finnhubIndustry || yQuote?.sector || null;

  return { name, sector, marketCap: fmt(mcap), pe, volume: fmt(vol), high52, low52, isCrypto: false };
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
  // For 52W use all-time-high / all-time-low as best proxy
  const high52 = gecko?.market_data?.ath?.usd ?? gecko?.market_data?.high_24h?.usd
    ?? (binance?.highPrice ? parseFloat(binance.highPrice) : null);
  const low52  = gecko?.market_data?.atl?.usd ?? gecko?.market_data?.low_24h?.usd
    ?? (binance?.lowPrice ? parseFloat(binance.lowPrice) : null);

  return {
    name: gecko?.name || symbol, sector: 'Crypto',
    marketCap: fmt(mcap), pe: 'N/A', volume: fmt(vol),
    high52, low52, isCrypto: true,
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

    const stats = isCrypto ? await getCryptoStats(cleanSym) : await getStockStats(cleanSym);

    const payload = { cache_key: cacheKey, data: JSON.stringify(stats), refreshed_at: new Date().toISOString() };
    if (cached) {
      base44.asServiceRole.entities.CachedData.update(cached.id, payload); // bg, non-blocking
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(stats);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});