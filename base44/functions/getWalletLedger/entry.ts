/**
 * getWalletLedger — Paginated token ledger history for authenticated user.
 * Protected: requires Base44 auth (JWT).
 *
 * Request:  { requestId, limit?, cursor? }
 * Response: standard envelope { data: { entries, nextCursor, total }, meta, error }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function ok(data, reqId) {
  return Response.json({
    data,
    meta: { requestId: reqId, asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'ledger' },
    error: null,
  });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({
    data: null,
    meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' },
    error: { code, message, retryable },
  }, { status });
}

// Map raw ledger type+source to a Flutter-friendly source label and signed delta
function mapEntry(row) {
  // Determine signed delta based on type
  let delta = row.amount || 0;
  if (['debit', 'reserve', 'commit'].includes(row.type)) delta = -Math.abs(delta);
  else if (['accrual', 'credit', 'refund', 'release'].includes(row.type)) delta = +Math.abs(delta);

  // Map to Flutter source enum
  const sourceMap = {
    daily_free: 'daily_grant',
    ask_ai:     'ask_burn',
    purchase:   'purchase',
    system:     'adjustment',
  };
  const source = sourceMap[row.source] || row.source || 'adjustment';

  // Human-readable description
  const descMap = {
    daily_grant: 'Daily free token grant',
    ask_burn:    'AI analysis',
    purchase:    'Token purchase',
    adjustment:  'System adjustment',
    refund:      'Refund',
  };
  const description = row.note || descMap[source] || source;

  return {
    id:           row.id,
    delta,
    type:         row.type,
    source,
    bucket:       row.bucket || null,
    requestId:    row.request_id || null,
    createdAt:    row.created_date,
    createdAtIso: row.created_date,
    description,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body = await req.json().catch(() => null);
    if (!body?.requestId) return err('INVALID_INPUT', 'requestId is required');

    const limit  = Math.min(parseInt(body.limit) || 20, 50);
    const cursor = parseInt(body.cursor) || 0;
    const reqId  = body.requestId;

    // Fetch all ledger rows for this user, newest first
    let all = [];
    try {
      all = await base44.asServiceRole.entities.TokenLedger.filter({ user_id: user.id }, '-created_date', 500);
    } catch (_) {
      return err('PROVIDER_UNAVAILABLE', 'Unable to fetch ledger data', true, 503);
    }

    const page       = all.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < all.length ? String(cursor + limit) : null;
    const entries    = page.map(mapEntry);

    return ok({
      entries,
      ledgerEntries: entries, // backward-compat alias
      nextCursor,
      total: all.length,
    }, reqId);

  } catch (e) {
    return err('PROVIDER_UNAVAILABLE', e.message, true, 500);
  }
});