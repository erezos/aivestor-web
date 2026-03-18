// Real technical indicators: Finnhub for stocks, calculated from Binance for crypto
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);
const CACHE_TTL   = 5 * 60000; // 5 min

// ── Manual calculations (used for crypto from Binance klines) ─────────────────

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

function calcEMA(arr, period) {
  const k = 2 / (period + 1);
  let ema = arr[0];
  for (let i = 1; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal + 5) return null;
  const buf = closes.slice(-80);
  const macdLine = [];
  for (let i = slow - 1; i < buf.length; i++) {
    const slice = buf.slice(0, i + 1);
    macdLine.push(calcEMA(slice.slice(-fast), fast) - calcEMA(slice.slice(-slow), slow));
  }
  if (macdLine.length < signal) return null;
  const sigVal = calcEMA(macdLine, signal);
  const macdVal = macdLine[macdLine.length - 1];
  return { macd: macdVal, signal: sigVal, hist: macdVal - sigVal };
}

function calcBB(closes, period = 20, mult = 2) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const std  = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
  return { upper: mean + mult * std, middle: mean, lower: mean - mult * std };
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fhIndicator(symbol, indicator, extraParams = '') {
  const now  = Math.floor(Date.now() / 1000);
  const from = now - 120 * 86400; // 120 days history for stable calculations
  const url  = `https://finnhub.io/api/v1/indicator?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${now}&indicator=${indicator}${extraParams}&token=${FINNHUB_KEY}`;
  const res  = await fetch(url);
  return res.ok ? res.json() : null;
}

async function getBinanceCloses(symbol, limit = 100) {
  const res  = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${limit}`);
  const json = res.ok ? await res.json() : null;
  if (!Array.isArray(json)) return [];
  return json.map(k => parseFloat(k[4]));
}

const last = (arr) => Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const cacheKey = `indicators_${cleanSym}`;
    const isCrypto = CRYPTO_SET.has(cleanSym);

    // Cache check
    const rows  = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const entry = rows[0];
    if (entry && Date.now() - new Date(entry.refreshed_at).getTime() < CACHE_TTL) {
      return Response.json(JSON.parse(entry.data));
    }

    let indicators = {};

    if (isCrypto) {
      // Calculate from Binance klines directly
      const closes = await getBinanceCloses(cleanSym, 120);
      if (closes.length >= 20) {
        const rsi = calcRSI(closes);
        if (rsi !== null) indicators.rsi = +rsi.toFixed(2);

        const macd = calcMACD(closes);
        if (macd) {
          indicators.macd       = +macd.macd.toFixed(4);
          indicators.macdSignal = +macd.signal.toFixed(4);
          indicators.macdHist   = +macd.hist.toFixed(4);
        }

        const bb = calcBB(closes);
        if (bb) {
          indicators.bbUpper  = +bb.upper.toFixed(2);
          indicators.bbMiddle = +bb.middle.toFixed(2);
          indicators.bbLower  = +bb.lower.toFixed(2);
        }

        if (closes.length >= 20) indicators.sma20 = +(closes.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(2);
        if (closes.length >= 50) indicators.sma50 = +(closes.slice(-50).reduce((a, b) => a + b, 0) / 50).toFixed(2);
        indicators.currentPrice = closes[closes.length - 1];
      }
    } else {
      // Fetch from Finnhub in parallel
      const [rsiData, macdData, bbData, sma20Data, sma50Data] = await Promise.all([
        fhIndicator(cleanSym, 'rsi',   '&timeperiod=14'),
        fhIndicator(cleanSym, 'macd',  '&fastperiod=12&slowperiod=26&signalperiod=9'),
        fhIndicator(cleanSym, 'bbands','&timeperiod=20'),
        fhIndicator(cleanSym, 'sma',   '&timeperiod=20'),
        fhIndicator(cleanSym, 'sma',   '&timeperiod=50'),
      ]);

      if (rsiData?.rsi?.length) indicators.rsi = +last(rsiData.rsi).toFixed(2);
      if (macdData?.macd?.length) {
        indicators.macd       = +last(macdData.macd).toFixed(4);
        indicators.macdSignal = +last(macdData.macdSignal).toFixed(4);
        indicators.macdHist   = +last(macdData.macdHist).toFixed(4);
      }
      if (bbData?.upperband?.length) {
        indicators.bbUpper  = +last(bbData.upperband).toFixed(2);
        indicators.bbMiddle = +last(bbData.middleband).toFixed(2);
        indicators.bbLower  = +last(bbData.lowerband).toFixed(2);
      }
      if (sma20Data?.sma?.length) indicators.sma20 = +last(sma20Data.sma).toFixed(2);
      if (sma50Data?.sma?.length) indicators.sma50 = +last(sma50Data.sma).toFixed(2);
    }

    // Cache (fire and forget)
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