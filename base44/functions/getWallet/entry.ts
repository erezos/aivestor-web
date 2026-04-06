/**
 * getWallet — Phase 3. Returns user wallet balances.
 * On-demand daily free accrual: +1/day, max 3, UTC calendar day.
 * Protected: requires Base44 auth.
 *
 * Request: { requestId?: string }
 * Response: { freeBalance, paidBalance, totalBalance, lastFreeAccrualDate, rules }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function ok(data, reqId) {
  return Response.json({ data, meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'wallet' }, error: null });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({ data: null, meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString(), cache: { hit: false, ttlSec: 0 }, source: 'system' }, error: { code, message, retryable } }, { status });
}

const FREE_CAP        = 3;
const DAILY_FREE_GRANT = 1;

function todayUTC() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user   = await base44.auth.me();
    if (!user) return err('AUTH_REQUIRED', 'Authentication required', false, 401);

    const body  = await req.json().catch(() => ({}));
    const reqId = body.requestId || crypto.randomUUID();
    const today = todayUTC();

    // Get or create wallet
    const rows   = await base44.asServiceRole.entities.Wallet.filter({ user_id: user.id });
    let wallet   = rows[0];

    if (!wallet) {
      wallet = await base44.asServiceRole.entities.Wallet.create({
        user_id: user.id, free_balance: 0, paid_balance: 0,
        last_free_accrual_date: null, version: 1,
      });
    }

    // On-demand daily free accrual
    // Only accrue if: day has changed AND free_balance < cap
    if (wallet.last_free_accrual_date !== today && wallet.free_balance < FREE_CAP) {
      const newFree = Math.min(wallet.free_balance + DAILY_FREE_GRANT, FREE_CAP);
      await base44.asServiceRole.entities.Wallet.update(wallet.id, {
        free_balance: newFree,
        last_free_accrual_date: today,
        version: (wallet.version || 1) + 1,
      });
      // Append ledger entry
      await base44.asServiceRole.entities.TokenLedger.create({
        user_id: user.id, type: 'accrual', amount: DAILY_FREE_GRANT,
        bucket: 'free', source: 'daily_free', status: 'completed',
        note: `Daily free grant ${today}`,
      });
      wallet.free_balance = newFree;
      wallet.last_free_accrual_date = today;
    }

    return ok({
      freeBalance: wallet.free_balance || 0,
      paidBalance: wallet.paid_balance || 0,
      totalBalance: (wallet.free_balance || 0) + (wallet.paid_balance || 0),
      lastFreeAccrualDate: wallet.last_free_accrual_date || null,
      rules: { dailyFreeGrant: DAILY_FREE_GRANT, freeCap: FREE_CAP },
    }, reqId);
  } catch (e) {
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});