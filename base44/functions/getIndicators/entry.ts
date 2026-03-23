// Real technical indicators — calculated from OHLCV data (Alpaca for stocks, Finnhub candles for crypto)
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY  = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY   = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC   = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR   = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const CRYPTO_SET   = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);
const CACHE_TTL    = 10 * 60000; // 10 min

// ── Pure calculations ─────────────────────────────────────────────────────────

function calcRSI(closes, period = 14) {
  if (closes.length < period + 2) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2);
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  let ema = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal + 5) return null;
  const buf = closes.slice(-(slow + signal + 20));
  const macdLine = [];
  for (let i = slow - 1; i < buf.length; i++) {
    const sl = buf.slice(0, i + 1);
    macdLine.push(calcEMA(sl, fast) - calcEMA(sl, slow));
  }
  if (macdLine.length < signal) return null;
  const sigVal  = calcEMA(macdLine, signal);
  const macdVal = macdLine[macdLine.length - 1];
  return { macd: +macdVal.toFixed(4), signal: +sigVal.toFixed(4), hist: +(macdVal - sigVal).toFixed(4) };
}

function calcBB(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const sl   = closes.slice(-period);
  const mean = sl.reduce((a, b) => a + b, 0) / period;
  const std  = Math.sqrt(sl.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { upper: +(mean + mult * std).toFixed(2), middle: +mean.toFixed(2), lower: +(mean - mult * std).toFixed(2) };
}

function calcSMA(closes, period) {
  if (closes.length < period) return null;
  return +(closes.slice(-period).reduce((a, b) => a + b, 0) / period).toFixed(2);
}

function calcStoch(highs, lows, closes, k = 14) {
  if (closes.length < k) return null;
  const hs = highs.slice(-k), ls = lows.slice(-k);
  const hh = Math.max(...hs), ll = Math.min(...ls);
  if (hh === ll) return null;
  return +((closes[closes.length - 1] - ll) / (hh - ll) * 100).toFixed(2);
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function getAlpacaOHLCV(symbol, days = 120) {
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const url   = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&limit=200&sort=asc`;
  const res   = await fetch(url, { headers: ALPACA_HDR });
  if (!res.ok) return null;
  const json  = await res.json();
  const bars  = json.bars || [];
  return {
    closes: bars.map(b => b.c),
    highs:  bars.map(b => b.h),
    lows:   bars.map(b => b.l),
    volumes: bars.map(b => b.v),
  };
}

async function getAlpacaCryptoBars(symbol, days = 120) {
  const start    = new Date(Date.now() - days * 86400000).toISOString();
  const alpacaSym = `${symbol}/USD`;
  const url = `https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(alpacaSym)}&timeframe=1Day&start=${start}&limit=200&sort=asc`;
  const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC } });
  if (!res.ok) return null;
  const json = await res.json();
  const bars = json.bars?.[alpacaSym] || [];
  if (!bars.length) return null;
  return { closes: bars.map(b => b.c), highs: bars.map(b => b.h), lows: bars.map(b => b.l), volumes: bars.map(b => b.v) };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const isCrypto = CRYPTO_SET.has(cleanSym);
    const cacheKey = `indicators_${cleanSym}`;

    // Cache check
    const rows  = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const entry = rows[0];
    if (entry && Date.now() - new Date(entry.refreshed_at).getTime() < CACHE_TTL) {
      return Response.json(JSON.parse(entry.data));
    }

    // Get OHLCV — Alpaca for stocks (reliable), Finnhub candles as fallback for crypto
    const ohlcv = isCrypto
      ? await getAlpacaCryptoBars(cleanSym)
      : await getAlpacaOHLCV(cleanSym);

    if (!ohlcv || ohlcv.closes.length < 20) {
      return Response.json({ error: 'Insufficient OHLCV data', symbol: cleanSym }, { status: 422 });
    }

    const { closes, highs, lows, volumes } = ohlcv;

    // Volume trend: 5-day vs 20-day avg volume
    let volumeTrend = null;
    if (volumes?.length >= 20) {
      const avg5  = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
      const avg20 = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
      volumeTrend = +(avg5 / avg20).toFixed(2); // >1 = above avg
    }

    const indicators = {};
    const rsi = calcRSI(closes);
    if (rsi !== null) indicators.rsi = rsi;

    const macd = calcMACD(closes);
    if (macd) { indicators.macd = macd.macd; indicators.macdSignal = macd.signal; indicators.macdHist = macd.hist; }

    const bb = calcBB(closes);
    if (bb) { indicators.bbUpper = bb.upper; indicators.bbMiddle = bb.middle; indicators.bbLower = bb.lower; }

    const sma20 = calcSMA(closes, 20);
    const sma50 = calcSMA(closes, 50);
    if (sma20) indicators.sma20 = sma20;
    if (sma50) indicators.sma50 = sma50;

    if (highs && lows) {
      const stoch = calcStoch(highs, lows, closes);
      if (stoch !== null) indicators.stoch = stoch;
    }
    if (volumeTrend !== null) indicators.volumeTrend = volumeTrend;
    indicators.currentPrice = closes[closes.length - 1];

    // Cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(indicators), refreshed_at: new Date().toISOString() };
    if (entry) {
      base44.asServiceRole.entities.CachedData.update(entry.id, payload);
    } else {
      base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(indicators);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});