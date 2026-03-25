// Diagnostic: check what Finnhub actually returns for specific symbols & date ranges
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const symbol = body.symbol || 'MSFT';

    const today = new Date().toISOString().slice(0, 10);
    const in5weeks = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
    const in10weeks = new Date(Date.now() + 70 * 86400000).toISOString().slice(0, 10);

    // Test 1: general calendar, next 5 weeks
    const r1 = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${in5weeks}&token=${FINNHUB_KEY}`);
    const d1 = await r1.json();
    const all5w = d1?.earningsCalendar || [];

    // Test 2: symbol-specific lookup (no date filter)
    const r2 = await fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${symbol}&token=${FINNHUB_KEY}`);
    const d2 = await r2.json();
    const symbolSpecific = d2?.earningsCalendar || [];

    // Test 3: extended range (10 weeks) - will Finnhub return more?
    const r3 = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${in10weeks}&token=${FINNHUB_KEY}`);
    const d3 = await r3.json();
    const all10w = d3?.earningsCalendar || [];

    // Test 4: Basic financials for MSFT (has nextEarningsDate sometimes)
    const r4 = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_KEY}`);
    const d4 = await r4.json();

    // Test 5: EPS surprise history for MSFT
    const r5 = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=4&token=${FINNHUB_KEY}`);
    const d5 = await r5.json();

    const msftIn5w = all5w.filter(e => e.symbol === symbol);
    const msftIn10w = all10w.filter(e => e.symbol === symbol);

    // What dates does Finnhub cover (5w)?
    const datesIn5w = [...new Set(all5w.map(e => e.date))].sort();
    const datesIn10w = [...new Set(all10w.map(e => e.date))].sort();

    return Response.json({
      today,
      ranges: { in5weeks, in10weeks },
      results: {
        msft_in_5w_calendar: msftIn5w,
        msft_in_10w_calendar: msftIn10w,
        msft_symbol_specific: symbolSpecific,
        msft_basic_financials_keys: Object.keys(d4?.metric || {}).filter(k => k.toLowerCase().includes('earn') || k.toLowerCase().includes('eps')),
        msft_eps_history: d5,
        total_companies_5w: all5w.length,
        total_companies_10w: all10w.length,
        dates_returned_5w: datesIn5w,
        dates_returned_10w: datesIn10w,
        last_date_5w: datesIn5w[datesIn5w.length - 1],
        last_date_10w: datesIn10w[datesIn10w.length - 1],
      }
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});