import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; AIVestor/1.0)' };
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

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
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const yahooSym = ['BTC','ETH','SOL','XRP'].includes(symbol) ? `${symbol}-USD` : symbol;
    const cacheKey = `asset_${symbol}`;

    // Check server-side cache (30 min TTL)
    const cached = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cacheEntry = cached[0];
    const cacheAge = cacheEntry ? Date.now() - new Date(cacheEntry.refreshed_at).getTime() : Infinity;

    // Fetch live price always (fast, no AI)
    const priceRes = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${yahooSym}`,
      { headers: HEADERS }
    );
    const priceJson = await priceRes.json();
    const q = priceJson?.quoteResponse?.result?.[0] || null;

    if (cacheAge < CACHE_TTL_MS && cacheEntry) {
      // Return cached AI analysis + fresh live price
      const cachedData = JSON.parse(cacheEntry.data);
      return Response.json({
        ...cachedData,
        price: q?.regularMarketPrice ?? cachedData.price ?? 0,
        change: q?.regularMarketChangePercent ?? cachedData.change ?? 0,
      });
    }

    // Cache miss or expired — run AI analysis + price in parallel
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Technical analysis for ${symbol} as of ${new Date().toDateString()}. Provide: overall signal (Strong Buy/Buy/Hold/Sell/Strong Sell), confidence% (0-100), 2-sentence summary, 6 indicator readings for RSI(14), MACD, Bollinger Bands, SMA 50/200, Volume Trend, Stochastic — each with value string and signal.`,
      response_json_schema: {
        type: 'object',
        properties: {
          aiSignal:     { type: 'string' },
          aiConfidence: { type: 'number' },
          aiSummary:    { type: 'string' },
          indicators: {
            type: 'array',
            items: { type: 'object', properties: { name: {type:'string'}, value: {type:'string'}, signal: {type:'string'} } }
          }
        }
      }
    });

    const analysisData = {
      name:         q?.shortName || q?.longName || symbol,
      sector:       q?.sector || (yahooSym.includes('-USD') ? 'Crypto' : 'Equity'),
      marketCap:    q?.marketCap ? fmt(q.marketCap) : '—',
      pe:           q?.trailingPE ? q.trailingPE.toFixed(1) : '—',
      volume:       q?.regularMarketVolume ? fmt(q.regularMarketVolume) : '—',
      high52:       q?.fiftyTwoWeekHigh ?? null,
      low52:        q?.fiftyTwoWeekLow ?? null,
      aiSignal:     aiResult.aiSignal,
      aiConfidence: aiResult.aiConfidence,
      aiSummary:    aiResult.aiSummary,
      indicators:   aiResult.indicators || [],
    };

    // Store in cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(analysisData), refreshed_at: new Date().toISOString() };
    if (cacheEntry) {
      await base44.asServiceRole.entities.CachedData.update(cacheEntry.id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({
      ...analysisData,
      price: q?.regularMarketPrice ?? 0,
      change: q?.regularMarketChangePercent ?? 0,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});