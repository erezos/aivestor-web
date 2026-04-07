/**
 * askAiAnalyze — Phase 4. AI analysis with token reserve/commit/release flow.
 * Idempotent by requestId. Auto-saves to AskAiHistory on success.
 * Protected: requires Base44 auth. requestId is REQUIRED.
 *
 * Token cost: quick=1, standard=1, deep=3
 * Debit flow: reserve → AI call → commit (or release on failure)
 *
 * Request: { requestId, asset, question, mode }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');
const CRYPTO_SET  = new Set(['BTC','ETH','SOL','XRP','DOGE','ADA','AVAX','DOT','MATIC','LINK','BNB']);

const TOKEN_COST = { quick: 1, standard: 1, deep: 3 };

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId, asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'llm' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

async function fhGet(path) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://finnhub.io/api/v1${path}${sep}token=${FINNHUB_KEY}`);
  return res.ok ? res.json() : null;
}

async function getWalletForUser(base44, userId) {
  const rows = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
  return rows[0] || null;
}

async function ensureWallet(base44, userId) {
  let wallet = await getWalletForUser(base44, userId);
  if (!wallet) {
    wallet = await base44.asServiceRole.entities.Wallet.create({
      user_id: userId, free_balance: 0, paid_balance: 0,
      last_free_accrual_date: null, version: 1,
    });
  }
  return wallet;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body = await req.json().catch(() => null);
    if (!body?.requestId) return err('INVALID_INPUT', 'requestId is required');
    if (!body?.asset)     return err('INVALID_INPUT', 'asset is required');

    const reqId  = body.requestId;
    const asset  = body.asset.toUpperCase().trim();
    const mode   = ['quick','standard','deep'].includes(body.mode) ? body.mode : 'standard';
    const cost   = TOKEN_COST[mode];
    const userId = user.id;

    // ── Idempotency check: if same requestId already completed, return cached result ──
    const existing = await base44.asServiceRole.entities.AskAiHistory.filter({ request_id: reqId });
    if (existing.length > 0) {
      const h = existing[0];
      const wallet = await getWalletForUser(base44, userId);
      return ok({
        requestId: reqId,
        report: {
          asset: h.asset, summary: h.summary, stance: h.stance,
          confidence: h.confidence,
          thesis: h.thesis_json ? JSON.parse(h.thesis_json) : [],
          riskFactors: h.risk_factors_json ? JSON.parse(h.risk_factors_json) : [],
          disclaimer: h.disclaimer,
        },
        wallet: { freeBalance: wallet?.free_balance || 0, paidBalance: wallet?.paid_balance || 0, totalBalance: (wallet?.free_balance || 0) + (wallet?.paid_balance || 0) },
      }, reqId);
    }

    // ── Check balance ──────────────────────────────────────────────────────────
    const wallet = await ensureWallet(base44, userId);
    const total  = (wallet.free_balance || 0) + (wallet.paid_balance || 0);
    if (total < cost) return err('INSUFFICIENT_TOKENS', `This analysis costs ${cost} token(s). You have ${total}.`, false, 402);

    // ── Reserve tokens (pending ledger entry) ──────────────────────────────────
    // Deduct free first, then paid
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
      bucket, source: 'ask_ai', status: 'pending', note: `${mode} analysis for ${asset}`,
    });

    // ── Call AI ────────────────────────────────────────────────────────────────
    let report = null;
    let aiError = null;
    try {
      const isCrypto = CRYPTO_SET.has(asset);
      const [quote, metrics] = await Promise.all([
        isCrypto
          ? fhGet(`/quote?symbol=BINANCE:${asset}USDT`).then(r => r?.c ? r : fhGet(`/quote?symbol=COINBASE:${asset}USD`))
          : fhGet(`/quote?symbol=${asset}`),
        isCrypto ? null : fhGet(`/stock/basic-financials?symbol=${asset}&metric=all`),
      ]);

      const context = {
        symbol: asset, mode, isCrypto,
        price: quote?.c || 'unknown',
        changePct: quote?.dp || 0,
        pe: metrics?.metric?.peBasicExclExtraTTM || null,
        high52: metrics?.metric?.['52WeekHigh'] || null,
        low52:  metrics?.metric?.['52WeekLow'] || null,
      };

      const detailInstructions = mode === 'deep'
        ? 'Provide deep analysis: full thesis, 4+ risk factors, macro context, technical setup.'
        : mode === 'quick'
        ? 'Provide a quick 1-paragraph summary with top 2 bullet points each for thesis and risks.'
        : 'Provide balanced standard analysis: 3 thesis points, 3 risk factors, clear stance.';

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Analyze ${asset} as a ${isCrypto ? 'cryptocurrency' : 'stock'} investment.
Question: "${body.question || 'Analyze current setup'}"
Live data: ${JSON.stringify(context)}
${detailInstructions}
Be specific, grounded in the data above. No hallucination.`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary:     { type: 'string' },
            stance:      { type: 'string', enum: ['bullish','bearish','neutral'] },
            confidence:  { type: 'number' },
            thesis:      { type: 'array', items: { type: 'string' } },
            riskFactors: { type: 'array', items: { type: 'string' } },
            disclaimer:  { type: 'string' },
          },
          required: ['summary','stance','confidence','thesis','riskFactors']
        }
      });

      report = { asset, question: body.question || 'Analyze current setup', ...result,
        disclaimer: result.disclaimer || 'This is not financial advice. Do your own research.' };

    } catch (e) {
      aiError = e.message;
    }

    // ── Commit or release ──────────────────────────────────────────────────────
    if (report) {
      // Commit: mark ledger as completed
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'completed', type: 'commit' });

      // Auto-save history
      await base44.asServiceRole.entities.AskAiHistory.create({
        user_id: userId, request_id: reqId, asset: report.asset,
        question: report.question, mode,
        summary: report.summary, stance: report.stance, confidence: report.confidence,
        thesis_json: JSON.stringify(report.thesis || []),
        risk_factors_json: JSON.stringify(report.riskFactors || []),
        disclaimer: report.disclaimer,
      });

      // Update offer state total usage
      const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: userId });
      if (offerRows.length > 0) {
        await base44.asServiceRole.entities.OfferState.update(offerRows[0].id, {
          free_tokens_used_total: (offerRows[0].free_tokens_used_total || 0) + (freeDebit > 0 ? freeDebit : 0),
        });
      } else {
        await base44.asServiceRole.entities.OfferState.create({
          user_id: userId, free_tokens_used_total: freeDebit > 0 ? freeDebit : 0,
          purchase_count: 0, config_version: 'v1',
        });
      }

      const updatedWallet = await getWalletForUser(base44, userId);
      return ok({
        requestId: reqId, report,
        wallet: {
          freeBalance: updatedWallet?.free_balance || 0,
          paidBalance: updatedWallet?.paid_balance || 0,
          totalBalance: (updatedWallet?.free_balance || 0) + (updatedWallet?.paid_balance || 0),
        },
      }, reqId);

    } else {
      // Release: refund tokens, mark ledger as released
      await base44.asServiceRole.entities.Wallet.update(wallet.id, {
        free_balance: (wallet.free_balance || 0), // already deducted — refund
        paid_balance: (wallet.paid_balance || 0),
        version: (wallet.version || 1) + 2,
      });
      // Actually restore the balance
      const currentWallet = await getWalletForUser(base44, userId);
      await base44.asServiceRole.entities.Wallet.update(currentWallet.id, {
        free_balance: (currentWallet.free_balance || 0) + freeDebit,
        paid_balance: (currentWallet.paid_balance || 0) + paidDebit,
        version: (currentWallet.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.update(reserveEntry.id, { status: 'released', type: 'release', note: `AI failed: ${aiError}` });
      return err('PROVIDER_UNAVAILABLE', 'AI analysis failed. Tokens have been refunded.', true, 503);
    }
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});