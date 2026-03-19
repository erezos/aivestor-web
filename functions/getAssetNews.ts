/**
 * getAssetNews — Finnhub company news + keyword sentiment (no AI, no redirect chase).
 * Source fix: map known syndication names to proper publisher labels.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CACHE_TTL   = 60 * 60000; // 1 hour

const SOURCE_MAP = {
  yahoo:          'Yahoo Finance',
  'yahoo finance':'Yahoo Finance',
  marketwatch:    'MarketWatch',
  reuters:        'Reuters',
  bloomberg:      'Bloomberg',
  cnbc:           'CNBC',
  benzinga:       'Benzinga',
  seekingalpha:   'Seeking Alpha',
  thestreet:      'TheStreet',
  barrons:        "Barron's",
  wsj:            'WSJ',
  ft:             'Financial Times',
};

function cleanSource(raw) {
  if (!raw) return 'Financial News';
  const key = raw.toLowerCase().trim();
  return SOURCE_MAP[key] || raw;
}

const BULLISH_WORDS = /surge|jump|soar|rally|gain|beat|record|growth|rise|profit|boost|strong|upgrade|buy|bullish|positive|upbeat/i;
const BEARISH_WORDS = /fall|drop|plunge|decline|miss|loss|risk|warn|downgrade|sell|bearish|concern|weak|tumble|cut|lawsuit|probe/i;

function getSentiment(text) {
  const bull = (text.match(BULLISH_WORDS) || []).length;
  const bear = (text.match(BEARISH_WORDS) || []).length;
  if (bull > bear) return { sentiment: 'Bullish', impact: bull >= 2 ? 3 : 2 };
  if (bear > bull) return { sentiment: 'Bearish', impact: bear >= 2 ? 3 : 2 };
  return { sentiment: 'Neutral', impact: 1 };
}

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

    // Check cache
    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0] || null;
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < CACHE_TTL) {
      return Response.json(JSON.parse(cached.data));
    }

    // Fetch last 7 days of news from Finnhub
    const to   = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const articles = await fhGet(`/company-news?symbol=${cleanSym}&from=${from}&to=${to}`);

    if (!articles || articles.length === 0) {
      return Response.json({ narrative: null, articles: [] });
    }

    const top = articles.slice(0, 6);

    // Keyword sentiment + source mapping — no AI needed
    const counts = { Bullish: 0, Bearish: 0, Neutral: 0 };
    const mapped = top.map(a => {
      const s = getSentiment(`${a.headline} ${a.summary || ''}`);
      counts[s.sentiment]++;
      return {
        id:        a.id,
        headline:  a.headline?.slice(0, 120),
        source:    cleanSource(a.source),
        url:       a.url || '',
        image:     a.image || null,
        datetime:  a.datetime,
        sentiment: s.sentiment,
        impact:    s.impact,
      };
    });

    const dominant = counts.Bullish > counts.Bearish ? 'Bullish'
                   : counts.Bearish > counts.Bullish ? 'Bearish' : 'Mixed';
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