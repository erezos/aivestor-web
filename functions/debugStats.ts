const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const ALPACA_KEY  = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC  = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR  = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };

Deno.serve(async (req) => {
  const symbol = 'AAPL';
  const start = new Date(Date.now() - 366 * 86400000).toISOString();

  const [alpacaRes, metricsRes] = await Promise.all([
    fetch(`https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&limit=500&sort=asc`, { headers: ALPACA_HDR }).then(r => r.text()),
    fetch(`https://finnhub.io/api/v1/stock/basic-financials?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).then(r => r.text()),
  ]);

  return Response.json({
    alpaca_preview: alpacaRes.slice(0, 400),
    metrics_preview: metricsRes.slice(0, 400),
  });
});