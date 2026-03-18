import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { symbol, recent, currentPrice, sma20, rsi } = await req.json();

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Professional technical analyst. Last 30 closes for ${symbol}: ${JSON.stringify(recent)}. Current: ${currentPrice}, SMA20: ${sma20}, RSI(14): ${rsi}. Provide: summary (2 sentences), signal (Strong Buy/Buy/Hold/Sell/Strong Sell), enableIndicators (array from ["sma20","sma50","rsi"]), markers (up to 3: [{time: unix_ts from provided data, position: "belowBar"|"aboveBar", color: "#hex", shape: "arrowUp"|"arrowDown", text: "label"}]), supportLevel (number or null), resistanceLevel (number or null).`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary:          { type: 'string' },
          signal:           { type: 'string' },
          enableIndicators: { type: 'array', items: { type: 'string' } },
          markers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time:     { type: 'number' },
                position: { type: 'string' },
                color:    { type: 'string' },
                shape:    { type: 'string' },
                text:     { type: 'string' },
              }
            }
          },
          supportLevel:    { type: 'number' },
          resistanceLevel: { type: 'number' },
        }
      }
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});