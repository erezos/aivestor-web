import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, TrendingDown, Star, Share2, Zap, BarChart3, Activity, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const ASSET_DATA = {
  'NVDA': { name: 'NVIDIA Corp', price: 892.45, change: 5.67, sector: 'Technology', marketCap: '2.2T', pe: 68.5, volume: '89.2M', high52: 974.94, low52: 394.36 },
  'TSLA': { name: 'Tesla Inc', price: 248.32, change: 3.21, sector: 'Auto', marketCap: '789B', pe: 72.3, volume: '124.5M', high52: 299.29, low52: 138.80 },
  'AAPL': { name: 'Apple Inc', price: 198.76, change: 1.45, sector: 'Technology', marketCap: '3.1T', pe: 31.2, volume: '67.3M', high52: 237.49, low52: 164.08 },
  'BTC': { name: 'Bitcoin', price: 97432, change: -2.14, sector: 'Crypto', marketCap: '1.9T', pe: '-', volume: '48.9B', high52: 108786, low52: 38505 },
  'MSFT': { name: 'Microsoft Corp', price: 445.23, change: 2.34, sector: 'Technology', marketCap: '3.3T', pe: 36.8, volume: '32.8M', high52: 468.35, low52: 362.90 },
};

const DEFAULT_ASSET = { name: 'Unknown', price: 100, change: 0, sector: '-', marketCap: '-', pe: '-', volume: '-', high52: 0, low52: 0 };

const TIME_RANGES = ['1D', '1W', '1M', '3M', '1Y', 'All'];

function generateChartData(range, positive) {
  const points = { '1D': 24, '1W': 7, '1M': 30, '3M': 90, '1Y': 52, 'All': 100 }[range] || 30;
  let val = 100;
  return Array.from({ length: points }, (_, i) => {
    val += (Math.random() - (positive ? 0.4 : 0.6)) * 3;
    return { x: i, price: Math.max(50, val) };
  });
}

const AI_ANALYSIS = {
  signal: 'Buy',
  confidence: 82,
  summary: 'Strong bullish momentum with RSI approaching overbought territory. MACD crossover suggests continuation of upward trend. Volume confirms buying pressure.',
  indicators: [
    { name: 'RSI (14)', value: '68.5', signal: 'Neutral' },
    { name: 'MACD', value: 'Bullish Cross', signal: 'Buy' },
    { name: 'Bollinger Bands', value: 'Upper Band', signal: 'Caution' },
    { name: 'SMA 50/200', value: 'Golden Cross', signal: 'Strong Buy' },
    { name: 'Volume', value: 'Above Avg', signal: 'Buy' },
    { name: 'Stochastic', value: '72.3', signal: 'Neutral' },
  ],
};

function getSignalColor(signal) {
  if (signal === 'Strong Buy' || signal === 'Buy') return 'text-emerald-400';
  if (signal === 'Neutral' || signal === 'Hold') return 'text-amber-400';
  if (signal === 'Caution') return 'text-orange-400';
  return 'text-rose-400';
}

export default function Asset() {
  const urlParams = new URLSearchParams(window.location.search);
  const symbol = urlParams.get('symbol') || 'AAPL';
  const asset = ASSET_DATA[symbol] || DEFAULT_ASSET;
  const positive = asset.change >= 0;
  const [timeRange, setTimeRange] = useState('1M');
  const chartData = useMemo(() => generateChartData(timeRange, positive), [timeRange, positive]);

  return (
    <div className="space-y-5 pb-20 md:pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/Dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white/60 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-white/5 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-300">{symbol.slice(0,2)}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{symbol}</h1>
                <p className="text-sm text-white/30">{asset.name} • {asset.sector}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg glass glass-hover"><Star className="w-4 h-4 text-white/40" /></button>
            <button className="p-2 rounded-lg glass glass-hover"><Share2 className="w-4 h-4 text-white/40" /></button>
          </div>
        </div>
        
        {/* Price */}
        <div className="mt-4">
          <span className="text-4xl font-bold text-white">${asset.price.toLocaleString()}</span>
          <div className={`flex items-center gap-1 mt-1 text-sm font-semibold ${positive ? 'text-gain' : 'text-loss'}`}>
            {positive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {positive ? '+' : ''}{asset.change}%
          </div>
        </div>
      </motion.div>

      {/* Chart */}
      <div className="glass rounded-2xl p-5">
        <div className="flex gap-2 mb-4">
          {TIME_RANGES.map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                timeRange === r ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-white/30 hover:text-white/50'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={positive ? '#10B981' : '#F43F5E'} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={positive ? '#10B981' : '#F43F5E'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="x" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                labelStyle={{ color: 'rgba(255,255,255,0.4)' }}
                formatter={(val) => [`$${val.toFixed(2)}`, 'Price']}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={positive ? '#10B981' : '#F43F5E'}
                strokeWidth={2}
                fill="url(#chartGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Analysis */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white/80">AI Analysis</h3>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="glass rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-emerald-400">{AI_ANALYSIS.signal}</div>
              <div className="text-[10px] text-white/30">Signal</div>
            </div>
            <div className="glass rounded-xl px-4 py-2 text-center">
              <div className="text-lg font-bold text-violet-400">{AI_ANALYSIS.confidence}%</div>
              <div className="text-[10px] text-white/30">Confidence</div>
            </div>
          </div>

          <p className="text-xs text-white/50 leading-relaxed mb-4">{AI_ANALYSIS.summary}</p>

          <div className="space-y-2">
            {AI_ANALYSIS.indicators.map(ind => (
              <div key={ind.name} className="flex items-center justify-between py-1.5 border-b border-white/3">
                <span className="text-xs text-white/40">{ind.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/60 font-medium">{ind.value}</span>
                  <span className={`text-[10px] font-semibold ${getSignalColor(ind.signal)}`}>{ind.signal}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Stats */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white/80">Key Statistics</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Market Cap', value: asset.marketCap },
              { label: 'P/E Ratio', value: asset.pe },
              { label: 'Volume', value: asset.volume },
              { label: '52W High', value: `$${asset.high52.toLocaleString()}` },
              { label: '52W Low', value: `$${asset.low52.toLocaleString()}` },
              { label: 'Sector', value: asset.sector },
            ].map(stat => (
              <div key={stat.label} className="glass rounded-xl p-3">
                <div className="text-[10px] text-white/30 mb-1">{stat.label}</div>
                <div className="text-sm font-semibold text-white">{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        className="glass rounded-2xl p-5 text-center border border-violet-500/10"
      >
        <p className="text-xs text-white/30 mb-3">Want to trade {symbol}?</p>
        <a
          href="https://www.zulutrade.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Trade on ZuluTrade
          <TrendingUp className="w-4 h-4" />
        </a>
      </motion.div>
    </div>
  );
}