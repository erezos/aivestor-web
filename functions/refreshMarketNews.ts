import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `8 most important financial market news stories today (${new Date().toDateString()}). Cover stocks, crypto, economy, tech. Each: title, 1-sentence summary, source name, time (e.g. "2h ago"), category (Stocks/Crypto/Economy/Tech/Commodities), sentiment (bullish/bearish/neutral).`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          articles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title:     { type: 'string' },
                summary:   { type: 'string' },
                source:    { type: 'string' },
                time:      { type: 'string' },
                category:  { type: 'string' },
                sentiment: { type: 'string' },
              }
            }
          }
        }
      }
    });

    const articles = result.articles || [];
    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'news' });
    const payload = { cache_key: 'news', data: JSON.stringify(articles), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: articles.length, refreshed_at: payload.refreshed_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});