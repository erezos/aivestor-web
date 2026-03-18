// Unified server-side price data endpoint (no AI, no cache — live prices)
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function yahooQuote(symbols) {
  const res = await fetch(
    `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${symbols.join(',')}&range=1d&interval=1d`,
    { headers: HEADERS }
  );
  const spark = await res.json();
  // Also fetch quote for price/change data
  const res2 = await fetch(
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,trailingPE,shortName`,
    { headers: HEADERS }
  );
  const json = await res2.json();
  return json?.quoteResponse?.result || [];
}

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  return n >= 1000 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(2);
}
function fmtChange(pct) {
  const sign = (pct ?? 0) >= 0 ? '+' : '';
  return `${sign}${(pct || 0).toFixed(2)}%`;
}

const INDEX_SYMBOLS = ['^GSPC','^IXIC','^DJI','BTC-USD','ETH-USD','GC=F','EURUSD=X','^VIX'];
const INDEX_LABELS  = ['S&P 500','NASDAQ','DOW','BTC/USD','ETH/USD','GOLD','EUR/USD','VIX'];

const TRENDING_SYMBOLS = ['NVDA','TSLA','AAPL','META','MSFT','BTC-USD','AMZN','GOOGL'];
const TRENDING_NAMES   = {
  'NVDA':'NVIDIA Corp','TSLA':'Tesla Inc','AAPL':'Apple Inc',
  'META':'Meta Platforms','MSFT':'Microsoft Corp',
  'BTC-USD':'Bitcoin','AMZN':'Amazon.com','GOOGL':'Alphabet Inc',
};

Deno.serve(async (req) => {
  try {
    const { type, symbols } = await req.json();

    if (type === 'indices') {
      const quotes = await yahooQuote(INDEX_SYMBOLS);
      return Response.json(INDEX_SYMBOLS.map((sym, i) => {
        const q = quotes.find(r => r.symbol === sym);
        const pct = q?.regularMarketChangePercent;
        return { symbol: INDEX_LABELS[i], value: q?.regularMarketPrice ? fmtPrice(q.regularMarketPrice) : '—', change: fmtChange(pct), positive: (pct ?? 0) >= 0 };
      }));
    }

    if (type === 'trending') {
      const quotes = await yahooQuote(TRENDING_SYMBOLS);
      return Response.json(TRENDING_SYMBOLS.map(sym => {
        const q = quotes.find(r => r.symbol === sym);
        const pct = q?.regularMarketChangePercent;
        return { symbol: sym === 'BTC-USD' ? 'BTC' : sym, name: TRENDING_NAMES[sym], price: q ? fmtPrice(q.regularMarketPrice) : '—', change: fmtChange(pct), positive: (pct ?? 0) >= 0 };
      }));
    }

    if (type === 'multi' && symbols?.length) {
      const toYahoo = s => ['BTC','ETH','SOL','XRP','DOGE'].includes(s) ? `${s}-USD` : s;
      const yahooSyms = symbols.map(toYahoo);
      const quotes = await yahooQuote(yahooSyms);
      const result = {};
      symbols.forEach((sym, i) => {
        const q = quotes.find(r => r.symbol === yahooSyms[i]);
        const pct = q?.regularMarketChangePercent ?? 0;
        result[sym] = { price: q?.regularMarketPrice ?? 0, change: fmtChange(pct), pct, positive: pct >= 0 };
      });
      return Response.json(result);
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});