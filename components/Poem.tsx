'use client';

import { Countdown } from './Countdown';

const tracks: { roman: string; en: string; emphasis?: 'heart' | 'mirror' | 'long' }[] = [
  { roman: 'I',    en: 'Sea rising' },
  { roman: 'II',   en: 'In Memory of those who chose the sea' },
  { roman: 'III',  en: 'A dream so real' },
  { roman: 'IV',   en: 'Wait, why is the dream so real?' },
  { roman: 'V',    en: 'Wake up' },
  { roman: 'VI',   en: 'The heart of the jellyfish', emphasis: 'heart' },
  { roman: 'VII',  en: 'You shall see' },
  { roman: 'VIII', en: 'What belongs to the sea will always return to the sea', emphasis: 'long' },
  { roman: 'IX',   en: 'The day after - without us' },
  { roman: 'X',    en: 'Sea risen', emphasis: 'mirror' },
];

export function Poem() {
  return (
    <main className="relative z-10 text-white">
      {/* HERO */}
      <section className="h-screen flex flex-col justify-between px-8 py-10 md:px-16 md:py-14">
        <header className="flex items-start justify-between text-[11px] tracking-[0.45em] uppercase opacity-80 glow rise">
          <span>Qi · 琦</span>
          <span className="hidden md:inline">twelve · twenty · twenty-six</span>
          <span className="md:hidden">12.20.26</span>
        </header>

        <div className="flex flex-col items-center text-center -mt-6">
          <h2
            className="font-cn font-light text-3xl md:text-5xl tracking-[0.55em] opacity-90 glow rise rise-1"
            style={{ paddingLeft: '0.55em' /* optical center for letter-spacing */ }}
          >
            水母之心
          </h2>
          <div className="h-px w-24 bg-white/40 my-8 rise rise-2" />
          <h1 className="font-serif font-light italic text-5xl md:text-8xl leading-[1.05] glow rise rise-2 max-w-5xl">
            The Heart of the Jellyfish
          </h1>
          <p className="mt-10 text-[11px] tracking-[0.5em] uppercase opacity-70 glow rise rise-3">
            a debut album · ten songs that read as a poem
          </p>
        </div>

        <footer className="flex items-end justify-between text-[12px] glow rise rise-4">
          <Countdown />
          <span className="breathe tracking-[0.4em] uppercase text-[10px]">scroll to descend ↓</span>
        </footer>
      </section>

      {/* TRACK SECTIONS */}
      {tracks.map((t, i) => (
        <TrackSection key={t.roman} index={i} {...t} />
      ))}

      {/* CLOSING */}
      <section className="h-screen flex items-center justify-center px-8">
        <div className="text-center max-w-md w-full glow">
          <p className="font-serif italic text-3xl md:text-4xl mb-12 opacity-95">Follow thy heart ;)</p>
          <form
            onSubmit={(e) => { e.preventDefault(); }}
            className="border-b border-white/40 flex gap-3 pb-2 items-center"
          >
            <input
              type="email"
              placeholder="your email"
              className="bg-transparent outline-none flex-1 placeholder:opacity-50 font-serif italic text-lg"
              aria-label="email"
            />
            <button
              type="submit"
              className="opacity-70 hover:opacity-100 transition text-xl"
              aria-label="submit"
            >
              →
            </button>
          </form>
          <p className="mt-14 text-[11px] tracking-[0.5em] uppercase opacity-60">
            releasing · 2026 · 12 · 20
          </p>
          <p className="mt-3 text-[11px] tracking-[0.5em] uppercase opacity-40">
            Qi · 琦
          </p>
        </div>
      </section>
    </main>
  );
}

function TrackSection({
  index, roman, en, emphasis,
}: { index: number; roman: string; en: string; emphasis?: 'heart' | 'mirror' | 'long' }) {
  return (
    <section className="h-screen flex items-center justify-center px-8">
      <div className="text-center max-w-4xl">
        <div className="font-serif italic text-xs md:text-sm opacity-50 mb-8 tracking-[0.55em] glow">
          {roman}
        </div>
        <Title en={en} emphasis={emphasis} index={index} />
      </div>
    </section>
  );
}

function Title({ en, emphasis, index }: { en: string; emphasis?: 'heart' | 'mirror' | 'long'; index: number }) {
  if (emphasis === 'heart') {
    // VI — pulse on "heart"
    const parts = en.split(/(heart)/i);
    return (
      <h3 className="font-serif font-light text-4xl md:text-7xl leading-[1.1] glow">
        {parts.map((part, i) =>
          part.toLowerCase() === 'heart' ? (
            <span key={i} className="italic breathe">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </h3>
    );
  }
  if (emphasis === 'mirror') {
    // X — Sea risen, mirrored echo of I "Sea rising"
    return (
      <div className="glow">
        <h3 className="font-serif font-light text-4xl md:text-7xl leading-[1.1]">{en}</h3>
        <p className="mt-6 font-serif italic text-base md:text-lg opacity-40 tracking-[0.3em]">
          — what began as <span className="italic">rising</span>, has risen.
        </p>
      </div>
    );
  }
  if (emphasis === 'long') {
    // VIII — the long line, deliberately broken
    return (
      <h3 className="font-serif font-light text-3xl md:text-5xl leading-[1.25] glow tracking-tight">
        What belongs to the sea<br />
        <span className="italic opacity-90">will always return</span><br />
        to the sea
      </h3>
    );
  }
  return (
    <h3 className="font-serif font-light text-4xl md:text-7xl leading-[1.1] glow">
      {en}
    </h3>
  );
}
