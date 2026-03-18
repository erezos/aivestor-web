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

    // Run cache lookup + live price fetch in parallel
    const [cached, priceRes] = await Promise.all([
      base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey }),
      fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?range=2d&interval=1d`,
        { headers: HEADERS }
      ).then(r => r.json()),
    ]);

    const cacheEntry = cached[0];
    const cacheAge = cacheEntry ? Date.now() - new Date(cacheEntry.refreshed_at).getTime() : Infinity;

    const meta = priceRes?.chart?.result?.[0]?.meta || {};
    const livePrice = meta.regularMarketPrice ?? meta.previousClose ?? null;
    const liveChange = meta.regularMarketChangePercent ?? 0;

    // If cache is fresh or stale-but-exists, return immediately with live price
    if (cacheEntry) {
      const cachedData = JSON.parse(cacheEntry.data);
      const result = { ...cachedData, price: livePrice ?? cachedData.price ?? 0, change: liveChange };

      // If stale, trigger background AI refresh (fire and forget)
      if (cacheAge >= CACHE_TTL_MS) {
        refreshAiCache(base44, symbol, yahooSym, meta, cacheEntry);
      }

      return Response.json(result);
    }

    // Cold cache — must run AI synchronously
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
      name:         meta.shortName || meta.symbol || symbol,
      sector:       meta.sector || (yahooSym.includes('-USD') ? 'Crypto' : 'Equity'),
      marketCap:    meta.marketCap ? fmt(meta.marketCap) : '—',
      pe:           meta.trailingPE ? meta.trailingPE.toFixed(1) : '—',
      volume:       meta.regularMarketVolume ? fmt(meta.regularMarketVolume) : '—',
      high52:       meta.fiftyTwoWeekHigh ?? null,
      low52:        meta.fiftyTwoWeekLow ?? null,
      aiSignal:     aiResult.aiSignal,
      aiConfidence: aiResult.aiConfidence,
      aiSummary:    aiResult.aiSummary,
      indicators:   aiResult.indicators || [],
    };

    // Save to cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(analysisData), refreshed_at: new Date().toISOString() };
    base44.asServiceRole.entities.CachedData.create(payload);

    return Response.json({ ...analysisData, price: livePrice ?? 0, change: liveChange });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function refreshAiCache(base44, symbol, yahooSym, meta, cacheEntry) {
  try {
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
      name:         meta.shortName || meta.symbol || symbol,
      sector:       meta.sector || (yahooSym.includes('-USD') ? 'Crypto' : 'Equity'),
      marketCap:    meta.marketCap ? fmt(meta.marketCap) : '—',
      pe:           meta.trailingPE ? meta.trailingPE.toFixed(1) : '—',
      volume:       meta.regularMarketVolume ? fmt(meta.regularMarketVolume) : '—',
      high52:       meta.fiftyTwoWeekHigh ?? null,
      low52:        meta.fiftyTwoWeekLow ?? null,
      aiSignal:     aiResult.aiSignal,
      aiConfidence: aiResult.aiConfidence,
      aiSummary:    aiResult.aiSummary,
      indicators:   aiResult.indicators || [],
    };

    await base44.asServiceRole.entities.CachedData.update(cacheEntry.id, {
      cache_key: `asset_${symbol}`,
      data: JSON.stringify(analysisData),
      refreshed_at: new Date().toISOString(),
    });
  } catch (_) { /* background refresh — ignore errors */ }
}