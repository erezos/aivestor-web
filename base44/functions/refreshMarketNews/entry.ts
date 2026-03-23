// Market news: real Finnhub articles + AI curation and sentiment
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch real news from Finnhub (general market category)
    const [generalRes, cryptoRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`),
      fetch(`https://finnhub.io/api/v1/news?category=crypto&token=${FINNHUB_KEY}`),
    ]);

    const general = generalRes.ok ? await generalRes.json() : [];
    const crypto  = cryptoRes.ok  ? await cryptoRes.json()  : [];

    // Merge, deduplicate, take latest 25
    const seen    = new Set();
    const merged  = [...(Array.isArray(general) ? general : []), ...(Array.isArray(crypto) ? crypto : [])]
      .filter(a => {
        if (!a.headline || seen.has(a.headline)) return false;
        seen.add(a.headline);
        return true;
      })
      .sort((a, b) => (b.datetime || 0) - (a.datetime || 0))
      .slice(0, 25);

    if (!merged.length) {
      return Response.json({ error: 'No articles from Finnhub' }, { status: 502 });
    }

    // Compact representation for AI (truncated to save tokens)
    const compact = merged.map((a, i) => ({
      i,
      h: a.headline.slice(0, 110),
      src: a.source,
      t: a.datetime,
      cat: a.category,
    }));

    // AI: select top 8 most market-moving + add sentiment + human-friendly time
    const nowSec = Math.floor(Date.now() / 1000);
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Financial news: ${JSON.stringify(compact)}
Select 8 most market-impactful stories. For each: i, concise 1-sentence summary(max 110 chars, specific + actionable), sentiment(bullish/bearish/neutral), time_ago from now(${nowSec} unix, e.g. "2h ago","30m ago").
Prefer high-impact macro, earnings, Fed, crypto, and tech stories.
Return {selected:[{i,summary,sentiment,time_ago}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          selected: { type: 'array', items: { type: 'object', properties: { i:{type:'number'}, summary:{type:'string'}, sentiment:{type:'string'}, time_ago:{type:'string'} } } }
        }
      }
    });

    const articles = (aiResult.selected || []).map(sel => {
      const orig = merged[sel.i];
      if (!orig) return null;
      return {
        title:     orig.headline,
        summary:   sel.summary,
        source:    orig.source,
        time:      sel.time_ago,
        category:  orig.category === 'crypto' ? 'Crypto' : 'General',
        sentiment: sel.sentiment,
        url:       orig.url  || null,
        image:     orig.image || null,
      };
    }).filter(Boolean);

    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'news' });
    const payload  = { cache_key: 'news', data: JSON.stringify(articles), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: articles.length, refreshed_at: payload.refreshed_at });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});