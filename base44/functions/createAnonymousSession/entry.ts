/**
 * createAnonymousSession — Mobile anonymous auth via stable deviceId.
 *
 * Since Base44 requires email verification for registered users, we issue our
 * own HMAC-SHA256 signed JWTs instead, keyed on a deterministic userId derived
 * from the deviceId + server-side salt.
 *
 * Flow:
 *   1. userId = sha256(deviceId + DEVICE_ID_SALT) — first 32 chars
 *   2. Issue a signed JWT { sub: userId, iat, exp } using MOBILE_JWT_SECRET
 *   3. Ensure Wallet row exists for this userId (service role)
 *   4. Run daily free-token accrual if needed
 *   5. Return { sessionToken, userId, wallet }
 *
 * Token: HS256 JWT, 90-day expiry.
 * Refresh: call this endpoint again with same deviceId — fully idempotent.
 *
 * Request:  { requestId, anonymousUserId, platform, appVersion }
 * Response: { sessionToken, userId, wallet: { freeBalance, paidBalance, totalBalance } }
 *
 * No auth required — this is the bootstrap endpoint.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SALT       = Deno.env.get('DEVICE_ID_SALT')    || 'aivestor_mobile_v1';
const JWT_SECRET = Deno.env.get('MOBILE_JWT_SECRET') || '';
const FREE_CAP   = 3;
const TOKEN_TTL  = 90 * 24 * 60 * 60; // 90 days in seconds

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  const buf     = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function base64url(buf) {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signJwt(payload) {
  const header  = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body    = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64url(sig)}`;
}

async function ensureWallet(svc, userId) {
  const rows = await svc.entities.Wallet.filter({ user_id: userId });
  if (rows[0]) return rows[0];
  return await svc.entities.Wallet.create({
    user_id: userId,
    free_balance: 0,
    paid_balance: 0,
    last_free_accrual_date: null,
    version: 1,
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);
    // Accept either deviceId or anonymousUserId (both mean the same thing)
    const rawDeviceId = body?.deviceId || body?.anonymousUserId;
    if (!rawDeviceId) return err('INVALID_INPUT', 'deviceId (or anonymousUserId) is required');
    if (!body?.platform || !['android', 'ios'].includes(body.platform)) {
      return err('INVALID_INPUT', 'platform must be android or ios');
    }
    if (!JWT_SECRET) return err('CONFIG_ERROR', 'Server JWT secret not configured', false, 500);

    const reqId    = body.requestId || crypto.randomUUID();
    const deviceId = rawDeviceId.trim();

    // Deterministic userId from deviceId + server salt
    const userId = (await sha256hex(deviceId + SALT)).slice(0, 32);

    // Issue a signed JWT
    const now = Math.floor(Date.now() / 1000);
    const sessionToken = await signJwt({
      sub:      userId,
      platform: body.platform,
      iat:      now,
      exp:      now + TOKEN_TTL,
    });

    // Wallet management (service role — no user auth needed here)
    const base44  = createClientFromRequest(req);
    const wallet  = await ensureWallet(base44.asServiceRole, userId);

    const today       = new Date().toISOString().slice(0, 10);
    let freeBalance   = wallet.free_balance  || 0;
    const paidBalance = wallet.paid_balance  || 0;

    // Daily free-token accrual
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
      sessionToken,
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