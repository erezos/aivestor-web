// Server-side Yahoo Finance chart data (replaces client-side CORS proxy)
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AIVestor/1.0)' };

Deno.serve(async (req) => {
  try {
    const { symbol, range = '3mo' } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

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

    return Response.json(candles);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});