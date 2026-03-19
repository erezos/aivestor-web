/**
 * getAssetNews — Alpaca news API + AI narrative + per-article sentiment
 * Alpaca provides direct article URLs and real publisher source names.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ALPACA_KEY  = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC  = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR  = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const CACHE_TTL   = 60 * 60000; // 1 hour

function domainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol } = await req.json();
    if (!symbol) return Response.json({ error: 'symbol required' }, { status: 400 });

    const cleanSym = symbol.replace(/-USD$/i, '').toUpperCase();
    const cacheKey = `news_${cleanSym}`;

    // Check cache
    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0] || null;
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < CACHE_TTL) {
      return Response.json(JSON.parse(cached.data));
    }

    // Fetch news from Alpaca
    const newsUrl = `https://data.alpaca.markets/v1beta1/news?symbols=${cleanSym}&limit=8&sort=desc`;
    const newsRes = await fetch(newsUrl, { headers: ALPACA_HDR });
    const newsJson = newsRes.ok ? await newsRes.json() : null;
    const articles = newsJson?.news || [];

    if (articles.length === 0) {
      return Response.json({ narrative: null, articles: [] });
    }

    const top = articles.slice(0, 6);
    const headlines = top.map((a, i) => `${i}: ${a.headline?.slice(0, 100)}`).join('\n');

    // AI narrative + sentiment in parallel with nothing else (Alpaca gives direct URLs)
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze these recent ${cleanSym} news headlines.
${headlines}

Return:
1. narrative: 2-sentence "What's driving ${cleanSym} right now" summary for investors.
2. articles: [{idx, sentiment ("Bullish"/"Bearish"/"Neutral"), impact (1-3)}] for each headline.`,
      response_json_schema: {
        type: 'object',
        properties: {
          narrative: { type: 'string' },
          articles: {
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

    const sentimentMap = {};
    (aiResult.articles || []).forEach(a => { sentimentMap[a.idx] = a; });

    const result = {
      narrative: aiResult.narrative || null,
      articles: top.map((a, i) => {
        const url    = a.url || '';
        const source = a.source || domainFromUrl(url) || 'Unknown';
        return {
          id:        a.id,
          headline:  a.headline?.slice(0, 120),
          source,
          url,
          image:     a.images?.[0]?.url || null,
          datetime:  Math.floor(new Date(a.created_at).getTime() / 1000),
          sentiment: sentimentMap[i]?.sentiment || 'Neutral',
          impact:    sentimentMap[i]?.impact    || 1,
        };
      }),
    };

    // Persist cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});