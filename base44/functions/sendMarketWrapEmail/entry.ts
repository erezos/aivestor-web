/**
 * sendMarketWrapEmail — Sends today's market wrap to all subscribers.
 * Called by the "Daily Market Wrap Generation" automation after generateMarketWrap runs,
 * OR triggered manually.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23'; // aivestor.online

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split('T')[0];
    const key = `market_wrap_${today}`;

    // Load today's wrap — if missing, generate it on the fly
    let wrapRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
    if (!wrapRows.length || !wrapRows[0].data) {
      console.log("Wrap not found, generating on the fly...");
      await base44.asServiceRole.functions.invoke('generateMarketWrap', {});
      wrapRows = await base44.asServiceRole.entities.CachedData.filter({ cache_key: key });
    }
    if (!wrapRows.length || !wrapRows[0].data) {
      return Response.json({ error: "Failed to generate today's market wrap." }, { status: 500 });
    }
    const wrap = JSON.parse(wrapRows[0].data);

    // Load all subscribers
    const subscribers = await base44.asServiceRole.entities.EmailSubscriber.list();
    if (!subscribers.length) {
      return Response.json({ sent: 0, message: 'No subscribers.' });
    }

    const formattedDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const topMovers = (wrap.top_movers || []).slice(0, 5)
      .map(m => `${m.positive ? '▲' : '▼'} ${m.symbol} ${m.change}`)
      .join('  ·  ');

    const emailBody = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d14; color: #ffffff; border-radius: 16px; overflow: hidden;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #6d28d9, #9333ea); padding: 28px 32px 20px;">
    <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.2em; color: rgba(255,255,255,0.6); text-transform: uppercase; margin-bottom: 4px;">AIVestor Daily</div>
    <div style="font-size: 12px; color: rgba(255,255,255,0.4);">${formattedDate}</div>
  </div>

  <!-- Headline -->
  <div style="padding: 28px 32px 16px;">
    <h1 style="margin: 0 0 12px; font-size: 26px; font-weight: 900; line-height: 1.2; color: #ffffff;">${wrap.headline}</h1>
    <p style="margin: 0; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.55);">${wrap.intro_paragraph}</p>
  </div>

  ${topMovers ? `
  <!-- Top Movers -->
  <div style="margin: 0 32px; padding: 12px 16px; background: rgba(255,255,255,0.05); border-radius: 12px; font-size: 12px; color: rgba(255,255,255,0.5);">
    <span style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; color: rgba(255,255,255,0.25);">Top Movers &nbsp;&nbsp;</span>${topMovers}
  </div>` : ''}

  <!-- Sections -->
  ${wrap.equities_section ? `
  <div style="padding: 20px 32px 0;">
    <div style="border-left: 3px solid #10b981; padding-left: 14px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #10b981; margin-bottom: 6px;">Equities</div>
      <p style="margin: 0; font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.65);">${wrap.equities_section}</p>
    </div>
  </div>` : ''}

  ${wrap.crypto_section ? `
  <div style="padding: 20px 32px 0;">
    <div style="border-left: 3px solid #f59e0b; padding-left: 14px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #f59e0b; margin-bottom: 6px;">Crypto</div>
      <p style="margin: 0; font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.65);">${wrap.crypto_section}</p>
    </div>
  </div>` : ''}

  ${wrap.macro_outlook ? `
  <div style="padding: 20px 32px 0;">
    <div style="border-left: 3px solid #3b82f6; padding-left: 14px;">
      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #3b82f6; margin-bottom: 6px;">Macro Outlook</div>
      <p style="margin: 0; font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.65);">${wrap.macro_outlook}</p>
    </div>
  </div>` : ''}

  ${wrap.ai_insight ? `
  <div style="margin: 20px 32px 0; padding: 16px 20px; background: linear-gradient(135deg, rgba(109,40,217,0.15), rgba(147,51,234,0.1)); border: 1px solid rgba(147,51,234,0.3); border-radius: 12px;">
    <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #c084fc; margin-bottom: 8px;">⚡ AI Insight</div>
    <p style="margin: 0; font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.8); font-style: italic;">"${wrap.ai_insight}"</p>
  </div>` : ''}

  <!-- CTA -->
  <div style="padding: 28px 32px; text-align: center;">
    <a href="https://aivestor.online/MarketWrap" style="display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #6d28d9, #9333ea); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; border-radius: 12px;">Read Full Wrap → AIVestor</a>
  </div>

  <!-- Footer -->
  <div style="padding: 16px 32px 24px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center;">
    <p style="margin: 0; font-size: 11px; color: rgba(255,255,255,0.2);">You're receiving this because you subscribed to AIVestor Daily Market Wrap.<br>This is not financial advice.</p>
  </div>

</div>
`.trim();

    // Send to each subscriber
    let sent = 0;
    const errors = [];
    for (const sub of subscribers) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: sub.email,
          from_name: 'AIVestor Daily',
          subject: `📊 ${wrap.headline}`,
          body: emailBody,
        });
        sent++;
      } catch (e) {
        errors.push({ email: sub.email, error: e.message });
      }
    }

    return Response.json({ success: true, sent, total: subscribers.length, errors });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});