import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const HOT_SYMBOLS = ['NVDA','TSLA','AAPL','META','MSFT','AMZN','GOOGL','JPM','GS','AMD','BTC-USD','ETH-USD','SOL-USD','XRP-USD'];
const HOT_META = {
  'NVDA':    { name: 'NVIDIA Corp',    category: 'stock',  sector: 'Tech',    d: 'NVDA' },
  'TSLA':    { name: 'Tesla Inc',      category: 'stock',  sector: 'Auto',    d: 'TSLA' },
  'AAPL':    { name: 'Apple Inc',      category: 'stock',  sector: 'Tech',    d: 'AAPL' },
  'META':    { name: 'Meta Platforms', category: 'stock',  sector: 'Tech',    d: 'META' },
  'MSFT':    { name: 'Microsoft Corp', category: 'stock',  sector: 'Tech',    d: 'MSFT' },
  'AMZN':    { name: 'Amazon.com',     category: 'stock',  sector: 'Tech',    d: 'AMZN' },
  'GOOGL':   { name: 'Alphabet Inc',   category: 'stock',  sector: 'Tech',    d: 'GOOGL' },
  'JPM':     { name: 'JPMorgan Chase', category: 'stock',  sector: 'Finance', d: 'JPM' },
  'GS':      { name: 'Goldman Sachs',  category: 'stock',  sector: 'Finance', d: 'GS' },
  'AMD':     { name: 'AMD Inc',        category: 'stock',  sector: 'Tech',    d: 'AMD' },
  'BTC-USD': { name: 'Bitcoin',        category: 'crypto', sector: 'Crypto',  d: 'BTC' },
  'ETH-USD': { name: 'Ethereum',       category: 'crypto', sector: 'Crypto',  d: 'ETH' },
  'SOL-USD': { name: 'Solana',         category: 'crypto', sector: 'Crypto',  d: 'SOL' },
  'XRP-USD': { name: 'Ripple',         category: 'crypto', sector: 'Crypto',  d: 'XRP' },
};

function fmtPrice(n) {
  if (!n && n !== 0) return '0.00';
  return n >= 1000 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(2);
}
function fmtChange(pct) {
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch live prices server-side (no CORS proxy needed)
    const joined = HOT_SYMBOLS.join(',');
    const priceRes = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${joined}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIVestor/1.0)' } }
    );
    const priceJson = await priceRes.json();
    const quotes = priceJson?.quoteResponse?.result || [];

    // Minimal AI prompt — just % changes → signals (no internet needed)
    const priceData = HOT_SYMBOLS.map(sym => {
      const q = quotes.find(r => r.symbol === sym);
      return { s: HOT_META[sym].d, pct: +(q?.regularMarketChangePercent?.toFixed(2) ?? 0) };
    });

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Assets with daily % changes: ${JSON.stringify(priceData)}. For each, assign: signal (Strong Buy/Buy/Hold/Sell/Strong Sell) and aiScore (0-100) based on momentum. Return: {signals:[{s,signal,aiScore}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          signals: {
            type: 'array',
            items: { type: 'object', properties: { s: {type:'string'}, signal: {type:'string'}, aiScore: {type:'number'} } }
          }
        }
      }
    });

    const signalMap = {};
    (aiResult.signals || []).forEach(s => { signalMap[s.s] = s; });

    const result = HOT_SYMBOLS.map(sym => {
      const q = quotes.find(r => r.symbol === sym);
      const meta = HOT_META[sym];
      const pct = q?.regularMarketChangePercent ?? 0;
      const sig = signalMap[meta.d] || { signal: 'Hold', aiScore: 50 };
      return {
        symbol: meta.d, name: meta.name,
        price: q ? fmtPrice(q.regularMarketPrice) : '—',
        change: fmtChange(pct), positive: pct >= 0,
        category: meta.category, sector: meta.sector,
        volume: q?.regularMarketVolume ? fmt(q.regularMarketVolume) : '—',
        signal: sig.signal, aiScore: sig.aiScore,
      };
    });

    // Upsert cache
    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'hotboard' });
    const payload = { cache_key: 'hotboard', data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: result.length, refreshed_at: payload.refreshed_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});