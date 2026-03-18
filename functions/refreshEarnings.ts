import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Today is ${new Date().toDateString()}. List 14 most important upcoming US stock earnings reports in the next 3 weeks. For each: symbol, companyName, reportDate (YYYY-MM-DD), reportTime (BMO=before market open or AMC=after market close), epsEstimate (number USD), revenueEstimate (string e.g. "12.4B"), sector, volatilityForecast (Low/Medium/High), volatilityReason (8 words max), sentimentBias (bullish/bearish/neutral). Sort by reportDate ascending. Focus on: AAPL, NVDA, MSFT, TSLA, META, AMZN, GOOGL, AMD, NFLX, JPM, GS, etc.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          earnings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                symbol:             { type: 'string' },
                companyName:        { type: 'string' },
                reportDate:         { type: 'string' },
                reportTime:         { type: 'string' },
                epsEstimate:        { type: 'number' },
                revenueEstimate:    { type: 'string' },
                sector:             { type: 'string' },
                volatilityForecast: { type: 'string' },
                volatilityReason:   { type: 'string' },
                sentimentBias:      { type: 'string' },
              }
            }
          }
        }
      }
    });

    const earnings = result.earnings || [];
    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'earnings' });
    const payload = { cache_key: 'earnings', data: JSON.stringify(earnings), refreshed_at: new Date().toISOString() };
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: earnings.length, refreshed_at: payload.refreshed_at });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});