/**
 * getAssetNews — Finnhub company news + AI narrative + per-article sentiment
 * Token strategy: ONE AI call per symbol, only headlines sent (no article bodies)
 * Cache: 1 hour per symbol — AI cost is ~100 tokens per call, very cheap
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CACHE_TTL   = 60 * 60000; // 1 hour

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const cacheKey = `news_${cleanSym}`;

    // Check cache first
    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0] || null;
    const cacheAge = cached ? Date.now() - new Date(cached.refreshed_at).getTime() : Infinity;

    if (cached && cacheAge < CACHE_TTL) {
      return Response.json(JSON.parse(cached.data));
    }

    // Fetch last 7 days of news
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const articles = await fhGet(`/company-news?symbol=${cleanSym}&from=${from}&to=${to}`);

    if (!articles || articles.length === 0) {
      return Response.json({ narrative: null, articles: [] });
    }

    // Take top 8 most recent articles
    const top = articles.slice(0, 8).map(a => ({
      id:       a.id,
      headline: a.headline?.slice(0, 120),
      source:   a.source,
      url:      a.url,
      image:    a.image || null,
      datetime: a.datetime,
    }));

    // ONE batched AI call — send only headlines, get back narrative + sentiments
    // Very token-efficient: ~150 tokens input, ~200 tokens output
    const headlines = top.map((a, i) => `${i}: ${a.headline}`).join('\n');

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze these recent ${cleanSym} news headlines and return insights.
Headlines:
${headlines}

Return:
1. narrative: A 2-sentence "What's driving ${cleanSym} right now" market intelligence summary for investors.
2. articles: Array of {idx, sentiment ("Bullish"/"Bearish"/"Neutral"), impact (1-3, how likely to move price)} for each headline index.

Be precise and grounded. No fluff.`,
      response_json_schema: {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          articles:  {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                idx:       { type: 'number' },
                sentiment: { type: 'string' },
                impact:    { type: 'number' },
              }
            }
          }
        }
      }
    });

    // Merge AI results back into articles
    const sentimentMap = {};
    (aiResult.articles || []).forEach(a => { sentimentMap[a.idx] = a; });

    const enriched = top.map((a, i) => ({
      ...a,
      sentiment: sentimentMap[i]?.sentiment || 'Neutral',
      impact:    sentimentMap[i]?.impact    || 1,
    }));

    const result = {
      narrative: aiResult.narrative || null,
      articles:  enriched,
    };

    // Persist to cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});