// Earnings calendar: real Finnhub data + AI volatility forecasts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

// Notable companies get AI enrichment; others get defaults
const NOTABLE = new Set([
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today   = new Date().toISOString().slice(0, 10);
    const in6weeks = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);

    // Real earnings calendar from Finnhub
    const res = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${in6weeks}&token=${FINNHUB_KEY}`);
    const json = res.ok ? await res.json() : null;
    const calendar = json?.earningsCalendar || [];

    // Only keep notable companies — keeps payload small and these are what users care about
    // Include any company with an EPS estimate (analyst-covered = meaningful)
    const filtered = calendar
      .filter(e => e.symbol && e.date && (NOTABLE.has(e.symbol) || e.epsEstimate != null))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 40);

    if (!filtered.length) {
      return Response.json({ success: true, count: 0, note: 'No earnings in next 6 weeks' });
    }

    // AI-enrich notable companies in small batches of 8 to avoid timeouts / invalid JSON
    const notableFiltered = filtered.filter(e => NOTABLE.has(e.symbol));
    let aiMap = {};

    for (let i = 0; i < notableFiltered.length; i += 8) {
      const batch = notableFiltered.slice(i, i + 8);
      const compact = batch.map(e => ({
        sym:    e.symbol,
        date:   e.date,
        epsEst: e.epsEstimate ?? null,
      }));

      try {
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `For these upcoming earnings reports: ${JSON.stringify(compact)}
Return JSON with volatilityForecast (Low/Medium/High), volatilityReason (max 6 words), sentimentBias (bullish/bearish/neutral) for each.
Respond only with: {"analysis":[{"sym":"...","volatilityForecast":"...","volatilityReason":"...","sentimentBias":"..."}]}`,
          response_json_schema: {
            type: 'object',
            properties: {
              analysis: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    sym:               { type: 'string' },
                    volatilityForecast:{ type: 'string' },
                    volatilityReason:  { type: 'string' },
                    sentimentBias:     { type: 'string' },
                  },
                  required: ['sym','volatilityForecast','volatilityReason','sentimentBias'],
                }
              }
            }
          }
        });
        (aiResult?.analysis || []).forEach(a => { aiMap[a.sym] = a; });
      } catch (_) {
        // If a batch fails, continue with defaults for those symbols
      }
    }

    const earnings = filtered.map(e => {
      const ai = aiMap[e.symbol] || { volatilityForecast: 'Medium', volatilityReason: 'Earnings report due', sentimentBias: 'neutral' };
      return {
        s:  e.symbol,
        d:  e.date,
        t:  e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : 'DMH',
        ep: e.epsEstimate ?? null,
        re: e.revenueEstimate ? `${(e.revenueEstimate/1e9).toFixed(1)}B` : null,
        n:  NOTABLE.has(e.symbol) ? 1 : 0,
        vf: ai.volatilityForecast,
        vr: ai.volatilityReason,
        sb: ai.sentimentBias,
      };
    });

    const payload = { cache_key: 'earnings', data: JSON.stringify(earnings), refreshed_at: new Date().toISOString() };
    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'earnings' });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.CachedData.create(payload);
    }

    return Response.json({ success: true, count: earnings.length, refreshed_at: payload.refreshed_at });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});