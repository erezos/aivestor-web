// Asset analysis: Finnhub fundamentals + real indicators + AI interpretation
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY  = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET   = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);
const CACHE_TTL_MS = 30 * 60000; // 30 min

function fmt(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n/1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

const ALPACA_KEY = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };

// RSI from Alpaca crypto bars
async function cryptoRSI(symbol) {
  const start = new Date(Date.now() - 60 * 86400000).toISOString();
  const sym   = `${symbol}/USD`;
  const res   = await fetch(`https://data.alpaca.markets/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(sym)}&timeframe=1Day&start=${start}&limit=60&sort=asc`, { headers: ALPACA_HDR });
  const json  = res.ok ? await res.json() : null;
  const bars  = json?.bars?.[sym] || [];
  if (bars.length < 16) return null;
  const closes = bars.map(b => b.c);
  const period = 14;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) gains += d; else losses -= d;
  }
  let ag = gains / period, al = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    ag = (ag * (period-1) + Math.max(d, 0)) / period;
    al = (al * (period-1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

async function bgRefreshAI(base44, cleanSym, isCrypto, livePrice, liveChange, cacheEntry) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const from90 = now - 90 * 86400;

    const [profile, recs, rsiData, newsData, metrics] = await Promise.all([
      isCrypto ? null : fhGet(`/stock/profile2?symbol=${cleanSym}`),
      isCrypto ? null : fhGet(`/stock/recommendation?symbol=${cleanSym}`),
      isCrypto
        ? cryptoRSI(cleanSym)
        : fhGet(`/indicator?symbol=${cleanSym}&resolution=D&from=${from90}&to=${now}&indicator=rsi&timeperiod=14`).then(d => d?.rsi?.slice(-1)[0] ?? null),
      isCrypto
        ? null
        : fhGet(`/company-news?symbol=${cleanSym}&from=${new Date(Date.now()-5*86400000).toISOString().slice(0,10)}&to=${new Date().toISOString().slice(0,10)}`).then(d => (d||[]).slice(0,3).map(a => a.headline)),
      isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${cleanSym}&metric=all`),
    ]);

    const rsi = typeof rsiData === 'number' ? rsiData : null;
    const rec = recs?.[0];
    const mcapRaw = profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : null;

    // Compact data for AI — token optimized, real values
    const snap = {
      p:   livePrice?.toFixed(2),
      chg: `${liveChange?.toFixed(2)}%`,
      rsi: rsi ? +rsi.toFixed(1) : 'N/A',
      rsiCtx: rsi ? (rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral') : '',
      rec: rec ? `${(rec.strongBuy||0)+(rec.buy||0)}B/${rec.hold||0}H/${(rec.strongSell||0)+(rec.sell||0)}S` : 'N/A',
      sector: profile?.finnhubIndustry || (isCrypto ? 'Crypto' : 'Equity'),
    };
    if (newsData?.length) snap.news = newsData.map(h => h.slice(0, 80));

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze ${cleanSym} using REAL live data: ${JSON.stringify(snap)}
RSI is ${snap.rsiCtx || 'N/A'}. Analyst consensus: ${snap.rec}. ${snap.news ? `Recent headlines: ${JSON.stringify(snap.news)}` : ''}
Give precise grounded analysis — no hallucination, use the numbers above.
Output: signal(Strong Buy/Buy/Hold/Caution/Sell), confidence(0-100), 2-sentence summary, 6 indicator rows(RSI,MACD,Bollinger,SMA 50/200,Volume Trend,Stochastic) each with real-informed value+signal.`,
      response_json_schema: {
        type: 'object',
        properties: {
          aiSignal:     { type: 'string' },
          aiConfidence: { type: 'number' },
          aiSummary:    { type: 'string' },
          indicators:   { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, value:{type:'string'}, signal:{type:'string'} } } }
        }
      }
    });

    const analysisData = {
      name:         profile?.name || cleanSym,
      sector:       profile?.finnhubIndustry || (isCrypto ? 'Crypto' : 'Equity'),
      marketCap:    mcapRaw ? fmt(mcapRaw) : '—',
      pe:           metrics?.metric?.peBasicExclExtraTTM?.toFixed(1) || '—',
      volume:       metrics?.metric?.['10DayAverageTradingVolume'] ? fmt(metrics.metric['10DayAverageTradingVolume'] * 1e6) : '—',
      high52:       metrics?.metric?.['52WeekHigh'] ?? null,
      low52:        metrics?.metric?.['52WeekLow']  ?? null,
      aiSignal:     aiResult.aiSignal,
      aiConfidence: aiResult.aiConfidence,
      aiSummary:    aiResult.aiSummary,
      indicators:   aiResult.indicators || [],
      analystRec:   rec ? { buy: (rec.strongBuy||0)+(rec.buy||0), hold: rec.hold||0, sell: (rec.strongSell||0)+(rec.sell||0) } : null,
    };

    const payload = { cache_key: `asset_${cleanSym}`, data: JSON.stringify(analysisData), refreshed_at: new Date().toISOString() };
    if (cacheEntry) {
      await base44.asServiceRole.entities.CachedData.update(cacheEntry.id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }
    return analysisData;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const isCrypto = CRYPTO_SET.has(cleanSym);
    const cacheKey = `asset_${cleanSym}`;

    // Parallel: cache lookup + live price fetch
    const pricePromise = isCrypto
      ? fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${cleanSym}USDT`).then(r => r.json())
      : fhGet(`/quote?symbol=${cleanSym}`);

    const [rows, priceData] = await Promise.all([
      base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey }),
      pricePromise,
    ]);

    const cached    = rows[0];
    const cacheAge  = cached ? Date.now() - new Date(cached.refreshed_at).getTime() : Infinity;
    const livePrice = isCrypto ? parseFloat(priceData?.lastPrice || 0) : (priceData?.c || 0);
    const liveChange = isCrypto ? parseFloat(priceData?.priceChangePercent || 0) : (priceData?.dp || 0);

    // Fresh cache → return immediately
    if (cached && cacheAge < CACHE_TTL_MS) {
      const data = JSON.parse(cached.data);
      return Response.json({ ...data, price: livePrice || data.price, change: liveChange });
    }

    // Stale cache → return stale immediately, refresh AI in background
    if (cached && cacheAge >= CACHE_TTL_MS) {
      const staleData = JSON.parse(cached.data);
      bgRefreshAI(base44, cleanSym, isCrypto, livePrice, liveChange, cached);
      return Response.json({ ...staleData, price: livePrice || staleData.price, change: liveChange });
    }

    // Cold cache (first visit) — must run synchronously
    const freshData = await bgRefreshAI(base44, cleanSym, isCrypto, livePrice, liveChange, null);
    if (!freshData) return Response.json({ error: 'Analysis failed' }, { status: 502 });

    return Response.json({ ...freshData, price: livePrice, change: liveChange });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});