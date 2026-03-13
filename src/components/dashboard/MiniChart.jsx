import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

export default function MiniChart({ positive = true }) {
  const generateData = () => {
    const points = 20;
    let value = 50 + Math.random() * 30;
    const data = [];
    for (let i = 0; i < points; i++) {
      value += (Math.random() - (positive ? 0.35 : 0.65)) * 5;
      data.push({ v: Math.max(10, value) });
    }
    return data;
  };

  const data = React.useMemo(() => generateData(), [positive]);
  const color = positive ? '#10B981' : '#F43F5E';

  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`grad-${positive ? 'g' : 'r'}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${positive ? 'g' : 'r'})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}