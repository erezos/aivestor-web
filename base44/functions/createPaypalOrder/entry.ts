import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const PAYPAL_BASE = 'https://api-m.paypal.com';

async function getAccessToken() {
  const creds = btoa(`${Deno.env.get('PAYPAL_CLIENT_ID')}:${Deno.env.get('PAYPAL_SECRET')}`);
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('PayPal auth failed');
  return json.access_token;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { packId, tokens, price, returnUrl } = await req.json();
    if (!packId || !tokens || !price || !returnUrl) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const accessToken = await getAccessToken();

    const order = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'USD', value: price.toFixed(2) },
          description: `AIVestor - ${tokens} AI Tokens (${packId})`,
          custom_id: `${user.id}|${packId}|${tokens}`,
        }],
        application_context: {
          brand_name: 'AIVestor',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${returnUrl}?paypal_order_id=PLACEHOLDER&pack_id=${packId}&pack_tokens=${tokens}`,
          cancel_url: `${returnUrl}?paypal_cancelled=1`,
        },
      }),
    });

    const orderJson = await order.json();
    if (!orderJson.id) throw new Error('Failed to create PayPal order: ' + JSON.stringify(orderJson));

    const approvalUrl = orderJson.links.find(l => l.rel === 'approve')?.href;
    return Response.json({ orderId: orderJson.id, approvalUrl });

  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
});