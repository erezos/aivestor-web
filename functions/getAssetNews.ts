/**
 * getAssetNews — Finnhub company news + AI narrative + per-article sentiment
 * Source fix: resolve Finnhub redirect URLs to get real publisher domain.
 * Perf: redirect resolution runs IN PARALLEL with the AI call to stay within time limits.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CACHE_TTL   = 60 * 60000; // 1 hour

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

/** Follow one redirect with a tight timeout — returns final URL or original on failure */
async function resolveRedirect(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(timer);
    return res.url || url;
  } catch {
    return url;
  }
}

function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
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

    const top = articles.slice(0, 8);
    const headlines = top.map((a, i) => `${i}: ${a.headline?.slice(0, 100)}`).join('\n');

    // ── Run redirect resolution + AI call IN PARALLEL ──────────────────────
    const [resolvedUrls, aiResult] = await Promise.all([
      Promise.all(top.map(a => resolveRedirect(a.url))),
      base44.asServiceRole.integrations.Core.InvokeLLM({
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
      }),
    ]);

    const sentimentMap = {};
    (aiResult.articles || []).forEach(a => { sentimentMap[a.idx] = a; });

    const result = {
      narrative: aiResult.narrative || null,
      articles: top.map((a, i) => {
        const realUrl = resolvedUrls[i] || a.url;
        const domain  = domainFromUrl(realUrl);
        // Only use domain if it's not finnhub itself (redirect failed or unresolved)
        const source  = (domain && !domain.includes('finnhub')) ? domain : a.source;
        return {
          id:        a.id,
          headline:  a.headline?.slice(0, 120),
          source,
          url:       realUrl,
          image:     a.image || null,
          datetime:  a.datetime,
          sentiment: sentimentMap[i]?.sentiment || 'Neutral',
          impact:    sentimentMap[i]?.impact    || 1,
        };
      }),
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