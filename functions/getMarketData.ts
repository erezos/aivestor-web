// Market data: Finnhub for stocks/indices/forex, Binance for crypto
const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

async function fhQuote(symbol) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
  const d = res.ok ? await res.json() : null;
  return d?.c ? { price: d.c, pct: d.dp || 0 } : null;
}

// Crypto via Finnhub (more server-reliable than Binance which geo-blocks cloud IPs)
async function cryptoQuote(fhSym) {
  // Finnhub crypto format: BINANCE:BTCUSDT
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=BINANCE:${fhSym}&token=${FINNHUB_KEY}`);
  const d = res.ok ? await res.json() : null;
  if (d?.c) return { price: d.c, pct: d.dp || 0 };
  // fallback: Coinbase format
  const res2 = await fetch(`https://finnhub.io/api/v1/quote?symbol=COINBASE:${fhSym.replace('USDT','USD')}&token=${FINNHUB_KEY}`);
  const d2 = res2.ok ? await res2.json() : null;
  return d2?.c ? { price: d2.c, pct: d2.dp || 0 } : null;
}

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  if (n >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0.01) return n.toFixed(6);
  return n.toFixed(2);
}
function fmtPct(pct) {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${(pct || 0).toFixed(2)}%`;
}
function fmt(n) {
  if (!n) return '—';
  if (n >= 1e12) return `${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n/1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

const INDICES = [
  { label: 'S&P 500', src: 'fh', sym: '^GSPC'        },
  { label: 'NASDAQ',  src: 'fh', sym: '^IXIC'        },
  { label: 'DOW',     src: 'fh', sym: '^DJI'         },
  { label: 'BTC/USD', src: 'cr', sym: 'BTCUSDT'      },
  { label: 'ETH/USD', src: 'cr', sym: 'ETHUSDT'      },
  { label: 'GOLD',    src: 'fh', sym: 'OANDA:XAU_USD'},
  { label: 'EUR/USD', src: 'fh', sym: 'OANDA:EUR_USD'},
  { label: 'VIX',     src: 'fh', sym: '^VIX'         },
];

const TRENDING = [
  { symbol: 'NVDA',  name: 'NVIDIA Corp',    src: 'fh', sym: 'NVDA'    },
  { symbol: 'TSLA',  name: 'Tesla Inc',       src: 'fh', sym: 'TSLA'   },
  { symbol: 'AAPL',  name: 'Apple Inc',       src: 'fh', sym: 'AAPL'   },
  { symbol: 'META',  name: 'Meta Platforms',  src: 'fh', sym: 'META'   },
  { symbol: 'MSFT',  name: 'Microsoft Corp',  src: 'fh', sym: 'MSFT'   },
  { symbol: 'BTC',   name: 'Bitcoin',         src: 'cr', sym: 'BTCUSDT'},
  { symbol: 'AMZN',  name: 'Amazon.com',      src: 'fh', sym: 'AMZN'   },
  { symbol: 'GOOGL', name: 'Alphabet Inc',    src: 'fh', sym: 'GOOGL'  },
];

Deno.serve(async (req) => {
  try {
    const { type, symbols } = await req.json();

    if (type === 'indices') {
      const quotes = await Promise.all(
        INDICES.map(idx => idx.src === 'cr' ? cryptoQuote(idx.sym) : fhQuote(idx.sym))
      );
      return Response.json(INDICES.map((idx, i) => {
        const q = quotes[i];
        return { symbol: idx.label, value: q ? fmtPrice(q.price) : '—', change: q ? fmtPct(q.pct) : '—', positive: (q?.pct ?? 0) >= 0 };
      }));
    }

    if (type === 'trending') {
      const quotes = await Promise.all(
        TRENDING.map(t => t.src === 'cr' ? cryptoQuote(t.sym) : fhQuote(t.sym))
      );
      return Response.json(TRENDING.map((t, i) => {
        const q = quotes[i];
        return { symbol: t.symbol, name: t.name, price: q ? fmtPrice(q.price) : '—', change: fmtPct(q?.pct ?? 0), positive: (q?.pct ?? 0) >= 0 };
      }));
    }

    if (type === 'multi' && symbols?.length) {
      const quotes = await Promise.all(symbols.map(sym =>
        CRYPTO_SET.has(sym.toUpperCase())
          ? cryptoQuote(sym.toUpperCase() + 'USDT')
          : fhQuote(sym)
      ));
      const result = {};
      symbols.forEach((sym, i) => {
        const q = quotes[i];
        const pct = q?.pct ?? 0;
        result[sym] = { price: q?.price ?? 0, change: fmtPct(pct), pct, positive: pct >= 0 };
      });
      return Response.json(result);
    }

    return Response.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});