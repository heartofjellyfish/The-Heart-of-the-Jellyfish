'use client';

import { useEffect, useState } from 'react';

const RELEASE = new Date('2026-12-20T00:00:00').getTime();

export function Countdown() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = RELEASE - Date.now();
      if (diff <= 0) {
        setLabel('the heart is awake');
        return;
      }
      const days = Math.floor(diff / 86_400_000);
      const hours = Math.floor((diff % 86_400_000) / 3_600_000);
      setLabel(`${days} days · ${hours.toString().padStart(2, '0')} h until the heart wakes`);
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return <span className="font-serif italic tracking-wider opacity-80">{label}</span>;
}
