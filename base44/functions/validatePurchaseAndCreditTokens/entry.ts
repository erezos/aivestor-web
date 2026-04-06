/**
 * validatePurchaseAndCreditTokens — Phase 5a (mock) / 5b (real).
 * Idempotent by transactionId. Credits paid_balance on success.
 * Protected: requires Base44 auth. requestId required.
 *
 * Phase 5a: Mock validation (always succeeds). Toggle ENABLE_REAL_VALIDATION=true for Phase 5b.
 * Phase 5b: Add APPLE_SHARED_SECRET and GOOGLE_SERVICE_ACCOUNT_JSON to secrets.
 *
 * Request: { requestId, intentId, platform, transactionId, receiptData, productId }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Token pack registry (must match listTokenPacks) ───────────────────────────
const PACK_TOKENS = {
  'pack_5':     5,
  'pack_15':    15,
  'pack_50':    50,
  'starter_4':  4,
  'heavy_150':  150,
};

// Phase 5b toggle: set to true when Apple/Google secrets are configured
const ENABLE_REAL_VALIDATION = false;

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'purchase' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

// ── Phase 5b: Real Apple validation (uncomment when secret is set) ────────────
async function validateApple(receiptData) {
  const APPLE_SECRET = Deno.env.get('APPLE_SHARED_SECRET');
  // Try production first, then sandbox
  for (const url of ['https://buy.itunes.apple.com/verifyReceipt','https://sandbox.itunes.apple.com/verifyReceipt']) {
    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ 'receipt-data': receiptData, password: APPLE_SECRET }) });
    const json = res.ok ? await res.json() : null;
    if (json?.status === 0) return { valid: true };
    if (json?.status === 21007) continue; // sandbox receipt in production, retry
    return { valid: false, reason: `Apple status: ${json?.status}` };
  }
  return { valid: false, reason: 'Apple validation failed' };
}

// ── Phase 5b: Real Google validation (uncomment when secret is set) ───────────
async function validateGoogle(receiptData, productId) {
  // receiptData should be { purchaseToken, packageName }
  // Requires GOOGLE_SERVICE_ACCOUNT_JSON secret + google-auth-library
  // Placeholder — implement with service account JWT in Phase 5b
  return { valid: false, reason: 'Google validation not yet implemented' };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body = await req.json().catch(() => null);
    if (!body?.requestId)     return err('INVALID_INPUT', 'requestId is required');
    if (!body?.intentId)      return err('INVALID_INPUT', 'intentId is required');
    if (!body?.transactionId) return err('INVALID_INPUT', 'transactionId is required');
    if (!body?.productId)     return err('INVALID_INPUT', 'productId is required');

    const reqId  = body.requestId;
    const userId = user.id;

    // Idempotency: already completed → return success without re-crediting
    const receipts = await base44.asServiceRole.entities.PurchaseReceipt.filter({ transaction_id: body.transactionId });
    const receipt  = receipts[0];
    if (receipt?.status === 'completed') {
      const wallet = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
      const w      = wallet[0] || { free_balance: 0, paid_balance: 0 };
      return ok({
        creditedTokens: receipt.tokens_credited,
        wallet: { freeBalance: w.free_balance || 0, paidBalance: w.paid_balance || 0, totalBalance: (w.free_balance || 0) + (w.paid_balance || 0) },
        receiptStatus: 'completed',
      }, reqId);
    }

    if (receipt?.status === 'failed') {
      return err('PURCHASE_INVALID', receipt.failure_reason || 'Purchase validation failed', false, 402);
    }

    // ── Validate receipt ────────────────────────────────────────────────────────
    let validationResult = { valid: true }; // Phase 5a: mock success

    if (ENABLE_REAL_VALIDATION) {
      if (body.platform === 'apple') {
        validationResult = await validateApple(body.receiptData);
      } else if (body.platform === 'google') {
        validationResult = await validateGoogle(body.receiptData, body.productId);
      }
    }

    const tokensToCredit = PACK_TOKENS[body.productId] || 0;
    const receiptId      = receipt?.id;

    if (!validationResult.valid) {
      if (receiptId) {
        await base44.asServiceRole.entities.PurchaseReceipt.update(receiptId, { status: 'failed', failure_reason: validationResult.reason });
      }
      return err('PURCHASE_INVALID', validationResult.reason || 'Invalid purchase receipt', false, 402);
    }

    if (tokensToCredit === 0) return err('INVALID_INPUT', `Unknown productId: ${body.productId}`, false, 400);

    // ── Credit tokens ───────────────────────────────────────────────────────────
    const walletRows = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
    let wallet       = walletRows[0];
    if (!wallet) {
      wallet = await base44.asServiceRole.entities.Wallet.create({ user_id: userId, free_balance: 0, paid_balance: 0, version: 1 });
    }

    await base44.asServiceRole.entities.Wallet.update(wallet.id, {
      paid_balance: (wallet.paid_balance || 0) + tokensToCredit,
      version: (wallet.version || 1) + 1,
    });

    // Append ledger
    await base44.asServiceRole.entities.TokenLedger.create({
      user_id: userId, request_id: reqId, type: 'credit', amount: tokensToCredit,
      bucket: 'paid', source: 'purchase', status: 'completed',
      note: `Purchase: ${body.productId} via ${body.platform}`,
    });

    // Mark receipt completed
    if (receiptId) {
      await base44.asServiceRole.entities.PurchaseReceipt.update(receiptId, {
        status: 'completed', tokens_credited: tokensToCredit,
        raw_receipt_json: body.receiptData ? JSON.stringify(body.receiptData).slice(0, 2000) : null,
      });
    }

    // Increment purchase_count in OfferState
    const offerRows = await base44.asServiceRole.entities.OfferState.filter({ user_id: userId });
    if (offerRows.length > 0) {
      await base44.asServiceRole.entities.OfferState.update(offerRows[0].id, {
        purchase_count: (offerRows[0].purchase_count || 0) + 1,
      });
    } else {
      await base44.asServiceRole.entities.OfferState.create({ user_id: userId, purchase_count: 1, free_tokens_used_total: 0, config_version: 'v1' });
    }

    const updatedWallet = (await base44.asServiceRole.entities.Wallet.filter({ user_id: userId }))[0];
    return ok({
      creditedTokens: tokensToCredit,
      wallet: {
        freeBalance: updatedWallet?.free_balance || 0,
        paidBalance: updatedWallet?.paid_balance || 0,
        totalBalance: (updatedWallet?.free_balance || 0) + (updatedWallet?.paid_balance || 0),
      },
      receiptStatus: 'completed',
    }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});