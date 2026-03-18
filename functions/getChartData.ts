import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AIVestor/1.0)' };

// Cache TTL per range
const TTL = { '1d': 5, '5d': 15, '1mo': 60, '3mo': 120, '1y': 240 }; // minutes

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol, range = '3mo' } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cacheKey = `chart_${symbol}_${range}`;
    const ttlMs = (TTL[range] || 60) * 60 * 1000;

    // Check cache first
    const cached = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const entry = cached[0];
    if (entry && (Date.now() - new Date(entry.refreshed_at).getTime()) < ttlMs) {
      return Response.json(JSON.parse(entry.data));
    }

    // Fetch from Yahoo
    const yahooSym = ['BTC','ETH','SOL','XRP','DOGE'].includes(symbol) ? `${symbol}-USD` : symbol;
    const interval = range === '1d' ? '5m' : range === '5d' ? '30m' : '1d';

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?range=${range}&interval=${interval}&events=history`,
      { headers: HEADERS }
    );
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return Response.json([]);

    const ts = result.timestamp;
    const q  = result.indicators.quote[0];
    const candles = [];

    for (let i = 0; i < ts.length; i++) {
      if (!q.open[i] || !q.high[i] || !q.low[i] || !q.close[i]) continue;
      candles.push({
        time:   ts[i],
        open:   parseFloat(q.open[i].toFixed(4)),
        high:   parseFloat(q.high[i].toFixed(4)),
        low:    parseFloat(q.low[i].toFixed(4)),
        close:  parseFloat(q.close[i].toFixed(4)),
        volume: q.volume[i] || 0,
      });
    }

    // Save to cache (fire and forget)
    const payload = { cache_key: cacheKey, data: JSON.stringify(candles), refreshed_at: new Date().toISOString() };
    if (entry) {
      base44.asServiceRole.entities.CachedData.update(entry.id, payload);
    } else {
      base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json(candles);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});