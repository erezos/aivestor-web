// HotBoard refresh: Finnhub for stocks, Binance for crypto, AI for signals
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

const STOCKS = [
  { symbol: 'NVDA',  name: 'NVIDIA Corp',    sector: 'Tech'    },
  { symbol: 'TSLA',  name: 'Tesla Inc',       sector: 'Auto'    },
  { symbol: 'AAPL',  name: 'Apple Inc',       sector: 'Tech'    },
  { symbol: 'META',  name: 'Meta Platforms',  sector: 'Tech'    },
  { symbol: 'MSFT',  name: 'Microsoft Corp',  sector: 'Tech'    },
  { symbol: 'AMZN',  name: 'Amazon.com',      sector: 'Tech'    },
  { symbol: 'GOOGL', name: 'Alphabet Inc',    sector: 'Tech'    },
  { symbol: 'JPM',   name: 'JPMorgan Chase',  sector: 'Finance' },
  { symbol: 'GS',    name: 'Goldman Sachs',   sector: 'Finance' },
  { symbol: 'AMD',   name: 'AMD Inc',          sector: 'Tech'    },
];

const CRYPTOS = [
  { symbol: 'BTC', name: 'Bitcoin',  bnSym: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', bnSym: 'ETHUSDT' },
  { symbol: 'SOL', name: 'Solana',   bnSym: 'SOLUSDT' },
  { symbol: 'XRP', name: 'Ripple',   bnSym: 'XRPUSDT' },
];

function fmtPrice(n) {
  if (!n && n !== 0) return '—';
  if (n >= 10000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 1 ? n.toFixed(2) : n.toFixed(4);
}
function fmtChange(pct) { return `${pct >= 0 ? '+' : ''}${(pct || 0).toFixed(2)}%`; }
function fmt(n) {
  if (!n) return '—';
  if (n >= 1e9) return `${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

const GROQ_KEY = Deno.env.get('GROQ_API_KEY');

async function invokeLLM(base44, prompt, schema) {
  try {
    return await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
  } catch (_) {}
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt + '\n\nRespond with a valid JSON object.' }], response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 1024 }),
  });
  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  return JSON.parse((await res.json()).choices[0].message.content);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all prices in parallel (Finnhub stocks + Binance crypto)
    const [stockData, cryptoData] = await Promise.all([
      Promise.all(STOCKS.map(async s => {
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${s.symbol}&token=${FINNHUB_KEY}`);
        const d   = res.ok ? await res.json() : null;
        return { ...s, category: 'stock', price: d?.c || 0, pct: d?.dp || 0, volume: 0 };
      })),
      Promise.all(CRYPTOS.map(async c => {
        // Use Finnhub for crypto (Binance geo-blocks cloud servers)
        const sym = c.symbol;
        const [res1, res2] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/quote?symbol=BINANCE:${c.bnSym}&token=${FINNHUB_KEY}`).then(r => r.json()),
          fetch(`https://finnhub.io/api/v1/quote?symbol=COINBASE:${sym}USD&token=${FINNHUB_KEY}`).then(r => r.json()),
        ]);
        const d = res1?.c ? res1 : res2;
        return { ...c, category: 'crypto', sector: 'Crypto',
          price:  d?.c   || 0,
          pct:    d?.dp  || 0,
          volume: 0,
        };
      })),
    ]);

    const all = [...stockData, ...cryptoData];

    // AI signal: real price moves → momentum signals (compact, token-efficient)
    const priceFeed = all.map(a => ({ s: a.symbol, pct: +a.pct.toFixed(2), sector: a.sector || a.category }));

    const aiResult = await invokeLLM(base44, `Real market % changes today: ${JSON.stringify(priceFeed)}
Assign signal(Strong Buy/Buy/Hold/Caution/Sell) and aiScore(0-100) per asset.
Rules: momentum >+3% leans Buy/Strong Buy; <-3% leans Caution/Sell; crypto more volatile; sector context matters.
Return {signals:[{s,signal,aiScore}]}`, {
        type: 'object',
        properties: {
          signals: { type: 'array', items: { type: 'object', properties: { s:{type:'string'}, signal:{type:'string'}, aiScore:{type:'number'} } } }
        }
      });

    const sigMap = {};
    (aiResult.signals || []).forEach(s => { sigMap[s.s] = s; });

    const result = all.map(a => {
      const sig = sigMap[a.symbol] || { signal: 'Hold', aiScore: 50 };
      return {
        symbol: a.symbol, name: a.name,
        price: fmtPrice(a.price), change: fmtChange(a.pct), positive: a.pct >= 0,
        category: a.category, sector: a.sector || 'Crypto',
        volume: a.volume ? fmt(a.volume) : '—',
        signal: sig.signal, aiScore: sig.aiScore,
      };
    });

    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'hotboard' });
    const payload  = { cache_key: 'hotboard', data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: result.length, refreshed_at: payload.refreshed_at });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});