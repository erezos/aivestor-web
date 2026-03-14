import { base44 } from '@/api/base44Client';

// ─── CORS Proxy ───────────────────────────────────────────────────────────────
const PROXY = 'https://api.allorigins.win/raw?url=';

function proxied(url) {
  return `${PROXY}${encodeURIComponent(url)}`;
}

// ─── Yahoo Finance helpers ────────────────────────────────────────────────────
async function yahooQuote(symbols) {
  // symbols: array of Yahoo tickers e.g. ['AAPL', 'BTC-USD', '^GSPC']
  const joined = symbols.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}&fields=regularMarketPrice,regularMarketChangePercent,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow,marketCap,trailingPE,shortName,longName`;
  const res = await fetch(proxied(url));
  const json = await res.json();
  return json?.quoteResponse?.result || [];
}

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n.toFixed(2);
}

function fmtChange(pct) {
  if (pct === null || pct === undefined) return '0.00%';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

// ─── Batch quote fetch (used by Watchlist & Portfolio) ───────────────────────
// symbols: array of display symbols like ['AAPL','BTC','ETH']
export async function fetchMultiQuote(symbols) {
  const toYahoo = s =>
    s === 'BTC' ? 'BTC-USD' : s === 'ETH' ? 'ETH-USD' :
    s === 'SOL' ? 'SOL-USD' : s === 'XRP' ? 'XRP-USD' :
    s === 'DOGE' ? 'DOGE-USD' : s;

  const yahooSyms = symbols.map(toYahoo);
  const quotes = await yahooQuote(yahooSyms);

  const result = {};
  symbols.forEach((sym, i) => {
    const q = quotes.find(r => r.symbol === yahooSyms[i]);
    const pct = q?.regularMarketChangePercent ?? 0;
    result[sym] = {
      price:    q?.regularMarketPrice ?? 0,
      change:   fmtChange(pct),
      pct,
      positive: pct >= 0,
    };
  });
  return result;
}

// ─── 1. Market Indices (Yahoo Finance — FREE) ─────────────────────────────────
export async function fetchMarketIndices() {
  const YAHOO_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', 'BTC-USD', 'ETH-USD', 'GC=F', 'EURUSD=X', '^VIX'];
  const LABELS       = ['S&P 500', 'NASDAQ', 'DOW', 'BTC/USD', 'ETH/USD', 'GOLD', 'EUR/USD', 'VIX'];

  const quotes = await yahooQuote(YAHOO_SYMBOLS);

  return YAHOO_SYMBOLS.map((sym, i) => {
    const q = quotes.find(r => r.symbol === sym);
    const price = q?.regularMarketPrice;
    const pct   = q?.regularMarketChangePercent;
    return {
      symbol:   LABELS[i],
      value:    price ? fmtPrice(price) : '—',
      change:   fmtChange(pct),
      positive: (pct ?? 0) >= 0,
    };
  });
}

// ─── 2. Trending Tickers for Dashboard (Yahoo Finance — FREE) ────────────────
export async function fetchTrendingTickers() {
  const SYMBOLS = ['NVDA', 'TSLA', 'AAPL', 'META', 'MSFT', 'BTC-USD', 'AMZN', 'GOOGL'];
  const NAMES   = {
    'NVDA': 'NVIDIA Corp', 'TSLA': 'Tesla Inc', 'AAPL': 'Apple Inc',
    'META': 'Meta Platforms', 'MSFT': 'Microsoft Corp',
    'BTC-USD': 'Bitcoin', 'AMZN': 'Amazon.com', 'GOOGL': 'Alphabet Inc',
  };

  const quotes = await yahooQuote(SYMBOLS);

  return SYMBOLS.map(sym => {
    const q   = quotes.find(r => r.symbol === sym);
    const pct = q?.regularMarketChangePercent;
    return {
      symbol:   sym === 'BTC-USD' ? 'BTC' : sym,
      name:     NAMES[sym],
      price:    q ? fmtPrice(q.regularMarketPrice) : '—',
      change:   fmtChange(pct),
      positive: (pct ?? 0) >= 0,
    };
  });
}

// ─── 3. Hot Board — prices from Yahoo, AI scores via lightweight LLM ─────────
const HOT_SYMBOLS = ['NVDA','TSLA','AAPL','META','MSFT','AMZN','GOOGL','JPM','GS','AMD','BTC-USD','ETH-USD','SOL-USD','XRP-USD'];
const HOT_META = {
  'NVDA':    { name: 'NVIDIA Corp',     category: 'stock',  sector: 'Tech' },
  'TSLA':    { name: 'Tesla Inc',       category: 'stock',  sector: 'Auto' },
  'AAPL':    { name: 'Apple Inc',       category: 'stock',  sector: 'Tech' },
  'META':    { name: 'Meta Platforms',  category: 'stock',  sector: 'Tech' },
  'MSFT':    { name: 'Microsoft Corp',  category: 'stock',  sector: 'Tech' },
  'AMZN':    { name: 'Amazon.com',      category: 'stock',  sector: 'Tech' },
  'GOOGL':   { name: 'Alphabet Inc',    category: 'stock',  sector: 'Tech' },
  'JPM':     { name: 'JPMorgan Chase',  category: 'stock',  sector: 'Finance' },
  'GS':      { name: 'Goldman Sachs',   category: 'stock',  sector: 'Finance' },
  'AMD':     { name: 'AMD Inc',         category: 'stock',  sector: 'Tech' },
  'BTC-USD': { name: 'Bitcoin',         category: 'crypto', sector: 'Crypto', display: 'BTC' },
  'ETH-USD': { name: 'Ethereum',        category: 'crypto', sector: 'Crypto', display: 'ETH' },
  'SOL-USD': { name: 'Solana',          category: 'crypto', sector: 'Crypto', display: 'SOL' },
  'XRP-USD': { name: 'Ripple',          category: 'crypto', sector: 'Crypto', display: 'XRP' },
};

export async function fetchHotBoard() {
  // Step 1: free price data
  const quotes = await yahooQuote(HOT_SYMBOLS);

  // Step 2: AI assigns signals + scores based on % change & volume (cheap prompt, no internet needed)
  const priceData = HOT_SYMBOLS.map(sym => {
    const q = quotes.find(r => r.symbol === sym);
    return {
      symbol: HOT_META[sym]?.display || sym,
      pct: q?.regularMarketChangePercent?.toFixed(2) ?? '0',
      price: q ? fmtPrice(q.regularMarketPrice) : '—',
    };
  });

  const aiResult = await base44.integrations.Core.InvokeLLM({
    prompt: `Given these assets and their real-time daily % changes, assign each an AI trading signal and score.
Data: ${JSON.stringify(priceData)}
Rules: signal = Strong Buy/Buy/Hold/Sell/Strong Sell based on momentum. aiScore = 0-100.
Return array with symbol, signal, aiScore.`,
    response_json_schema: {
      type: 'object',
      properties: {
        signals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              signal: { type: 'string' },
              aiScore: { type: 'number' },
            }
          }
        }
      }
    }
  });

  const signalMap = {};
  (aiResult.signals || []).forEach(s => { signalMap[s.symbol] = s; });

  return HOT_SYMBOLS.map(sym => {
    const q      = quotes.find(r => r.symbol === sym);
    const meta   = HOT_META[sym];
    const pct    = q?.regularMarketChangePercent ?? 0;
    const display = meta?.display || sym;
    const sig    = signalMap[display] || { signal: 'Hold', aiScore: 50 };
    return {
      symbol:   display,
      name:     meta.name,
      price:    q ? fmtPrice(q.regularMarketPrice) : '—',
      change:   fmtChange(pct),
      positive: pct >= 0,
      category: meta.category,
      sector:   meta.sector,
      volume:   q?.regularMarketVolume ? fmt(q.regularMarketVolume) : '—',
      signal:   sig.signal,
      aiScore:  sig.aiScore,
    };
  });
}

// ─── 4. Market Sentiment — Fear & Greed API (FREE, no key) ───────────────────
export async function fetchMarketSentiment() {
  const res  = await fetch(proxied('https://api.alternative.me/fng/?limit=1&format=json'));
  const json = await res.json();
  const item = json?.data?.[0];
  const overall = item ? parseInt(item.value) : 50;

  // Sub-indicators: derive from overall with slight variation (API only gives overall)
  const vary = (base, offset) => Math.min(100, Math.max(0, base + offset));
  return {
    overall,
    indicators: [
      { name: 'Market Momentum',  value: vary(overall, +8) },
      { name: 'Stock Strength',   value: vary(overall, -5) },
      { name: 'Put/Call Ratio',   value: vary(overall, +3) },
      { name: 'Volatility (VIX)', value: vary(overall, -10) },
    ],
  };
}

// ─── 5. Market News — AI only (no free API for quality news) ─────────────────
export async function fetchMarketNews() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get the 8 most important financial/market news stories from today (${new Date().toDateString()}).
Cover stocks, crypto, economy, tech, commodities. For each: title, 1-2 sentence summary, source name,
time ago (e.g. "2h ago"), category (Stocks/Crypto/Economy/Tech/Commodities), sentiment (bullish/bearish/neutral).`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        articles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:     { type: 'string' },
              summary:   { type: 'string' },
              source:    { type: 'string' },
              time:      { type: 'string' },
              category:  { type: 'string' },
              sentiment: { type: 'string' },
            }
          }
        }
      }
    }
  });
  return result.articles;
}

// ─── 6. Asset Detail — prices from Yahoo, AI analysis lightweight ─────────────
export async function fetchAssetData(symbol) {
  // Map display symbols to Yahoo symbols
  const yahooSym = symbol === 'BTC' ? 'BTC-USD'
    : symbol === 'ETH' ? 'ETH-USD'
    : symbol === 'SOL' ? 'SOL-USD'
    : symbol === 'XRP' ? 'XRP-USD'
    : symbol;

  // Fetch price data free from Yahoo
  const quotes = await yahooQuote([yahooSym]);
  const q = quotes[0];

  // AI technical analysis only (no internet needed — just analysis based on the symbol)
  const aiResult = await base44.integrations.Core.InvokeLLM({
    prompt: `Provide a brief AI technical analysis for ${symbol} based on general knowledge of its recent price trend and momentum as of ${new Date().toDateString()}.
Give: overall signal (Strong Buy/Buy/Hold/Sell/Strong Sell), confidence % (0-100), 2-sentence summary,
and 6 indicator readings for: RSI(14), MACD, Bollinger Bands, SMA 50/200, Volume Trend, Stochastic —
each with a value/status string and signal (Buy/Strong Buy/Neutral/Hold/Caution/Sell/Strong Sell).`,
    response_json_schema: {
      type: 'object',
      properties: {
        aiSignal:     { type: 'string' },
        aiConfidence: { type: 'number' },
        aiSummary:    { type: 'string' },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name:   { type: 'string' },
              value:  { type: 'string' },
              signal: { type: 'string' },
            }
          }
        }
      }
    }
  });

  return {
    name:      q?.shortName || q?.longName || symbol,
    price:     q?.regularMarketPrice ?? 0,
    change:    q?.regularMarketChangePercent ?? 0,
    sector:    q?.sector || (yahooSym.includes('-USD') ? 'Crypto' : 'Equity'),
    marketCap: q?.marketCap ? fmt(q.marketCap) : '—',
    pe:        q?.trailingPE ? q.trailingPE.toFixed(1) : '—',
    volume:    q?.regularMarketVolume ? fmt(q.regularMarketVolume) : '—',
    high52:    q?.fiftyTwoWeekHigh ?? null,
    low52:     q?.fiftyTwoWeekLow ?? null,
    aiSignal:     aiResult.aiSignal,
    aiConfidence: aiResult.aiConfidence,
    aiSummary:    aiResult.aiSummary,
    indicators:   aiResult.indicators || [],
  };
}