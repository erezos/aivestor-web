/**
 * syncWatchlist — Shadow-syncs a user's localStorage watchlist to the DB.
 * Called fire-and-forget from the frontend; never blocks UX.
 * Used for analytics only — not surfaced to users.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, reason: 'unauthenticated' });

    const { items } = await req.json();
    if (!Array.isArray(items)) return Response.json({ ok: false, reason: 'bad payload' });

    // Delete all existing DB watchlist rows for this user
    const existing = await base44.entities.Watchlist.filter({ created_by: user.email });
    await Promise.all(existing.map(r => base44.entities.Watchlist.delete(r.id)));

    // Bulk-insert current snapshot
    if (items.length > 0) {
      await base44.entities.Watchlist.bulkCreate(
        items.map((item, idx) => ({
          symbol: item.symbol,
          name: item.name,
          asset_type: item.asset_type || 'stock',
          sort_order: idx + 1,
        }))
      );
    }

    return Response.json({ ok: true, synced: items.length });
  } catch (error) {
    // Silently swallow — this is analytics-only
    return Response.json({ ok: false, error: error.message });
  }
});