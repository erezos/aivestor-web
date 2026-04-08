/**
 * askAiAnalyze — v2 Single-Input Report Engine.
 * Produces a fixed 8-section premium report. Idempotent by requestId.
 * Two-tier model routing: deep → claude_sonnet_4_6 (fallback: gpt_5)
 *                         standard/quick → gpt_5_mini (fallback: gpt_5_mini)
 * Token cost: quick=1, standard=2, deep=3
 * Feature flag: ASK_AI_SINGLE_INPUT_ENABLED (default true)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

// Feature flag — set env var ASK_AI_SINGLE_INPUT_ENABLED=false to disable
const FEATURE_ENABLED = Deno.env.get('ASK_AI_SINGLE_INPUT_ENABLED') !== 'false';

const TOKEN_COST = { quick: 1, standard: 2, deep: 3 };

// Model routing by depth
const MODEL_PRIMARY  = { deep: 'claude_sonnet_4_6', standard: 'gpt_5_mini', quick: 'gpt_5_mini' };
const MODEL_FALLBACK = { deep: 'gpt_5',             standard: 'gpt_5_mini', quick: 'gpt_5_mini' };

const DISCLAIMER = 'This report is for informational purposes only and does not constitute investment advice. Past performance does not guarantee future results. Always do your own research.';

const UNSAFE_WORDS = /\b(guaranteed|guarantee|risk-free|risk free|certain|certainty|will definitely|no risk|100% sure|cannot lose)\b/gi;

// ── Envelope helpers ──────────────────────────────────────────────────────────
function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId, asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'llm' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

// ── Safe Finnhub fetch ────────────────────────────────────────────────────────
async function fhGet(path) {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    const text = await res.text();
    try { return JSON.parse(text); } catch (_) { return null; }
  } catch (_) { return null; }
}

// ── Wallet helpers ────────────────────────────────────────────────────────────
async function getWallet(base44, userId) {
  const rows = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
  return rows[0] || null;
}

async function ensureWallet(base44, userId) {
  let w = await getWallet(base44, userId);
  if (!w) w = await base44.asServiceRole.entities.Wallet.create({ user_id: userId, free_balance: 0, paid_balance: 0, last_free_accrual_date: null, version: 1 });
  return w;
}

// ── Guardrails ────────────────────────────────────────────────────────────────
function sanitize(text) {
  if (!text) return text;
  return text.replace(UNSAFE_WORDS, (m) => `[not ${m.toLowerCase()}]`);
}

function clampConfidence(v) {
  const n = parseFloat(v);
  if (isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function normalizeStance(s) {
  if (!s) return 'neutral';
  const lower = s.toLowerCase();
  if (lower.includes('bull')) return 'bullish';
  if (lower.includes('bear')) return 'bearish';
  return 'neutral';
}

// ── Section scaffold (always 8 sections) ─────────────────────────────────────
const SECTION_DEFS = [
  { id: 'market_snapshot',      title: 'Market Snapshot'       },
  { id: 'ai_conclusion',        title: 'AI Conclusion'         },
  { id: 'technical_view',       title: 'Technical View'        },
  { id: 'sentiment_news_pulse', title: 'Sentiment & News Pulse'},
  { id: 'scenario_paths',       title: 'Scenario Paths'        },
  { id: 'risks_invalidations',  title: 'Risks & Invalidations' },
  { id: 'action_playbook',      title: 'Action Playbook'       },
  { id: 'disclaimer',           title: 'Disclaimer'            },
];

function buildSections(raw, asset) {
  return SECTION_DEFS.map(def => {
    if (def.id === 'disclaimer') {
      return { id: def.id, title: def.title, content: DISCLAIMER, bullets: [] };
    }
    const src = raw?.sections?.find(s => s.id === def.id) || {};
    return {
      id: def.id,
      title: def.title,
      content: sanitize(src.content || `Analysis unavailable for ${def.title}.`),
      bullets: (src.bullets || []).map(sanitize),
    };
  });
}

// ── AI call with one fallback retry ──────────────────────────────────────────
async function invokeWithFallback(base44, prompt, schema, depth) {
  const primaryModel  = MODEL_PRIMARY[depth];
  const fallbackModel = MODEL_FALLBACK[depth];

  const callLLM = async (model) => {
    return base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      model,
      response_json_schema: schema,
    });
  };

  // Primary attempt
  try {
    const result = await callLLM(primaryModel);
    return { result, modelUsed: primaryModel, fallbackUsed: false };
  } catch (_) {}

  // Fallback attempt
  const result = await callLLM(fallbackModel);
  return { result, modelUsed: fallbackModel, fallbackUsed: true };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    // Feature flag check
    if (!FEATURE_ENABLED) {
      return err('ASK_AI_SINGLE_INPUT_DISABLED', 'Ask AI single-input engine is currently disabled.', false, 503);
    }

    const body = await req.json().catch(() => null);
    if (!body?.requestId) return err('INVALID_INPUT', 'requestId is required');
    if (!body?.asset)     return err('INVALID_INPUT', 'asset is required');

    const reqId     = body.requestId;
    const asset     = body.asset.toUpperCase().trim();
    const timeframe = body.timeframe || 'swing';
    const locale    = body.locale    || 'en';
    const depth     = ['quick','standard','deep'].includes(body.depth) ? body.depth : 'deep';
    const cost      = TOKEN_COST[depth];
    const userId    = user.id;
    const isCrypto  = CRYPTO_SET.has(asset);

    // ── Idempotency: return existing completed result ─────────────────────────
    const existing = await base44.asServiceRole.entities.AskAiHistory.filter({ request_id: reqId });
    if (existing.length > 0) {
      const h = existing[0];
      const wallet = await getWallet(base44, userId);
      const report = h.report_json ? JSON.parse(h.report_json) : {
        reportVersion: 'v2',
        generatedAt: h.created_date,
        assetMeta: { symbol: h.asset, timeframe: h.timeframe || timeframe, locale, market: 'live' },
        sections: buildSections(null, h.asset),
        asset: h.asset, summary: h.summary, stance: h.stance, confidence: h.confidence,
        thesis: h.thesis_json ? JSON.parse(h.thesis_json) : [],
        riskFactors: h.risk_factors_json ? JSON.parse(h.risk_factors_json) : [],
        disclaimer: DISCLAIMER,
      };
      return ok({
        requestId: reqId, status: 'completed', report,
        wallet: { userId, balanceFree: wallet?.free_balance || 0, balancePurchased: wallet?.paid_balance || 0 },
        usage: { inputTokens: h.input_tokens || 0, outputTokens: h.output_tokens || 0, costEstimateUsd: 0 },
        fallbackUsed: h.fallback_used || false,
        latencyMs: h.latency_ms || 0,
      }, reqId);
    }

    // ── Balance check ─────────────────────────────────────────────────────────
    const wallet    = await ensureWallet(base44, userId);
    const total     = (wallet.free_balance || 0) + (wallet.paid_balance || 0);
    if (total < cost) return err('INSUFFICIENT_TOKENS', `This analysis costs ${cost} token(s). You have ${total}.`, false, 402);

    // ── Reserve tokens ────────────────────────────────────────────────────────
    const freeDebit = Math.min(wallet.free_balance || 0, cost);
    const paidDebit = cost - freeDebit;
    const bucket    = freeDebit > 0 && paidDebit > 0 ? 'mixed' : freeDebit > 0 ? 'free' : 'paid';

    await base44.asServiceRole.entities.Wallet.update(wallet.id, {
      free_balance: (wallet.free_balance || 0) - freeDebit,
      paid_balance: (wallet.paid_balance || 0) - paidDebit,
      version: (wallet.version || 1) + 1,
    });

    const reserveEntry = await base44.asServiceRole.entities.TokenLedger.create({
      user_id: userId, request_id: reqId, type: 'reserve', amount: cost,
      bucket, source: 'ask_ai', status: 'pending', note: `${depth} analysis for ${asset}`,
    });

    // ── Fetch market context ──────────────────────────────────────────────────
    const [quote, metrics, newsRaw] = await Promise.all([
      isCrypto
        ? fhGet(`/quote?symbol=BINANCE:${asset}USDT`).then(r => r?.c ? r : fhGet(`/quote?symbol=COINBASE:${asset}USD`))
        : fhGet(`/quote?symbol=${asset}`),
      isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${asset}&metric=all`),
      isCrypto ? null : (async () => {
        const to = new Date().toISOString().slice(0, 10);
        const from = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
        const articles = await fhGet(`/company-news?symbol=${asset}&from=${from}&to=${to}`);
        return (articles || []).slice(0, 5).map(a => a.headline?.slice(0, 100)).filter(Boolean);
      })(),
    ]);

    const marketContext = {
      symbol: asset,
      assetType: isCrypto ? 'crypto' : 'equity',
      timeframe,
      price: quote?.c || null,
      changePct: quote?.dp || null,
      high: quote?.h || null,
      low: quote?.l || null,
      prevClose: quote?.pc || null,
      pe: metrics?.metric?.peBasicExclExtraTTM || null,
      week52High: metrics?.metric?.['52WeekHigh'] || null,
      week52Low:  metrics?.metric?.['52WeekLow']  || null,
      avgVolume: metrics?.metric?.['10DayAverageTradingVolume'] || null,
      recentHeadlines: newsRaw || [],
    };

    // ── Build AI prompt ───────────────────────────────────────────────────────
    const depthGuide = depth === 'deep'
      ? 'Provide deep, thorough analysis. Each section must have 3-5 substantive bullet points. Be specific about price levels, catalysts, and scenarios.'
      : depth === 'standard'
      ? 'Provide balanced analysis. Each section should have 2-3 bullet points.'
      : 'Provide a concise overview. Each section should have 1-2 key bullet points.';

    const prompt = `You are an expert financial analyst producing a structured investment report for ${asset}.

LIVE MARKET DATA (use only this data, do not fabricate numbers):
${JSON.stringify(marketContext, null, 2)}

TIMEFRAME FOCUS: ${timeframe} (swing = days to weeks, scalp = hours to days, longterm = months to years)

${depthGuide}

CRITICAL RULES:
- Only reference numeric data from the live market context above.
- Do NOT use words like "guaranteed", "risk-free", "certain", "will definitely".
- Clamp confidence between 0.0 and 1.0.
- stance must be exactly: bullish, bearish, or neutral.
- All 7 content sections must have non-empty content and at least 1 bullet.
- sentiment_news_pulse must reference the provided headlines if any exist.
- scenario_paths must describe at least a bull case and bear case.
- action_playbook must be concrete (entry conditions, levels to watch).

Produce a structured JSON report.`;

    const reportSchema = {
      type: 'object',
      properties: {
        summary:    { type: 'string' },
        stance:     { type: 'string' },
        confidence: { type: 'number' },
        thesis:     { type: 'array', items: { type: 'string' } },
        riskFactors:{ type: 'array', items: { type: 'string' } },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:      { type: 'string' },
              title:   { type: 'string' },
              content: { type: 'string' },
              bullets: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'title', 'content', 'bullets'],
          },
        },
      },
      required: ['summary', 'stance', 'confidence', 'thesis', 'riskFactors', 'sections'],
    };

    // ── Call AI with fallback ─────────────────────────────────────────────────
    let aiRaw = null, modelUsed = null, fallbackUsed = false, aiError = null;
    let inputTokens = 0, outputTokens = 0;

    try {
      const { result, modelUsed: m, fallbackUsed: f } = await invokeWithFallback(base44, prompt, reportSchema, depth);
      aiRaw = result;
      modelUsed = m;
      fallbackUsed = f;
      // Estimate token usage from prompt/output size (no exact API)
      inputTokens  = Math.ceil(prompt.length / 4);
      outputTokens = Math.ceil(JSON.stringify(aiRaw).length / 4);
    } catch (e) {
      aiError = e.message;
    }

    // ── Timeout detection (function budget ~25s; flag if AI took too long) ────
    const latencyMs = Date.now() - t0;
    if (!aiRaw && aiError?.includes('timeout')) {
      // Refund
      const cw = await getWallet(base44, userId);
      await base44.asServiceRole.entities.Wallet.update(cw.id, {
        free_balance: (cw.free_balance || 0) + freeDebit,
        paid_balance: (cw.paid_balance || 0) + paidDebit,
        version: (cw.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'released', type: 'release', note: `Timeout: ${aiError}` });
      return err('ASK_AI_TIMEOUT', 'Analysis timed out. Tokens have been refunded.', true, 503);
    }

    // ── Commit or release ─────────────────────────────────────────────────────
    if (aiRaw) {
      // Normalize + guardrails
      const normalizedStance     = normalizeStance(aiRaw.stance);
      const normalizedConfidence = clampConfidence(aiRaw.confidence);
      const sections             = buildSections(aiRaw, asset);
      const thesis               = (aiRaw.thesis || []).map(sanitize);
      const riskFactors          = (aiRaw.riskFactors || []).map(sanitize);
      const summary              = sanitize(aiRaw.summary || '');

      const report = {
        reportVersion: 'v2',
        generatedAt: new Date().toISOString(),
        assetMeta: { symbol: asset, timeframe, locale, market: 'live' },
        sections,
        asset, summary,
        stance: normalizedStance,
        confidence: normalizedConfidence,
        thesis,
        riskFactors,
        disclaimer: DISCLAIMER,
      };

      // Commit ledger
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'completed', type: 'commit' });

      // Persist history with full report artifact
      await base44.asServiceRole.entities.AskAiHistory.create({
        user_id: userId, request_id: reqId, asset,
        mode: depth, depth, timeframe,
        summary, stance: normalizedStance, confidence: normalizedConfidence,
        thesis_json: JSON.stringify(thesis),
        risk_factors_json: JSON.stringify(riskFactors),
        disclaimer: DISCLAIMER,
        report_json: JSON.stringify(report),
        model_used: modelUsed,
        fallback_used: fallbackUsed,
        latency_ms: latencyMs,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      });

      // Update offer state
      const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: userId });
      if (offerRows.length > 0) {
        await base44.asServiceRole.entities.OfferState.update(offerRows[0].id, {
          free_tokens_used_total: (offerRows[0].free_tokens_used_total || 0) + (freeDebit > 0 ? freeDebit : 0),
        });
      } else {
        await base44.asServiceRole.entities.OfferState.create({ user_id: userId, free_tokens_used_total: freeDebit > 0 ? freeDebit : 0, purchase_count: 0, config_version: 'v1' });
      }

      const updatedWallet = await getWallet(base44, userId);
      const costEstimateUsd = depth === 'deep' ? (inputTokens * 0.000003 + outputTokens * 0.000015) : (inputTokens + outputTokens) * 0.0000006;

      return ok({
        requestId: reqId,
        status: 'completed',
        report,
        wallet: {
          userId,
          balanceFree: updatedWallet?.free_balance || 0,
          balancePurchased: updatedWallet?.paid_balance || 0,
        },
        usage: { inputTokens, outputTokens, costEstimateUsd: +costEstimateUsd.toFixed(6) },
        fallbackUsed,
        latencyMs,
      }, reqId);

    } else {
      // Release: refund tokens
      const cw = await getWallet(base44, userId);
      await base44.asServiceRole.entities.Wallet.update(cw.id, {
        free_balance: (cw.free_balance || 0) + freeDebit,
        paid_balance: (cw.paid_balance || 0) + paidDebit,
        version: (cw.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'released', type: 'release', note: `AI error: ${aiError}` });
      return err('ASK_AI_ERROR', 'AI analysis failed. Tokens have been refunded.', true, 503);
    }

  } catch (e) {
    return err('ASK_AI_ERROR', e.message, true, 500);
  }
});