// Server-side market data — uses Yahoo Finance v8/chart which is reliable from server
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// Fetch latest price + change for a symbol via the chart endpoint (most reliable)
async function fetchPrice(symbol) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=2d&interval=1d`,
    { headers: HEADERS }
  );
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta;
  return {
    symbol,
    price: meta?.regularMarketPrice ?? meta?.previousClose ?? null,
    pct: meta?.regularMarketChangePercent ?? null,
    prevClose: meta?.previousClose ?? null,
  };
}

// Fetch all symbols concurrently
async function fetchPrices(symbols) {
  const results = await Promise.all(symbols.map(fetchPrice));
  const map = {};
  results.forEach(r => { if (r) map[r.symbol] = r; });
  return map;
}

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  return n >= 1000 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(2);
}
function fmtChange(pct) {
  if (pct === null || pct === undefined) return '+0.00%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', 'BTC-USD', 'ETH-USD', 'GC=F', 'EURUSD=X', '^VIX'];
const INDEX_LABELS  = ['S&P 500', 'NASDAQ', 'DOW', 'BTC/USD', 'ETH/USD', 'GOLD', 'EUR/USD', 'VIX'];

const TRENDING_SYMBOLS = ['NVDA', 'TSLA', 'AAPL', 'META', 'MSFT', 'BTC-USD', 'AMZN', 'GOOGL'];
const TRENDING_NAMES = {
  'NVDA': 'NVIDIA Corp', 'TSLA': 'Tesla Inc', 'AAPL': 'Apple Inc',
  'META': 'Meta Platforms', 'MSFT': 'Microsoft Corp',
  'BTC-USD': 'Bitcoin', 'AMZN': 'Amazon.com', 'GOOGL': 'Alphabet Inc',
};

Deno.serve(async (req) => {
  try {
    const { type, symbols } = await req.json();

    if (type === 'indices') {
      const prices = await fetchPrices(INDEX_SYMBOLS);
      return Response.json(INDEX_SYMBOLS.map((sym, i) => {
        const q = prices[sym];
        return {
          symbol: INDEX_LABELS[i],
          value: q?.price ? fmtPrice(q.price) : '—',
          change: fmtChange(q?.pct),
          positive: (q?.pct ?? 0) >= 0,
        };
      }));
    }

    if (type === 'trending') {
      const prices = await fetchPrices(TRENDING_SYMBOLS);
      return Response.json(TRENDING_SYMBOLS.map(sym => {
        const q = prices[sym];
        return {
          symbol: sym === 'BTC-USD' ? 'BTC' : sym,
          name: TRENDING_NAMES[sym],
          price: q?.price ? fmtPrice(q.price) : '—',
          change: fmtChange(q?.pct),
          positive: (q?.pct ?? 0) >= 0,
        };
      }));
    }

    if (type === 'multi' && symbols?.length) {
      const toYahoo = s => ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE'].includes(s) ? `${s}-USD` : s;
      const yahooSyms = symbols.map(toYahoo);
      const prices = await fetchPrices(yahooSyms);
      const result = {};
      symbols.forEach((sym, i) => {
        const q = prices[yahooSyms[i]];
        const pct = q?.pct ?? 0;
        result[sym] = { price: q?.price ?? 0, change: fmtChange(pct), pct, positive: pct >= 0 };
      });
      return Response.json(result);
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});