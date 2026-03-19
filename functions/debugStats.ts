const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

Deno.serve(async (req) => {
  const { symbol } = await req.json();

  const [profileRes, metricsRes, quoteRes, yahooRes] = await Promise.all([
    fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.text()),
    fetch(`https://finnhub.io/api/v1/stock/basic-financials?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`).then(r => r.text()),
    fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_KEY}`).then(r => r.text()),
    fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://finance.yahoo.com' }
    }).then(r => r.text()),
  ]);

  return Response.json({
    profile: profileRes.slice(0, 500),
    metrics: metricsRes.slice(0, 500),
    quote:   quoteRes.slice(0, 300),
    yahoo:   yahooRes.slice(0, 800),
  });
});