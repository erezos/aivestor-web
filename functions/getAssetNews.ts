/**
 * getAssetNews — Alpaca news API with keyword-based sentiment (no AI timeout risk).
 * Alpaca provides direct publisher URLs and real source names.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const ALPACA_KEY = Deno.env.get('ALPACA_API_KEY');
const ALPACA_SEC = Deno.env.get('ALPACA_API_SECRET');
const ALPACA_HDR = { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SEC };
const CACHE_TTL  = 60 * 60000; // 1 hour

const BULLISH_WORDS = /surge|jump|soar|rally|gain|beat|record|growth|rise|profit|boost|strong|upgrade|buy|bullish|positive|upbeat/i;
const BEARISH_WORDS = /fall|drop|plunge|decline|miss|loss|risk|warn|downgrade|sell|bearish|concern|weak|tumble|cut|lawsuit|probe/i;

function sentiment(text) {
  const bull = (text.match(BULLISH_WORDS) || []).length;
  const bear = (text.match(BEARISH_WORDS) || []).length;
  if (bull > bear) return { sentiment: 'Bullish', impact: bull >= 2 ? 3 : 2 };
  if (bear > bull) return { sentiment: 'Bearish', impact: bear >= 2 ? 3 : 2 };
  return { sentiment: 'Neutral', impact: 1 };
}

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

    // Fetch news from Alpaca with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    let articles = [];
    try {
      const newsUrl = `https://data.alpaca.markets/v1beta1/news?symbols=${cleanSym}&limit=8&sort=desc`;
      const newsRes = await fetch(newsUrl, { headers: ALPACA_HDR, signal: controller.signal });
      const newsJson = newsRes.ok ? await newsRes.json() : null;
      articles = newsJson?.news || [];
    } finally {
      clearTimeout(timer);
    }

    if (articles.length === 0) {
      return Response.json({ narrative: null, articles: [] });
    }

    const top = articles.slice(0, 6);

    // Build narrative from sentiment counts (no AI needed)
    const counts = { Bullish: 0, Bearish: 0, Neutral: 0 };
    const mapped = top.map(a => {
      const text = `${a.headline} ${a.summary || ''}`;
      const s = sentiment(text);
      counts[s.sentiment]++;
      return {
        id:        a.id,
        headline:  a.headline?.slice(0, 120),
        source:    a.source || domainFromUrl(a.url) || 'Unknown',
        url:       a.url || '',
        image:     a.images?.[0]?.url || null,
        datetime:  Math.floor(new Date(a.created_at).getTime() / 1000),
        sentiment: s.sentiment,
        impact:    s.impact,
      };
    });

    // Simple rule-based narrative
    const dominant = counts.Bullish > counts.Bearish ? 'Bullish' :
                     counts.Bearish > counts.Bullish ? 'Bearish' : 'Mixed';
    const narrativeMap = {
      Bullish: `Recent news around ${cleanSym} is predominantly positive, with headlines pointing to strength and momentum. Investor sentiment appears optimistic based on the latest coverage.`,
      Bearish: `Recent headlines around ${cleanSym} skew cautious, with several stories flagging risks or weakness. Investors may want to monitor developments closely.`,
      Mixed:   `News flow around ${cleanSym} is mixed, with both positive and negative headlines in circulation. The market appears to be weighing competing narratives.`,
    };

    const result = { narrative: narrativeMap[dominant], articles: mapped };

    // Persist cache (fire-and-forget)
    const payload = { cache_key: cacheKey, data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});