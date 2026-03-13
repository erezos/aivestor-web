import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketSentiment } from '../marketData';

function getSentimentColor(value) {
  if (value <= 25) return '#F43F5E';
  if (value <= 45) return '#FB923C';
  if (value <= 55) return '#FBBF24';
  if (value <= 75) return '#A78BFA';
  return '#10B981';
}

function getSentimentLabel(value) {
  if (value <= 25) return 'Extreme Fear';
  if (value <= 45) return 'Fear';
  if (value <= 55) return 'Neutral';
  if (value <= 75) return 'Greed';
  return 'Extreme Greed';
}

export default function MarketSentiment() {
  const { data: sentiment, isLoading } = useQuery({
    queryKey: ['marketSentiment'],
    queryFn: fetchMarketSentiment,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const value = sentiment?.overall ?? 50;
  const color = getSentimentColor(value);
  const label = getSentimentLabel(value);

  const [animatedValue, setAnimatedValue] = useState(0);
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setAnimatedValue(value), 300);
      return () => clearTimeout(timer);
    }
  }, [value, isLoading]);

  const rotation = -90 + (animatedValue / 100) * 180;

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-white/60 mb-4">Market Sentiment</h3>

      {/* Gauge */}
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-40 h-20 overflow-hidden">
          <svg viewBox="0 0 200 100" className="w-full h-full">
            <defs>
              <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F43F5E" />
                <stop offset="25%" stopColor="#FB923C" />
                <stop offset="50%" stopColor="#FBBF24" />
                <stop offset="75%" stopColor="#A78BFA" />
                <stop offset="100%" stopColor="#10B981" />
              </linearGradient>
            </defs>
            <path d="M 20 90 A 80 80 0 0 1 180 90" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" strokeLinecap="round" />
            <path
              d="M 20 90 A 80 80 0 0 1 180 90"
              fill="none"
              stroke="url(#gaugeGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray="251"
              strokeDashoffset={251 - (animatedValue / 100) * 251}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
            <line
              x1="100" y1="90" x2="100" y2="30"
              stroke={isLoading ? 'rgba(255,255,255,0.1)' : color}
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ transformOrigin: '100px 90px', transition: 'transform 1s ease-out', transform: `rotate(${rotation}deg)` }}
            />
            <circle cx="100" cy="90" r="5" fill={isLoading ? 'rgba(255,255,255,0.1)' : color} />
          </svg>
        </div>
        <div className="text-center -mt-1">
          {isLoading ? (
            <div className="space-y-1 flex flex-col items-center">
              <div className="h-8 w-12 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <span className="text-3xl font-bold" style={{ color }}>{animatedValue}</span>
              <p className="text-sm font-semibold mt-0.5" style={{ color }}>{label}</p>
            </>
          )}
        </div>
      </div>

      {/* Mini Indicators */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-28 bg-white/5 rounded animate-pulse" />
              <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
            </div>
          ))
        ) : (
          (sentiment?.indicators || []).map(ind => (
            <div key={ind.name} className="flex items-center justify-between">
              <span className="text-xs text-white/40">{ind.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${ind.value}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: getSentimentColor(ind.value) }}
                  />
                </div>
                <span className="text-xs font-medium" style={{ color: getSentimentColor(ind.value) }}>
                  {ind.value}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}