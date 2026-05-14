'use client';

import { useEffect, useRef, useState } from 'react';
import { OceanScene } from './OceanScene';
import { Poem } from './Poem';

function FocusOverlay({ focus }: { focus: string }) {
  if (focus !== 'heart') return null;
  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col">
      <header className="flex items-start justify-between p-8 md:p-12 text-[11px] tracking-[0.45em] uppercase opacity-70 glow">
        <span>Qi · 琦 — frame VI</span>
        <span>preview · the heart of the jellyfish</span>
      </header>
      <div className="flex-1" />
      <footer className="p-8 md:p-12 flex items-end justify-between">
        <div className="max-w-md glow">
          <div className="font-serif italic text-xs opacity-50 tracking-[0.55em] mb-3">VI</div>
          <h1 className="font-serif font-light text-3xl md:text-5xl leading-[1.1]">
            The <span className="italic breathe">heart</span> of the jellyfish
          </h1>
        </div>
        <a href="/" className="text-[10px] tracking-[0.4em] uppercase opacity-60 hover:opacity-100 transition pointer-events-auto glow">
          ← back to full descent
        </a>
      </footer>
    </div>
  );
}

export function Descent() {
  const depthRef = useRef(0);
  const [focus, setFocus] = useState<string | null>(null);
  const [tweakMode, setTweakMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const f = params.get('focus');
    setFocus(f);
    setTweakMode(params.get('tweak') === '1');
    if (f === 'heart') {
      depthRef.current = 0.55;
      return;
    }
    if (f === 'abyss') {
      depthRef.current = 0.92;
      return;
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      depthRef.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <OceanScene depthRef={depthRef} tweakMode={tweakMode} />
      </div>
      {focus ? (
        <FocusOverlay focus={focus} />
      ) : (
        <div className="relative z-10">
          <Poem />
        </div>
      )}
    </>
  );
}
