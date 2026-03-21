import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

const CRYPTO_LIST = [
  { symbol: 'BTC', name: 'Bitcoin', asset_type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', asset_type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', asset_type: 'crypto' },
  { symbol: 'XRP', name: 'Ripple', asset_type: 'crypto' },
  { symbol: 'BNB', name: 'BNB', asset_type: 'crypto' },
  { symbol: 'ADA', name: 'Cardano', asset_type: 'crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', asset_type: 'crypto' },
  { symbol: 'AVAX', name: 'Avalanche', asset_type: 'crypto' },
  { symbol: 'DOT', name: 'Polkadot', asset_type: 'crypto' },
  { symbol: 'LINK', name: 'Chainlink', asset_type: 'crypto' },
  { symbol: 'MATIC', name: 'Polygon', asset_type: 'crypto' },
  { symbol: 'UNI', name: 'Uniswap', asset_type: 'crypto' },
  { symbol: 'LTC', name: 'Litecoin', asset_type: 'crypto' },
  { symbol: 'ATOM', name: 'Cosmos', asset_type: 'crypto' },
  { symbol: 'NEAR', name: 'NEAR Protocol', asset_type: 'crypto' },
  { symbol: 'APT', name: 'Aptos', asset_type: 'crypto' },
  { symbol: 'OP', name: 'Optimism', asset_type: 'crypto' },
  { symbol: 'ARB', name: 'Arbitrum', asset_type: 'crypto' },
  { symbol: 'SUI', name: 'Sui', asset_type: 'crypto' },
  { symbol: 'TON', name: 'Toncoin', asset_type: 'crypto' },
  { symbol: 'PEPE', name: 'Pepe', asset_type: 'crypto' },
  { symbol: 'INJ', name: 'Injective', asset_type: 'crypto' },
  { symbol: 'FIL', name: 'Filecoin', asset_type: 'crypto' },
  { symbol: 'ICP', name: 'Internet Computer', asset_type: 'crypto' },
  { symbol: 'WIF', name: 'Dogwifhat', asset_type: 'crypto' },
  { symbol: 'TRX', name: 'TRON', asset_type: 'crypto' },
  { symbol: 'SHIB', name: 'Shiba Inu', asset_type: 'crypto' },
  { symbol: 'BCH', name: 'Bitcoin Cash', asset_type: 'crypto' },
  { symbol: 'HBAR', name: 'Hedera', asset_type: 'crypto' },
  { symbol: 'VET', name: 'VeChain', asset_type: 'crypto' },
];

const POPULAR_DEFAULTS = [
  { symbol: 'AAPL', name: 'Apple Inc', asset_type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', asset_type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc', asset_type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp', asset_type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com', asset_type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', asset_type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', asset_type: 'stock' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', asset_type: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', asset_type: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', asset_type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', asset_type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', asset_type: 'crypto' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { query } = await req.json();

    if (!query || query.trim().length < 1) {
      return Response.json({ results: POPULAR_DEFAULTS });
    }

    const q = query.trim().toUpperCase();

    // Crypto: prefix match first, then name match
    const cryptoResults = CRYPTO_LIST.filter(c =>
      c.symbol.startsWith(q) || c.name.toUpperCase().includes(q)
    );

    // Finnhub stock search
    const finnhubRes = await fetch(
      `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_KEY}`
    );
    const finnhubData = await finnhubRes.json();

    const stockResults = (finnhubData.result || [])
      .filter(r => ['Common Stock', 'ETP', 'ETF'].includes(r.type) && r.displaySymbol)
      .slice(0, 15)
      .map(r => ({
        symbol: r.displaySymbol,
        name: r.description,
        asset_type: 'stock',
      }));

    // Crypto first, then stocks, dedup by symbol
    const seen = new Set();
    const combined = [...cryptoResults, ...stockResults].filter(a => {
      if (seen.has(a.symbol)) return false;
      seen.add(a.symbol);
      return true;
    }).slice(0, 20);

    return Response.json({ results: combined });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});