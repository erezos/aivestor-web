/**
 * createPurchaseIntent — Phase 5a. Creates a pending purchase receipt.
 * Idempotent by transactionId.
 * Protected: requires Base44 auth. requestId required.
 *
 * Request: { requestId, packId, platform, transactionId }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'purchase' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body = await req.json().catch(() => null);
    if (!body?.requestId)     return err('INVALID_INPUT', 'requestId is required');
    if (!body?.packId)        return err('INVALID_INPUT', 'packId is required');
    if (!body?.platform)      return err('INVALID_INPUT', 'platform is required (apple|google)');
    if (!body?.transactionId) return err('INVALID_INPUT', 'transactionId is required');
    if (!['apple','google'].includes(body.platform)) return err('INVALID_INPUT', 'platform must be apple or google');

    const reqId  = body.requestId;
    const userId = user.id;

    // Idempotency: if transactionId already exists, return existing intent
    const existing = await base44.asServiceRole.entities.PurchaseReceipt.filter({ transaction_id: body.transactionId });
    if (existing.length > 0) {
      return ok({ intentId: existing[0].intent_id, status: existing[0].status }, reqId);
    }

    const intentId = crypto.randomUUID();
    await base44.asServiceRole.entities.PurchaseReceipt.create({
      user_id: userId,
      intent_id: intentId,
      transaction_id: body.transactionId,
      platform: body.platform,
      product_id: body.packId,
      raw_receipt_json: null,
      status: 'pending',
      tokens_credited: 0,
    });

    return ok({ intentId, status: 'pending' }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});