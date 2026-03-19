import React, { useState, useEffect, useRef } from 'react';

const US_SRC = "https://cdn.plus500.com/Media/Banners/336x280/77918/index.html?set=Futures_BONUS_HTML&language=EN&country=US&crId=77918&url=https%3A%2F%2Fus.plus500.com%2Fen-us%2F%3Fid%3D138803%26pl%3D2%26crId%3D77918";
const NON_US_SRC = "https://cdn.plus500.com/Media/Banners/336x280/98235/index.html?set=affiliates3 - Indonesia Local Banners - April 2025&language=EN&country=ID&crId=98235&url=https%3A%2F%2Fwww.plus500.com%2Fen--1%2Fmultiplatformdownload%3Fclt%3DWeb%26id%3D138803%26pl%3D2%26crId%3D98235";

const BANNER_W = 336;
const BANNER_H = 280;

export default function Plus500Banner() {
  const [src, setSrc] = useState(null);
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setSrc(d.country_code === 'US' ? US_SRC : NON_US_SRC))
      .catch(() => setSrc(NON_US_SRC));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setScale(Math.min(1, w / BANNER_W));
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (!src) return null;

  const scaledH = BANNER_H * scale;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col items-center gap-2">
      <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Sponsored</p>
      <div ref={containerRef} style={{ width: '100%', maxWidth: BANNER_W, height: scaledH, overflow: 'hidden', position: 'relative' }}>
        <iframe
          src={src}
          width={BANNER_W}
          height={BANNER_H}
          scrolling="no"
          frameBorder="0"
          style={{
            border: 'none',
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
            display: 'block',
          }}
          title="Plus500 Promotion"
        />
      </div>
    </div>
  );
}