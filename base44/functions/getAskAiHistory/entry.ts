/**
 * getAskAiHistory — Phase 4. Paginated AI analysis history for authenticated user.
 * 60-day retention enforced by nightly cleanup automation.
 * Cursor = offset index (opaque string).
 *
 * Request: { limit?, cursor?, requestId? }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'db' }, error: null });
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

    const body   = await req.json().catch(() => ({}));
    const limit  = Math.min(parseInt(body.limit) || 20, 50);
    const cursor = parseInt(body.cursor) || 0;
    const reqId  = body.requestId || crypto.randomUUID();

    // Fetch all for user, sorted newest first
    const all = await base44.asServiceRole.entities.AskAiHistory.filter({ user_id: user.id }, '-created_date', 200);

    const page       = all.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < all.length ? String(cursor + limit) : null;

    const items = page.map(h => ({
      id: h.id,
      asset: h.asset,
      question: h.question,
      mode: h.mode,
      summary: h.summary,
      stance: h.stance,
      confidence: h.confidence,
      requestId: h.request_id,
      createdAt: h.created_date,
    }));

    return ok({ items, nextCursor, total: all.length }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});