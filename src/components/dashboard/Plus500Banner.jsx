import React, { useState, useEffect } from 'react';

const US_SRC = "https://cdn.plus500.com/Media/Banners/336x280/77918/index.html?set=Futures_BONUS_HTML&language=EN&country=US&crId=77918&url=https%3A%2F%2Fus.plus500.com%2Fen-us%2F%3Fid%3D138803%26pl%3D2%26crId%3D77918";
const NON_US_SRC = "https://cdn.plus500.com/Media/Banners/336x280/98235/index.html?set=affiliates3 - Indonesia Local Banners - April 2025&language=EN&country=ID&crId=98235&url=https%3A%2F%2Fwww.plus500.com%2Fen--1%2Fmultiplatformdownload%3Fclt%3DWeb%26id%3D138803%26pl%3D2%26crId%3D98235";

export default function Plus500Banner() {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => setSrc(d.country_code === 'US' ? US_SRC : NON_US_SRC))
      .catch(() => setSrc(NON_US_SRC));
  }, []);

  if (!src) return null;

  return (
    <div className="glass rounded-2xl p-4 flex flex-col items-center gap-2">
      <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Sponsored</p>
      <div style={{ width: '100%', maxWidth: 336, aspectRatio: '336/280', overflow: 'hidden' }}>
        <iframe
          src={src}
          width="336"
          height="280"
          scrolling="no"
          frameBorder="0"
          style={{ border: 'none', width: '100%', height: '100%' }}
          title="Plus500 Promotion"
        />
      </div>
    </div>
  );
}