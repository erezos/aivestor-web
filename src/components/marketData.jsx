import { base44 } from '@/api/base44Client';

export async function fetchMarketIndices() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get the current real-time prices and daily percentage changes for these market indices and assets as of today (${new Date().toDateString()}):
S&P 500, NASDAQ Composite, Dow Jones, BTC/USD (Bitcoin), ETH/USD (Ethereum), Gold (XAU/USD), EUR/USD, VIX.
Return an array with symbol (short name), current value as formatted string, change percentage as string like "+1.23%" or "-0.45%", and positive boolean.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        indices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              value: { type: 'string' },
              change: { type: 'string' },
              positive: { type: 'boolean' }
            }
          }
        }
      }
    }
  });
  return result.indices;
}

export async function fetchTrendingTickers() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get current real-time prices and daily % changes for: NVDA, TSLA, AAPL, META, MSFT, BTC, AMZN, GOOGL as of today (${new Date().toDateString()}).
For each: symbol, full name, current price as formatted string (e.g. "892.45"), daily change as string (e.g. "+5.67%" or "-1.23%"), positive boolean.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        tickers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'string' },
              change: { type: 'string' },
              positive: { type: 'boolean' }
            }
          }
        }
      }
    }
  });
  return result.tickers;
}

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
              title: { type: 'string' },
              summary: { type: 'string' },
              source: { type: 'string' },
              time: { type: 'string' },
              category: { type: 'string' },
              sentiment: { type: 'string' }
            }
          }
        }
      }
    }
  });
  return result.articles;
}

export async function fetchHotBoard() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get current real-time prices, daily % changes, and key trading data for these 14 assets as of today (${new Date().toDateString()}):
Stocks: NVDA, TSLA, AAPL, META, MSFT, AMZN, GOOGL, JPM, GS, AMD
Crypto: BTC, ETH, SOL, XRP

For each asset return:
- symbol (ticker)
- name (full name)
- price (current price as formatted string, e.g. "892.45" or "97,432")
- change (daily % change as string e.g. "+5.67%" or "-2.14%")
- positive (boolean, true if change is positive)
- category ("stock" or "crypto")
- sector (e.g. "Tech", "Finance", "Crypto", "Auto")
- volume (formatted daily volume, e.g. "89.2M" or "48.9B")
- signal (AI trading signal: "Strong Buy", "Buy", "Hold", "Sell", or "Strong Sell" based on current momentum)
- aiScore (AI confidence score 0-100 based on technical momentum and trend strength)`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        tickers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              symbol: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'string' },
              change: { type: 'string' },
              positive: { type: 'boolean' },
              category: { type: 'string' },
              sector: { type: 'string' },
              volume: { type: 'string' },
              signal: { type: 'string' },
              aiScore: { type: 'number' }
            }
          }
        }
      }
    }
  });
  return result.tickers;
}

export async function fetchMarketSentiment() {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get the current market fear & greed sentiment data as of today (${new Date().toDateString()}).
Provide:
- overall score (0-100, where 0=Extreme Fear, 100=Extreme Greed)
- scores for these 4 indicators (each 0-100):
  1. Market Momentum (based on S&P 500 vs 125-day moving average)
  2. Stock Strength (52-week highs vs lows on NYSE)
  3. Put/Call Ratio (inverted, high ratio = fear)
  4. Volatility / VIX (inverted, high VIX = fear)

Base this on real current market conditions.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        overall: { type: 'number' },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'number' }
            }
          }
        }
      }
    }
  });
  return result;
}

export async function fetchAssetData(symbol) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `Get current real-time market data for ${symbol} as of today (${new Date().toDateString()}).
Provide: full company/asset name, current price (number), daily change % (number, e.g. 2.34 or -1.23),
sector, market cap formatted (e.g. "2.2T"), P/E ratio as string ("-" for crypto), daily volume formatted,
52-week high (number), 52-week low (number).
Also provide: AI technical analysis summary (2-3 sentences), overall signal (Strong Buy/Buy/Hold/Sell/Strong Sell),
confidence % (0-100), and 6 indicator readings: RSI(14), MACD, Bollinger Bands, SMA 50/200, Volume, Stochastic —
each with current value/status string and signal (Buy/Strong Buy/Neutral/Hold/Caution/Sell/Strong Sell).`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        change: { type: 'number' },
        sector: { type: 'string' },
        marketCap: { type: 'string' },
        pe: { type: 'string' },
        volume: { type: 'string' },
        high52: { type: 'number' },
        low52: { type: 'number' },
        aiSignal: { type: 'string' },
        aiConfidence: { type: 'number' },
        aiSummary: { type: 'string' },
        indicators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              value: { type: 'string' },
              signal: { type: 'string' }
            }
          }
        }
      }
    }
  });
  return result;
}