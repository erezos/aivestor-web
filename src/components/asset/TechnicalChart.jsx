import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { Zap, Loader2, TrendingUp, BarChart2, Activity } from 'lucide-react';
import { base44 } from '@/api/base44Client';

import { base44 } from '@/api/base44Client';

async function fetchCandles(symbol, range = '3mo') {
  const res = await base44.functions.invoke('getChartData', { symbol, range });
  return res.data || [];
}

function calcSMA(candles, period) {
  const result = [];
  for (let i = period - 1; i < candles.length; i++) {
    const avg = candles.slice(i - period + 1, i + 1).reduce((s, c) => s + c.close, 0) / period;
    result.push({ time: candles[i].time, value: parseFloat(avg.toFixed(4)) });
  }
  return result;
}

function calcRSI(candles, period = 14) {
  const result = [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: candles[i].time, value: parseFloat((100 - 100 / (1 + rs)).toFixed(2)) });
  }
  return result;
}

const RANGES = [
  { label: '1D', range: '1d' },
  { label: '1W', range: '5d' },
  { label: '1M', range: '1mo' },
  { label: '3M', range: '3mo' },
  { label: '1Y', range: '1y' },
];

const CHART_THEME = {
  layout: { background: { color: 'transparent' }, textColor: 'rgba(255,255,255,0.4)' },
  grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
  crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(124,58,237,0.5)' }, horzLine: { color: 'rgba(124,58,237,0.5)' } },
  timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
  rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
};

export default function TechnicalChart({ symbol }) {
  const mainRef = useRef(null);
  const rsiRef = useRef(null);
  const chartMain = useRef(null);
  const chartRsi = useRef(null);
  const seriesRefs = useRef({});

  const [candles, setCandles] = useState([]);
  const [range, setRange] = useState('3mo');
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState({ sma20: false, sma50: false, rsi: false });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  // ── Build / rebuild charts ───────────────────────────────────────────────
  const buildCharts = useCallback((candleData) => {
    if (!mainRef.current) return;

    // Destroy old instances
    if (chartMain.current) { try { chartMain.current.remove(); } catch {} chartMain.current = null; }
    if (chartRsi.current) { try { chartRsi.current.remove(); } catch {} chartRsi.current = null; }
    seriesRefs.current = {};

    // Main chart
    const main = createChart(mainRef.current, {
      ...CHART_THEME,
      width: mainRef.current.clientWidth,
      height: 320,
    });
    chartMain.current = main;

    // Candlestick series
    const cs = main.addCandlestickSeries({
      upColor: '#10B981', downColor: '#F43F5E',
      borderUpColor: '#10B981', borderDownColor: '#F43F5E',
      wickUpColor: '#10B981', wickDownColor: '#F43F5E',
    });
    cs.setData(candleData);
    seriesRefs.current.candles = cs;

    // Volume
    const vol = main.addHistogramSeries({
      color: 'rgba(124,58,237,0.2)',
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    vol.setData(candleData.map(c => ({
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
    })));
    seriesRefs.current.volume = vol;

    main.timeScale().fitContent();

    // RSI chart (always present, hidden if !indicators.rsi)
    if (rsiRef.current) {
      const rsiChart = createChart(rsiRef.current, {
        ...CHART_THEME,
        width: rsiRef.current.clientWidth,
        height: 120,
      });
      chartRsi.current = rsiChart;
      const rsiSeries = rsiChart.addLineSeries({ color: '#A78BFA', lineWidth: 1.5, priceLineVisible: false });
      rsiSeries.setData(calcRSI(candleData));
      // overbought / oversold lines
      const ob = rsiChart.addLineSeries({ color: 'rgba(244,63,94,0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      ob.setData(candleData.slice(14).map(c => ({ time: c.time, value: 70 })));
      const os = rsiChart.addLineSeries({ color: 'rgba(16,185,129,0.4)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });
      os.setData(candleData.slice(14).map(c => ({ time: c.time, value: 30 })));
      seriesRefs.current.rsi = rsiSeries;
      rsiChart.timeScale().fitContent();

      // Sync crosshair
      main.subscribeCrosshairMove(p => {
        if (p?.time) rsiChart.setCrosshairPosition(p.seriesData.get(cs)?.close ?? 0, p.time, rsiSeries);
      });
    }

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (mainRef.current) main.applyOptions({ width: mainRef.current.clientWidth });
      if (rsiRef.current && chartRsi.current) chartRsi.current.applyOptions({ width: rsiRef.current.clientWidth });
    });
    if (mainRef.current) ro.observe(mainRef.current);

    return () => ro.disconnect();
  }, []);

  // ── Toggle indicator overlays ────────────────────────────────────────────
  const applyIndicators = useCallback((candleData, inds) => {
    if (!chartMain.current || !candleData.length) return;
    const main = chartMain.current;

    // SMA20
    if (inds.sma20 && !seriesRefs.current.sma20) {
      const s = main.addLineSeries({ color: '#FBBF24', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcSMA(candleData, 20));
      seriesRefs.current.sma20 = s;
    } else if (!inds.sma20 && seriesRefs.current.sma20) {
      main.removeSeries(seriesRefs.current.sma20);
      delete seriesRefs.current.sma20;
    }

    // SMA50
    if (inds.sma50 && !seriesRefs.current.sma50) {
      const s = main.addLineSeries({ color: '#60A5FA', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
      s.setData(calcSMA(candleData, 50));
      seriesRefs.current.sma50 = s;
    } else if (!inds.sma50 && seriesRefs.current.sma50) {
      main.removeSeries(seriesRefs.current.sma50);
      delete seriesRefs.current.sma50;
    }
  }, []);

  // ── RSI visibility ───────────────────────────────────────────────────────
  useEffect(() => {
    // RSI chart visibility is controlled via display style on the container
  }, [indicators.rsi]);

  // ── Load candles ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAiInsight(null);
    fetchCandles(symbol, range).then(data => {
      if (cancelled || !data.length) return;
      setCandles(data);
      setLoading(false);
      setIndicators(prev => {
        buildCharts(data);
        // Re-apply active indicators after rebuild
        setTimeout(() => applyIndicators(data, prev), 0);
        return prev;
      });
    }).catch(() => setLoading(false));
    return () => { cancelled = true; };
  }, [symbol, range]);

  // ── Indicator toggles ────────────────────────────────────────────────────
  const toggleIndicator = (key) => {
    setIndicators(prev => {
      const next = { ...prev, [key]: !prev[key] };
      applyIndicators(candles, next);
      return next;
    });
  };

  // ── AI Magic Analysis ────────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    if (!candles.length) return;
    setAiLoading(true);
    setAiInsight(null);

    // Send last 30 closes to AI (minimal tokens)
    const recent = candles.slice(-30).map(c => ({ t: c.time, c: c.close }));
    const last = candles[candles.length - 1];
    const sma20val = calcSMA(candles, 20).slice(-1)[0]?.value;
    const rsiVal = calcRSI(candles).slice(-1)[0]?.value;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a professional technical analyst. Given these last 30 daily closes for ${symbol}:
${JSON.stringify(recent)}
Current price: ${last.close}, SMA20: ${sma20val?.toFixed(2)}, RSI(14): ${rsiVal?.toFixed(2)}

Provide a concise technical analysis. Return:
- summary: 2-sentence insight
- signal: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"
- enableIndicators: array of indicators to highlight (from: ["sma20","sma50","rsi"])
- markers: up to 3 key chart markers as [{time: unix_timestamp (pick from the provided timestamps), position: "belowBar"|"aboveBar", color: "#hex", shape: "arrowUp"|"arrowDown", text: "label"}]
- supportLevel: price number or null
- resistanceLevel: price number or null`,
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          signal: { type: 'string' },
          enableIndicators: { type: 'array', items: { type: 'string' } },
          markers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                time: { type: 'number' },
                position: { type: 'string' },
                color: { type: 'string' },
                shape: { type: 'string' },
                text: { type: 'string' },
              }
            }
          },
          supportLevel: { type: 'number' },
          resistanceLevel: { type: 'number' },
        }
      }
    });

    // Apply AI indicators
    const nextInds = { ...indicators };
    (result.enableIndicators || []).forEach(k => { if (k in nextInds) nextInds[k] = true; });
    setIndicators(nextInds);
    applyIndicators(candles, nextInds);

    // Apply markers to candlestick series
    if (seriesRefs.current.candles && result.markers?.length) {
      seriesRefs.current.candles.setMarkers(result.markers.map(m => ({
        time: m.time,
        position: m.position,
        color: m.color,
        shape: m.shape,
        text: m.text,
      })));
    }

    // Draw support / resistance lines
    const main = chartMain.current;
    if (main) {
      if (seriesRefs.current.support) { main.removeSeries(seriesRefs.current.support); delete seriesRefs.current.support; }
      if (seriesRefs.current.resistance) { main.removeSeries(seriesRefs.current.resistance); delete seriesRefs.current.resistance; }

      if (result.supportLevel) {
        const s = main.addLineSeries({ color: 'rgba(16,185,129,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: 'Support' });
        s.setData(candles.map(c => ({ time: c.time, value: result.supportLevel })));
        seriesRefs.current.support = s;
      }
      if (result.resistanceLevel) {
        const r = main.addLineSeries({ color: 'rgba(244,63,94,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: 'Resistance' });
        r.setData(candles.map(c => ({ time: c.time, value: result.resistanceLevel })));
        seriesRefs.current.resistance = r;
      }
    }

    setAiInsight(result);
    setAiLoading(false);
  };

  const signalColor = (s) => {
    if (!s) return 'text-white/40';
    if (s.includes('Buy')) return 'text-emerald-400';
    if (s.includes('Sell')) return 'text-rose-400';
    return 'text-amber-400';
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white/80">Technical Chart</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range selector */}
          <div className="flex gap-1">
            {RANGES.map(r => (
              <button key={r.range} onClick={() => setRange(r.range)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  range === r.range ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'text-white/30 hover:text-white/50'
                }`}
              >{r.label}</button>
            ))}
          </div>
          {/* Indicators */}
          {[
            { key: 'sma20', label: 'SMA20', color: 'text-amber-400 border-amber-400/30 bg-amber-400/10' },
            { key: 'sma50', label: 'SMA50', color: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
            { key: 'rsi',   label: 'RSI',   color: 'text-violet-400 border-violet-400/30 bg-violet-400/10' },
          ].map(ind => (
            <button key={ind.key} onClick={() => toggleIndicator(ind.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                indicators[ind.key] ? ind.color : 'text-white/20 border-white/10 hover:border-white/20'
              }`}
            >{ind.label}</button>
          ))}
          {/* AI Magic */}
          <button onClick={runAiAnalysis} disabled={aiLoading || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-violet-600/80 to-fuchsia-600/80 hover:from-violet-600 hover:to-fuchsia-600 text-white text-xs font-bold transition-all border border-fuchsia-500/20 disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            AI Magic
          </button>
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-80 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      ) : (
        <>
          <div ref={mainRef} className="w-full" style={{ height: 320 }} />
          <div ref={rsiRef} className="w-full" style={{ display: indicators.rsi ? 'block' : 'none', height: 120 }} />
        </>
      )}

      {/* AI Insight Panel */}
      {aiInsight && (
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-fuchsia-400" />
            <span className="text-xs font-bold text-fuchsia-300">AI Technical Insight</span>
            <span className={`ml-auto text-xs font-bold ${signalColor(aiInsight.signal)}`}>{aiInsight.signal}</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">{aiInsight.summary}</p>
          {(aiInsight.supportLevel || aiInsight.resistanceLevel) && (
            <div className="flex gap-4 text-xs pt-1">
              {aiInsight.supportLevel && <span className="text-emerald-400">Support: <strong>${aiInsight.supportLevel}</strong></span>}
              {aiInsight.resistanceLevel && <span className="text-rose-400">Resistance: <strong>${aiInsight.resistanceLevel}</strong></span>}
            </div>
          )}
          <p className="text-[10px] text-white/20">Indicators & markers applied to chart ↑</p>
        </div>
      )}
    </div>
  );
}