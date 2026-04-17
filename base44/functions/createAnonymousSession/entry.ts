/**
 * createAnonymousSession — Mobile anonymous auth via stable deviceId.
 *
 * The deviceId (stable install UUID from Flutter secure storage) is hashed
 * into a deterministic email + password so the same device always resolves
 * to the same Base44 user — no email address required.
 *
 * Flow:
 *   1. Derive email = device_<sha256(deviceId)>@aivestor.internal
 *   2. Derive password = sha256(deviceId + DEVICE_SALT) — server-only secret
 *   3. Try register() → if already exists, loginViaEmailPassword()
 *   4. Return access_token (90-day JWT) + wallet state
 *
 * Token: standard Base44 JWT, 90-day expiry.
 * Refresh: call this endpoint again with same deviceId — idempotent.
 *
 * Request:  { requestId, anonymousUserId, platform, appVersion }
 * Response: { sessionToken, userId, wallet: { freeBalance, paidBalance, totalBalance } }
 *
 * No auth required — this is the bootstrap endpoint.
 */
import { createClient } from 'npm:@base44/sdk@0.8.25';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const APP_ID     = Deno.env.get('BASE44_APP_ID');
const SALT       = Deno.env.get('DEVICE_ID_SALT') || 'aivestor_mobile_v1';
const FREE_CAP   = 3;

function ok(data, reqId) {
  return Response.json({
    data,
    meta: { requestId: reqId || crypto.randomUUID(), asOf: new Date().toISOString() },
    error: null,
  });
}
function err(code, message, retryable = false, status = 400) {
  return Response.json({
    data: null,
    meta: { requestId: crypto.randomUUID(), asOf: new Date().toISOString() },
    error: { code, message, retryable },
  }, { status });
}

async function sha256hex(input) {
  const encoded = new TextEncoder().encode(input);
  const hash    = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function ensureWallet(base44ServiceRole, userId) {
  const rows = await base44ServiceRole.entities.Wallet.filter({ user_id: userId });
  if (rows[0]) return rows[0];
  return await base44ServiceRole.entities.Wallet.create({
    user_id: userId,
    free_balance: 0,
    paid_balance: 0,
    last_free_accrual_date: null,
    version: 1,
  });
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.anonymousUserId) return err('INVALID_INPUT', 'anonymousUserId is required');
    if (!body?.platform || !['android', 'ios'].includes(body.platform)) {
      return err('INVALID_INPUT', 'platform must be android or ios');
    }

    const reqId      = body.requestId || crypto.randomUUID();
    const deviceId   = body.anonymousUserId.trim();

    // Derive deterministic credentials from deviceId
    const emailHash  = await sha256hex(deviceId);
    const passHash   = await sha256hex(deviceId + SALT);
    const email      = `device_${emailHash}@aivestor.internal`;
    const password   = passHash; // 64-char hex — strong enough

    // Use a public (no-auth) client to register or login
    const publicClient = createClient({ appId: APP_ID });

    let accessToken = null;
    let userId      = null;

    // Try register first (new device)
    try {
      const result = await publicClient.auth.register({ email, password });
      accessToken = result?.access_token;
      userId      = result?.user?.id;
    } catch (regErr) {
      // User already exists (device seen before) → login
      const loginResult = await publicClient.auth.loginViaEmailPassword(email, password);
      accessToken = loginResult?.access_token;
      userId      = loginResult?.user?.id;
    }

    if (!accessToken || !userId) {
      return err('SESSION_CREATE_FAILED', 'Could not create or resume session', true, 500);
    }

    // Ensure wallet exists (service role — works regardless of user role)
    const base44 = createClientFromRequest(req);
    const wallet  = await ensureWallet(base44.asServiceRole, userId);

    const today = new Date().toISOString().slice(0, 10);
    let freeBalance  = wallet.free_balance || 0;
    const paidBalance = wallet.paid_balance || 0;

    // On-demand daily free accrual (same logic as getWallet)
    if (wallet.last_free_accrual_date !== today && freeBalance < FREE_CAP) {
      const newFree = Math.min(freeBalance + 1, FREE_CAP);
      await base44.asServiceRole.entities.Wallet.update(wallet.id, {
        free_balance: newFree,
        last_free_accrual_date: today,
        version: (wallet.version || 1) + 1,
      });
      await base44.asServiceRole.entities.TokenLedger.create({
        user_id: userId, type: 'accrual', amount: 1,
        bucket: 'free', source: 'daily_free', status: 'completed',
        note: `Daily free grant ${today} (session bootstrap)`,
      });
      freeBalance = newFree;
    }

    return ok({
      sessionToken: accessToken,
      userId,
      wallet: {
        freeBalance,
        paidBalance,
        totalBalance: freeBalance + paidBalance,
      },
    }, reqId);

  } catch (e) {
    console.error('[createAnonymousSession]', e.message);
    return err('INTERNAL_ERROR', e.message, true, 500);
  }
});