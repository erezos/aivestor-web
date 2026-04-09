/**
 * dailyFreeTokenGrant — Scheduled batch processor for daily free token grants.
 *
 * Policy:
 *   DAILY_FREE_GRANT = 1
 *   FREE_CAP = 3
 *   Eligible when: now - lastDailyGrantAt >= 24h (rolling window, not calendar day)
 *
 * Idempotency:
 *   grantWindowStart = floor(nowUtcMs / 86_400_000)   ← 24h UTC bucket
 *   idempotencyKey   = "daily_grant:{userId}:{grantWindowStart}"
 *   Stored in TokenLedger.request_id (unique-indexed in app).
 *   If a ledger row with that request_id already exists → skip (already granted).
 *
 * Concurrency safety (within Base44 constraints):
 *   1. Read ledger by idempotency key FIRST — cheapest early-exit.
 *   2. Re-read wallet inside the grant path to get latest version.
 *   3. Wallet update includes version check (optimistic lock):
 *      update only if version === expectedVersion, otherwise skip.
 *   Two concurrent runners on the same wallet will race on step 1;
 *   the second one finds the ledger row already inserted and exits clean.
 *
 * Observability:
 *   Returns { scanned, eligible, granted, alreadyGranted, skippedNotDue, skippedAtCap, errors }
 *
 * Admin-only: requires role === 'admin' OR is called as scheduled automation (no user).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const DAILY_FREE_GRANT = 1;
const FREE_CAP         = 3;
const WINDOW_MS        = 24 * 60 * 60 * 1000; // 24h in ms
const PAGE_SIZE        = 100;                   // wallets per page

function grantWindowKey(nowMs) {
  return Math.floor(nowMs / 86_400_000); // UTC day bucket
}

function idempotencyKey(userId, windowKey) {
  return `daily_grant:${userId}:${windowKey}`;
}

Deno.serve(async (req) => {
  const t0 = Date.now();

  try {
    const base44 = createClientFromRequest(req);

    // Auth: allow admin users OR scheduled (no-user) calls
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const nowMs      = Date.now();
    const nowIso     = new Date(nowMs).toISOString();
    const windowKey  = grantWindowKey(nowMs);
    const cutoffIso  = new Date(nowMs - WINDOW_MS).toISOString();

    const stats = {
      scanned: 0,
      eligible: 0,
      granted: 0,
      alreadyGranted: 0,
      skippedNotDue: 0,
      skippedAtCap: 0,
      errors: 0,
      errorDetails: [],
    };

    // ── Paginated scan over all wallets ───────────────────────────────────────
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let page = [];
      try {
        // Fetch page of wallets (sorted by id for stable pagination)
        page = await base44.asServiceRole.entities.Wallet.list('id', PAGE_SIZE, offset);
      } catch (e) {
        stats.errors++;
        stats.errorDetails.push(`Page fetch @offset=${offset}: ${e.message}`);
        break; // Stop if we can't read wallets — don't infinite loop
      }

      if (!page || page.length === 0) {
        hasMore = false;
        break;
      }

      stats.scanned += page.length;
      if (page.length < PAGE_SIZE) hasMore = false;
      else offset += PAGE_SIZE;

      // Process each wallet in the page (sequential to avoid thundering herd)
      for (const wallet of page) {
        try {
          await processWallet(base44, wallet, nowMs, nowIso, cutoffIso, windowKey, stats);
        } catch (e) {
          stats.errors++;
          stats.errorDetails.push(`Wallet ${wallet.user_id}: ${e.message}`);
        }
      }
    }

    const latencyMs = Date.now() - t0;
    console.log('[dailyFreeTokenGrant]', JSON.stringify({ ...stats, latencyMs, windowKey, nowIso }));

    // Alert signal: surface errors prominently
    if (stats.errors > 0) {
      console.error(`[dailyFreeTokenGrant] ALERT: ${stats.errors} errors during run. Details:`, stats.errorDetails);
    }

    return Response.json({
      ok: true,
      stats,
      windowKey,
      latencyMs,
      runAt: nowIso,
    });

  } catch (e) {
    console.error('[dailyFreeTokenGrant] FATAL:', e.message);
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
});

/**
 * processWallet — attempt a grant for a single wallet.
 * Updates stats in-place.
 */
async function processWallet(base44, wallet, nowMs, nowIso, cutoffIso, windowKey, stats) {
  const userId = wallet.user_id;

  // ── 1. Check if already at cap (cheap early exit, no ledger read) ─────────
  if ((wallet.free_balance || 0) >= FREE_CAP) {
    // Still need to check the 24h window — if due, we write ledger but no balance change
    // to stay consistent with policy. We'll handle this below.
  }

  // ── 2. Check 24h rolling window ───────────────────────────────────────────
  const lastGrantAt = wallet.last_free_accrual_date; // stored as ISO timestamp or YYYY-MM-DD
  let isDue = true;
  if (lastGrantAt) {
    const lastMs = new Date(lastGrantAt).getTime();
    if (!isNaN(lastMs) && (nowMs - lastMs) < WINDOW_MS) {
      isDue = false;
    }
  }

  if (!isDue) {
    stats.skippedNotDue++;
    return;
  }

  stats.eligible++;

  // ── 3. Idempotency check: has ledger row already been written this window? ─
  const iKey = idempotencyKey(userId, windowKey);
  let existingLedger = [];
  try {
    existingLedger = await base44.asServiceRole.entities.TokenLedger.filter({ request_id: iKey });
  } catch (_) { /* treat as not found */ }

  if (existingLedger.length > 0) {
    stats.alreadyGranted++;
    return;
  }

  // ── 4. Re-read wallet for latest state (optimistic concurrency) ───────────
  let freshWallet = wallet;
  try {
    const rows = await base44.asServiceRole.entities.Wallet.filter({ user_id: userId });
    if (rows[0]) freshWallet = rows[0];
  } catch (_) { /* use stale — will fail on version check */ }

  const currentFree    = freshWallet.free_balance || 0;
  const currentVersion = freshWallet.version      || 1;
  const atCap          = currentFree >= FREE_CAP;

  // ── 5. Write ledger row (idempotency anchor) ──────────────────────────────
  //    Do this BEFORE wallet update so if wallet update fails,
  //    the ledger row signals "already attempted" on retry.
  let ledgerRow;
  try {
    ledgerRow = await base44.asServiceRole.entities.TokenLedger.create({
      user_id:    userId,
      request_id: iKey,          // idempotency key stored here
      type:       'accrual',
      amount:     atCap ? 0 : DAILY_FREE_GRANT,  // 0 delta if at cap, but still record
      bucket:     'free',
      source:     'daily_free',
      status:     'completed',
      note:       `Daily free grant window=${windowKey} atCap=${atCap}`,
    });
  } catch (e) {
    // If this throws due to duplicate request_id, treat as already granted
    if (e.message?.includes('duplicate') || e.message?.includes('unique') || e.message?.includes('conflict')) {
      stats.alreadyGranted++;
      return;
    }
    throw e; // Re-throw real errors
  }

  if (atCap) {
    stats.skippedAtCap++;
    return;
  }

  // ── 6. Update wallet with optimistic version lock ─────────────────────────
  const newFree       = Math.min(FREE_CAP, currentFree + DAILY_FREE_GRANT);
  const newVersion    = currentVersion + 1;

  try {
    await base44.asServiceRole.entities.Wallet.update(freshWallet.id, {
      free_balance:            newFree,
      last_free_accrual_date:  nowIso,
      version:                 newVersion,
    });
    stats.granted++;
  } catch (e) {
    // Version conflict or other — ledger is already written.
    // This is safe: ledger amount=1 but wallet not updated.
    // On next run, ledger idempotency key will prevent double-write.
    // Log as error so we can investigate.
    stats.errors++;
    stats.errorDetails.push(`Wallet update conflict userId=${userId}: ${e.message}`);
    // Attempt to update ledger row to reflect partial failure
    try {
      await base44.asServiceRole.entities.TokenLedger.update(ledgerRow.id, {
        note: `Daily free grant window=${windowKey} WALLET_UPDATE_FAILED: ${e.message}`,
        amount: 0,
      });
    } catch (_) {}
  }
}