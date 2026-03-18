import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY   = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY    = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SECRET = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR    = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET };

const CRYPTO_SET = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

// Alpaca: timeframe + lookback days per range
const ALPACA_CFG = {
  '1d':  { tf: '5Min',  days: 3   },
  '5d':  { tf: '30Min', days: 8   },
  '1mo': { tf: '1Day',  days: 35  },
  '3mo': { tf: '1Day',  days: 95  },
  '1y':  { tf: '1Day',  days: 370 },
};

// Binance: interval + limit per range
const BINANCE_CFG = {
  '1d':  { interval: '5m',  limit: 300 },
  '5d':  { interval: '30m', limit: 250 },
  '1mo': { interval: '1d',  limit: 32  },
  '3mo': { interval: '1d',  limit: 92  },
  '1y':  { interval: '1d',  limit: 366 },
};

// Cache TTL in minutes per range
const TTL_MIN = { '1d': 5, '5d': 10, '1mo': 60, '3mo': 120, '1y': 240 };

async function getAlpacaBars(symbol, range) {
  const { tf, days } = ALPACA_CFG[range] || ALPACA_CFG['3mo'];
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${tf}&start=${start}&limit=1000&sort=asc`;
  const res = await fetch(url, { headers: ALPACA_HDR });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.bars || []).map(b => ({
    time:   Math.floor(new Date(b.t).getTime() / 1000),
    open:   +b.o.toFixed(4),
    high:   +b.h.toFixed(4),
    low:    +b.l.toFixed(4),
    close:  +b.c.toFixed(4),
    volume: b.v || 0,
  }));
}

// Crypto chart via Finnhub candles (Binance geo-blocks cloud IPs)
async function getCryptoBars(symbol, range) {
  const days = { '1d': 2, '5d': 8, '1mo': 35, '3mo': 95, '1y': 370 }[range] || 95;
  const res  = { '1d': 'D', '5d': 'D', '1mo': 'D', '3mo': 'D', '1y': 'W' }[range] || 'D';
  const now  = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;

  // Try BINANCE: prefix, then COINBASE:
  const tryFetch = async (fhSym) => {
    const url = `https://finnhub.io/api/v1/crypto/candle?symbol=${fhSym}&resolution=${res}&from=${from}&to=${now}&token=${FINNHUB_KEY}`;
    const r   = await fetch(url);
    const j   = r.ok ? await r.json() : null;
    return j?.s === 'ok' && j.c?.length ? j : null;
  };

  const d = await tryFetch(`BINANCE:${symbol}USDT`) || await tryFetch(`COINBASE:${symbol}USD`);
  if (!d) return [];
  return d.t.map((ts, i) => ({
    time:   ts,
    open:   +d.o[i].toFixed(4),
    high:   +d.h[i].toFixed(4),
    low:    +d.l[i].toFixed(4),
    close:  +d.c[i].toFixed(4),
    volume: d.v[i] || 0,
  }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol, range = '3mo' } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym  = symbol.replace(/-USD$/i, '').toUpperCase();
    const cacheKey  = `chart_${cleanSym}_${range}`;
    const ttlMs     = (TTL_MIN[range] || 60) * 60000;
    const isCrypto  = CRYPTO_SET.has(cleanSym);

    // Check cache first
    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const entry = rows[0];
    if (entry && Date.now() - new Date(entry.refreshed_at).getTime() < ttlMs) {
      return Response.json(JSON.parse(entry.data));
    }

    // Fetch from provider
    const candles = isCrypto
      ? await getCryptoBars(cleanSym, range)
      : await getAlpacaBars(cleanSym, range);

    // Prefer stale cache over empty response (e.g. weekend / market closed)
    if (!candles.length && entry) return Response.json(JSON.parse(entry.data));
    if (!candles.length) return Response.json([]);

    // Persist cache (fire and forget)
    const payload = { cache_key: cacheKey, data: JSON.stringify(candles), refreshed_at: new Date().toISOString() };
    if (entry) {
      base44.asServiceRole.entities.CachedData.update(entry.id, payload);
    } else {
      base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(candles);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});