// Earnings calendar: real Finnhub data + AI volatility forecasts
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

// Notable companies get AI enrichment; others get defaults
const NOTABLE = new Set([
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','NFLX','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','MMM','CAT','BA','GE','F','GM','RIVN','LCID',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today    = new Date().toISOString().slice(0, 10);
    const in4weeks = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);

    // Real earnings calendar from Finnhub — ALL companies, no filter
    const res  = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${in4weeks}&token=${FINNHUB_KEY}`);
    const json = res.ok ? await res.json() : null;
    const calendar = json?.earningsCalendar || [];

    // Take all companies with a date, sort by date, cap at 100
    const filtered = calendar
      .filter(e => e.symbol && e.date)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 100);

    if (!filtered.length) {
      return Response.json({ success: true, count: 0, note: 'No earnings in next 6 weeks' });
    }

    // Only AI-enrich the notable companies (keeps cost/latency reasonable)
    const notableFiltered = filtered.filter(e => NOTABLE.has(e.symbol));
    const compact = notableFiltered.map(e => ({
      sym:    e.symbol,
      date:   e.date,
      hour:   e.hour,
      epsEst: e.epsEstimate ?? null,
      revEst: e.revenueEstimate ? `${(e.revenueEstimate / 1e9).toFixed(1)}B` : null,
    }));

    let aiMap = {};
    if (compact.length > 0) {
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Upcoming earnings: ${JSON.stringify(compact)}
For each symbol, provide: volatilityForecast(Low/Medium/High), volatilityReason(max 8 words), sentimentBias(bullish/bearish/neutral).
Base on: company size, sector, recent trends, EPS trend.
Return {analysis:[{sym,volatilityForecast,volatilityReason,sentimentBias}]}`,
        response_json_schema: {
          type: 'object',
          properties: {
            analysis: { type: 'array', items: { type: 'object', properties: { sym:{type:'string'}, volatilityForecast:{type:'string'}, volatilityReason:{type:'string'}, sentimentBias:{type:'string'} } } }
          }
        }
      });
      (aiResult.analysis || []).forEach(a => { aiMap[a.sym] = a; });
    }

    const earnings = filtered.map(e => {
      const ai = aiMap[e.symbol] || { volatilityForecast: 'Medium', volatilityReason: 'Earnings report due', sentimentBias: 'neutral' };
      return {
        symbol:             e.symbol,
        companyName:        e.symbol,
        reportDate:         e.date,
        reportTime:         e.hour === 'bmo' ? 'BMO' : e.hour === 'amc' ? 'AMC' : 'DMH',
        epsEstimate:        e.epsEstimate    ?? null,
        revenueEstimate:    e.revenueEstimate ? `${(e.revenueEstimate/1e9).toFixed(1)}B` : '—',
        epsActual:          e.epsActual      ?? null,
        revenueActual:      e.revenueActual  ?? null,
        isNotable:          NOTABLE.has(e.symbol),
        volatilityForecast: ai.volatilityForecast,
        volatilityReason:   ai.volatilityReason,
        sentimentBias:      ai.sentimentBias,
      };
    });

    const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'earnings' });
    const payload  = { cache_key: 'earnings', data: JSON.stringify(earnings), refreshed_at: new Date().toISOString() };
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