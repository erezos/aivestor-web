// Earnings AI enrichment worker — runs every 5 min
// OPTIMIZED:
//   - Skips dates already enriched (checks enriched_dates in meta)
//   - Feeds EPS beat/miss history to LLM for much better quality forecasts
//   - Compresses output to minimize storage
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const NOTABLE = new Set([
  'AAPL','NVDA','MSFT','TSLA','META','AMZN','GOOGL','NFLX','AMD','INTC',
  'JPM','GS','MS','BAC','WMT','COST','UBER','SNAP','PYPL','SQ','COIN',
  'PLTR','V','MA','BABA','SHOP','CRM','ORCL','ADBE','QCOM','MU','ARM',
  'DIS','SBUX','NKE','PFE','JNJ','UNH','CVX','XOM','T','VZ',
  'IBM','CSCO','HON','CAT','BA','GE','F','GM','RIVN','HOOD','RBLX','LYFT',
]);

async function upsert(base44, key, data) {
  const payload = { cache_key: key, data: JSON.stringify(data), refreshed_at: new Date().toISOString() };
  const existing = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.CachedData.update(existing[0].id, payload);
  } else {
    await base44.asServiceRole.entities.CachedData.create(payload);
  }
}

// Load EPS history from cache (pre-fetched by refreshEarnings)
async function getEpsHistory(base44, symbol) {
  const rows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: `eps_history_${symbol}` });
  if (rows.length > 0 && rows[0].data) return JSON.parse(rows[0].data);
  return null;
}

// Summarize EPS history into a short context string for the LLM
function summarizeHistory(history) {
  if (!history || history.length === 0) return null;
  const withData = history.filter(h => h.actual != null && h.estimate != null);
  if (withData.length === 0) return null;
  const beats = withData.filter(h => h.actual > h.estimate).length;
  const avgSurprise = withData.reduce((s, h) => s + (h.surprisePct || 0), 0) / withData.length;
  const last = withData[0];
  return `Beat ${beats}/${withData.length} recent quarters, avg surprise +${avgSurprise.toFixed(1)}%, last surprise ${last.surprisePct > 0 ? '+' : ''}${last.surprisePct}%`;
}

async function aiEnrichBatch(base44, companies, historyMap) {
  const compact = companies.map(e => {
    const hist = historyMap[e.s];
    return {
      sym:     e.s,
      epsEst:  e.ep ?? null,
      notable: e.n === 1,
      history: hist || null,
    };
  });

  try {
    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a financial analyst. For these upcoming earnings reports, forecast volatility and sentiment.
Use the EPS beat/miss history context to inform your analysis — a strong beat streak + high avg surprise = higher volatility and bullish bias.
Companies with no history should default to Medium/neutral.
Keep volatilityReason to 8 words max.

Companies: ${JSON.stringify(compact)}

Return JSON: {"analysis":[{"sym":"...","volatilityForecast":"Low|Medium|High","volatilityReason":"...","sentimentBias":"bullish|bearish|neutral"}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          analysis: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sym:                { type: 'string' },
                volatilityForecast: { type: 'string' },
                volatilityReason:   { type: 'string' },
                sentimentBias:      { type: 'string' },
              },
              required: ['sym', 'volatilityForecast', 'volatilityReason', 'sentimentBias'],
            }
          }
        }
      }
    });
    const map = {};
    (aiResult?.analysis || []).forEach(a => { map[a.sym] = a; });
    return map;
  } catch (_) {
    return {};
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const metaRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: 'earnings_meta' });
    if (!metaRows.length) {
      return Response.json({ skipped: true, reason: 'No earnings_meta found. Run refreshEarnings first.' });
    }

    const meta = JSON.parse(metaRows[0].data);

    if (meta.completed) {
      return Response.json({ skipped: true, reason: 'All dates already enriched.' });
    }

    const { dates, cursor, enriched_dates = [] } = meta;
    const enrichedSet = new Set(enriched_dates);

    // Find next unenriched date
    let dateToProcess = null;
    let newCursor = cursor;
    for (let i = cursor; i < dates.length; i++) {
      if (!enrichedSet.has(dates[i])) {
        dateToProcess = dates[i];
        newCursor = i;
        break;
      }
    }

    if (!dateToProcess) {
      meta.completed = true;
      await upsert(base44, 'earnings_meta', meta);
      return Response.json({ done: true, total_dates: dates.length });
    }

    // Load raw companies for this date
    const rawRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: `earnings_raw_${dateToProcess}` });
    if (!rawRows.length) {
      meta.cursor = newCursor + 1;
      meta.enriched_dates = [...enriched_dates, dateToProcess];
      await upsert(base44, 'earnings_meta', meta);
      return Response.json({ skipped_date: dateToProcess });
    }

    const companies = JSON.parse(rawRows[0].data);

    // Load EPS history for notable companies in this batch (already cached by refreshEarnings)
    const historyMap = {};
    for (const e of companies) {
      if (e.n === 1) { // only notable — others don't have history cached
        const hist = await getEpsHistory(base44, e.s);
        historyMap[e.s] = hist ? summarizeHistory(hist) : null;
      }
    }

    // Process in batches of 25 (smaller = better LLM context per company)
    let aiMap = {};
    const BATCH = 25;
    for (let i = 0; i < companies.length; i += BATCH) {
      const batch = companies.slice(i, i + BATCH);
      const batchMap = await aiEnrichBatch(base44, batch, historyMap);
      Object.assign(aiMap, batchMap);
    }

    const VF_MAP = { High: 'H', Medium: 'M', Low: 'L' };
    const SB_MAP = { bullish: 'b', bearish: 'e', neutral: 'n' };

    const enriched = companies.map(e => {
      const ai = aiMap[e.s] || { volatilityForecast: 'Medium', volatilityReason: 'Earnings report due', sentimentBias: 'neutral' };
      return {
        s:  e.s,
        t:  e.t,
        ep: e.ep,
        re: e.re,
        ea: e.ea ?? null,   // actual EPS (if already reported)
        ra: e.ra ?? null,   // actual revenue (if already reported)
        n:  NOTABLE.has(e.s) ? 1 : 0,
        vf: VF_MAP[ai.volatilityForecast] || 'M',
        vr: (ai.volatilityReason || '').slice(0, 40),
        sb: SB_MAP[ai.sentimentBias] || 'n',
      };
    });

    await upsert(base44, `earnings_${dateToProcess}`, enriched);

    meta.cursor = newCursor + 1;
    meta.enriched_dates = [...enriched_dates, dateToProcess];
    if (meta.enriched_dates.length >= dates.length) meta.completed = true;
    await upsert(base44, 'earnings_meta', meta);

    return Response.json({
      processed_date: dateToProcess,
      companies: enriched.length,
      notable_with_history: Object.values(historyMap).filter(Boolean).length,
      cursor: meta.cursor,
      remaining: dates.length - meta.cursor,
      completed: meta.completed,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});