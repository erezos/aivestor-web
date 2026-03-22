import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const FINNHUB_KEY = Deno.env.get('FINNHUB_API_KEY');

// MIC (Market Identifier Code) → { country, flag }
const MIC_MAP = {
  // United States
  XNYS: { country: 'US', flag: '🇺🇸' }, XNAS: { country: 'US', flag: '🇺🇸' },
  ARCX: { country: 'US', flag: '🇺🇸' }, BATS: { country: 'US', flag: '🇺🇸' },
  XNMS: { country: 'US', flag: '🇺🇸' }, XNCM: { country: 'US', flag: '🇺🇸' },
  XNGS: { country: 'US', flag: '🇺🇸' }, XCHI: { country: 'US', flag: '🇺🇸' },
  // United Kingdom
  XLON: { country: 'UK', flag: '🇬🇧' }, XAIM: { country: 'UK', flag: '🇬🇧' },
  // Japan
  XTKS: { country: 'JP', flag: '🇯🇵' }, XOSE: { country: 'JP', flag: '🇯🇵' },
  XNGO: { country: 'JP', flag: '🇯🇵' }, XSAP: { country: 'JP', flag: '🇯🇵' },
  // Hong Kong
  XHKG: { country: 'HK', flag: '🇭🇰' },
  // China
  XSHG: { country: 'CN', flag: '🇨🇳' }, XSHE: { country: 'CN', flag: '🇨🇳' },
  // Germany
  XFRA: { country: 'DE', flag: '🇩🇪' }, XETR: { country: 'DE', flag: '🇩🇪' },
  XMUN: { country: 'DE', flag: '🇩🇪' }, XBER: { country: 'DE', flag: '🇩🇪' },
  XHAM: { country: 'DE', flag: '🇩🇪' }, XSTU: { country: 'DE', flag: '🇩🇪' },
  // France
  XPAR: { country: 'FR', flag: '🇫🇷' },
  // Netherlands
  XAMS: { country: 'NL', flag: '🇳🇱' },
  // Switzerland
  XSWX: { country: 'CH', flag: '🇨🇭' }, XVTX: { country: 'CH', flag: '🇨🇭' },
  // Canada
  XTSE: { country: 'CA', flag: '🇨🇦' }, XTSX: { country: 'CA', flag: '🇨🇦' },
  XATS: { country: 'CA', flag: '🇨🇦' }, XCNQ: { country: 'CA', flag: '🇨🇦' },
  // Australia
  XASX: { country: 'AU', flag: '🇦🇺' }, XSFE: { country: 'AU', flag: '🇦🇺' },
  // India
  XBOM: { country: 'IN', flag: '🇮🇳' }, XNSE: { country: 'IN', flag: '🇮🇳' },
  // South Korea
  XKRX: { country: 'KR', flag: '🇰🇷' }, XKOS: { country: 'KR', flag: '🇰🇷' },
  // Brazil
  BVMF: { country: 'BR', flag: '🇧🇷' }, XBRA: { country: 'BR', flag: '🇧🇷' },
  // Mexico
  XMEX: { country: 'MX', flag: '🇲🇽' },
  // Spain
  XMAD: { country: 'ES', flag: '🇪🇸' }, XBAR: { country: 'ES', flag: '🇪🇸' },
  // Italy
  XMIL: { country: 'IT', flag: '🇮🇹' },
  // Sweden
  XSTO: { country: 'SE', flag: '🇸🇪' },
  // Norway
  XOSL: { country: 'NO', flag: '🇳🇴' }, XOME: { country: 'NO', flag: '🇳🇴' },
  // Denmark
  XCOP: { country: 'DK', flag: '🇩🇰' },
  // Finland
  XHEL: { country: 'FI', flag: '🇫🇮' },
  // Belgium
  XBRU: { country: 'BE', flag: '🇧🇪' },
  // Portugal
  XLIS: { country: 'PT', flag: '🇵🇹' },
  // Poland
  XWAR: { country: 'PL', flag: '🇵🇱' },
  // Turkey
  XIST: { country: 'TR', flag: '🇹🇷' },
  // Greece
  XATH: { country: 'GR', flag: '🇬🇷' },
  // Russia
  MISX: { country: 'RU', flag: '🇷🇺' }, RTSX: { country: 'RU', flag: '🇷🇺' },
  // Singapore
  XSES: { country: 'SG', flag: '🇸🇬' },
  // Taiwan
  XTAI: { country: 'TW', flag: '🇹🇼' },
  // Israel
  XTAE: { country: 'IL', flag: '🇮🇱' },
  // South Africa
  XJSE: { country: 'ZA', flag: '🇿🇦' },
  // Saudi Arabia
  XSAU: { country: 'SA', flag: '🇸🇦' },
  // UAE
  XDFM: { country: 'AE', flag: '🇦🇪' }, XADS: { country: 'AE', flag: '🇦🇪' },
  // Argentina
  XBUE: { country: 'AR', flag: '🇦🇷' },
  // Thailand
  XBKK: { country: 'TH', flag: '🇹🇭' },
  // Malaysia
  XKLS: { country: 'MY', flag: '🇲🇾' },
  // Indonesia
  XIDX: { country: 'ID', flag: '🇮🇩' },
  // New Zealand
  XNZE: { country: 'NZ', flag: '🇳🇿' },
  // Austria
  XWBO: { country: 'AT', flag: '🇦🇹' },
  // Czech Republic
  XPRA: { country: 'CZ', flag: '🇨🇿' },
  // Hungary
  XBUD: { country: 'HU', flag: '🇭🇺' },
};

const CRYPTO_LIST = [
  { symbol: 'BTC', name: 'Bitcoin', asset_type: 'crypto', flag: '₿', country: 'Crypto' },
  { symbol: 'ETH', name: 'Ethereum', asset_type: 'crypto', flag: '⟠', country: 'Crypto' },
  { symbol: 'SOL', name: 'Solana', asset_type: 'crypto', flag: '◎', country: 'Crypto' },
  { symbol: 'XRP', name: 'Ripple', asset_type: 'crypto', flag: '✕', country: 'Crypto' },
  { symbol: 'BNB', name: 'BNB', asset_type: 'crypto', flag: '🔶', country: 'Crypto' },
  { symbol: 'ADA', name: 'Cardano', asset_type: 'crypto', flag: '₳', country: 'Crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', asset_type: 'crypto', flag: 'Ð', country: 'Crypto' },
  { symbol: 'AVAX', name: 'Avalanche', asset_type: 'crypto', flag: '🔺', country: 'Crypto' },
  { symbol: 'DOT', name: 'Polkadot', asset_type: 'crypto', flag: '●', country: 'Crypto' },
  { symbol: 'LINK', name: 'Chainlink', asset_type: 'crypto', flag: '⬡', country: 'Crypto' },
  { symbol: 'MATIC', name: 'Polygon', asset_type: 'crypto', flag: '⬟', country: 'Crypto' },
  { symbol: 'UNI', name: 'Uniswap', asset_type: 'crypto', flag: '🦄', country: 'Crypto' },
  { symbol: 'LTC', name: 'Litecoin', asset_type: 'crypto', flag: 'Ł', country: 'Crypto' },
  { symbol: 'ATOM', name: 'Cosmos', asset_type: 'crypto', flag: '⚛', country: 'Crypto' },
  { symbol: 'NEAR', name: 'NEAR Protocol', asset_type: 'crypto', flag: 'Ⓝ', country: 'Crypto' },
  { symbol: 'APT', name: 'Aptos', asset_type: 'crypto', flag: '◈', country: 'Crypto' },
  { symbol: 'OP', name: 'Optimism', asset_type: 'crypto', flag: '🔴', country: 'Crypto' },
  { symbol: 'ARB', name: 'Arbitrum', asset_type: 'crypto', flag: '🔵', country: 'Crypto' },
  { symbol: 'SUI', name: 'Sui', asset_type: 'crypto', flag: '◆', country: 'Crypto' },
  { symbol: 'TON', name: 'Toncoin', asset_type: 'crypto', flag: '💎', country: 'Crypto' },
  { symbol: 'PEPE', name: 'Pepe', asset_type: 'crypto', flag: '🐸', country: 'Crypto' },
  { symbol: 'INJ', name: 'Injective', asset_type: 'crypto', flag: '◉', country: 'Crypto' },
  { symbol: 'FIL', name: 'Filecoin', asset_type: 'crypto', flag: '⊕', country: 'Crypto' },
  { symbol: 'ICP', name: 'Internet Computer', asset_type: 'crypto', flag: '∞', country: 'Crypto' },
  { symbol: 'WIF', name: 'Dogwifhat', asset_type: 'crypto', flag: '🎩', country: 'Crypto' },
  { symbol: 'TRX', name: 'TRON', asset_type: 'crypto', flag: '◬', country: 'Crypto' },
  { symbol: 'SHIB', name: 'Shiba Inu', asset_type: 'crypto', flag: '🐕', country: 'Crypto' },
  { symbol: 'BCH', name: 'Bitcoin Cash', asset_type: 'crypto', flag: '₿', country: 'Crypto' },
  { symbol: 'HBAR', name: 'Hedera', asset_type: 'crypto', flag: 'ℏ', country: 'Crypto' },
  { symbol: 'VET', name: 'VeChain', asset_type: 'crypto', flag: 'V', country: 'Crypto' },
];

const POPULAR_DEFAULTS = [
  { symbol: 'AAPL', name: 'Apple Inc', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'NVDA', name: 'NVIDIA Corp', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'TSLA', name: 'Tesla Inc', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'MSFT', name: 'Microsoft Corp', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'AMZN', name: 'Amazon.com', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'META', name: 'Meta Platforms', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'GOOGL', name: 'Alphabet Inc', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'JPM', name: 'JPMorgan Chase', asset_type: 'stock', flag: '🇺🇸', country: 'US' },
  { symbol: 'BTC', name: 'Bitcoin', asset_type: 'crypto', flag: '₿', country: 'Crypto' },
  { symbol: 'ETH', name: 'Ethereum', asset_type: 'crypto', flag: '⟠', country: 'Crypto' },
  { symbol: 'SOL', name: 'Solana', asset_type: 'crypto', flag: '◎', country: 'Crypto' },
];

Deno.serve(async (req) => {
  try {
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
      .map(r => {
        const mic = r.primaryExchange || r.mic || '';
        const location = MIC_MAP[mic] || { country: '', flag: '🌐' };
        return {
          symbol: r.displaySymbol,
          name: r.description,
          asset_type: ['ETP', 'ETF'].includes(r.type) ? 'etf' : 'stock',
          flag: location.flag,
          country: location.country,
          mic,
        };
      });

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