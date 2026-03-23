/**
 * chartAiMagic — AI technical analysis for the chart view.
 * Cache: 2 hours per symbol (keyed by symbol only — range doesn't affect the signal).
 * Without cache: 1 credit per chart open. With cache: ~1 credit per symbol per 2 hrs total.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol, recent, currentPrice, sma20, rsi } = await req.json();

    const cacheKey = `chart_ai_${symbol.toUpperCase()}`;

    // Check cache
    const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: cacheKey });
    const cached = rows[0] || null;
    if (cached && (Date.now() - new Date(cached.refreshed_at).getTime()) < CACHE_TTL) {
      return Response.json(JSON.parse(cached.data));
    }

    // Cache miss — call LLM
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Professional technical analyst. Last 30 closes for ${symbol}: ${JSON.stringify(recent)}. Current: ${currentPrice}, SMA20: ${sma20}, RSI(14): ${rsi}. Provide: summary (2 sentences), signal (Strong Buy/Buy/Hold/Sell/Strong Sell), enableIndicators (array from ["sma20","sma50","rsi"]), markers (up to 3: [{time: unix_ts from provided data, position: "belowBar"|"aboveBar", color: "#hex", shape: "arrowUp"|"arrowDown", text: "label"}]), supportLevel (number or null), resistanceLevel (number or null).`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary:          { type: 'string' },
          signal:           { type: 'string' },
          enableIndicators: { type: 'array', items: { type: 'string' } },
          markers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time:     { type: 'number' },
                position: { type: 'string' },
                color:    { type: 'string' },
                shape:    { type: 'string' },
                text:     { type: 'string' },
              }
            }
          },
          supportLevel:    { type: 'number' },
          resistanceLevel: { type: 'number' },
        }
      }
    });

    // Persist cache
    const payload = { cache_key: cacheKey, data: JSON.stringify(result), refreshed_at: new Date().toISOString() };
    if (cached) base44.asServiceRole.entities.CachedData.update(cached.id, payload).catch(() => {});
    else        base44.asServiceRole.entities.CachedData.create(payload).catch(() => {});

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});