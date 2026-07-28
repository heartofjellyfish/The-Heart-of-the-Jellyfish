'use client';

/**
 * Medusa — the shader-only alternate treatment of the album site.
 *
 * Same 11-frame arc as `Descent`, but there is no three.js here at all: one
 * full-screen WebGL triangle paints sky/water/jelly/abyss from `medusaShader.ts`,
 * and everything else is typography scrolling over it. Scroll position (0..1 over
 * the whole document) is the single input — it feeds the shader's `uD` and picks
 * the header's ink colour. That mirrors the `depthRef` idea in OceanScene, minus
 * the geometry.
 *
 * Ported from the `Medusa.dc.html` design.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { MEDUSA_FS, MEDUSA_VS, MEDUSA_NO_GL_GRADIENT } from './medusaShader';

const TITLES = [
  'Sea Rising',
  'In Memory of Those Who Chose the Sea',
  'A Dream So Real',
  'Wait, Why Is the Dream So Real?',
  'Wake Up',
  'The Heart of the Jellyfish',
  'You Shall See',
  'What Belongs to the Sea Will Always Return to the Sea',
  'The Day After — Without Us',
  'Sea Risen',
];

const FILES = [
  '/audio/01-sea-rising.mp3',
  '/audio/02-in-memory-of-those-who-chose-the-sea.mp3',
  '/audio/03-a-dream-so-real.mp3',
  '/audio/04-wait-why-is-the-dream-so-real.mp3',
  '/audio/05-wake-up.mp3',
  '/audio/06-the-heart-of-the-jellyfish.mp3',
  '/audio/07-you-shall-see.mp3',
  '/audio/08-what-belongs-to-the-sea.mp3',
  '/audio/09-the-day-after-without-us.mp3',
  '/audio/10-sea-risen.mp3',
];

const POEM = [
  'Sea rising',
  'In memory of those who chose the sea',
  'A dream so real',
  'Wait, why is the dream so real?',
  'Wake up',
  'The heart of the jellyfish',
  'You shall see',
  'What belongs to the sea will always return to the sea',
  'The day after — without us',
  'Sea risen',
];

const JOST = "'Jost', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

const trackLabel: CSSProperties = {
  fontFamily: JOST,
  fontWeight: 300,
  fontSize: 10,
  letterSpacing: '.6em',
  opacity: 0.6,
};

/** The huge ghosted "01"/"03"/"07"/"10" numerals behind the track titles. */
const ghostNumeral: CSSProperties = {
  position: 'absolute',
  fontFamily: CORMORANT,
  fontWeight: 300,
  fontSize: 'clamp(120px,18vw,260px)',
  lineHeight: 1,
  pointerEvents: 'none',
};

const cnLine: CSSProperties = { fontSize: 14, letterSpacing: '.4em', opacity: 0.75 };
const row: CSSProperties = { display: 'flex', gap: 28, alignItems: 'baseline' };

/* ------------------------------------------------------------------ */

/**
 * Fade/blur/rise as the block enters the viewport. The `-22%` bottom margin
 * reproduces the design's `top < innerHeight * 0.78` trigger; the timeout is the
 * design's failsafe for anything the observer never fires on.
 */
function Reveal({
  slow = false,
  baseTransform = '',
  style,
  children,
}: {
  slow?: boolean;
  baseTransform?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -22% 0px' },
    );
    io.observe(el);
    const failsafe = window.setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 15000);
    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const dur = slow ? 2.8 : 1.7;
  return (
    <div
      ref={ref}
      style={{
        ...style,
        opacity: shown ? 1 : 0,
        filter: shown ? 'blur(0px)' : `blur(${slow ? 26 : 14}px)`,
        transform: `${baseTransform} translateY(${shown ? 0 : 30}px)`.trim(),
        transition: `opacity ${dur}s ease, filter ${dur}s ease, transform ${dur}s ease`,
      }}
    >
      {children}
    </div>
  );
}

/** The "▷ DEMO" control that sits next to every track title. */
function Demo({
  n,
  onPlay,
  opacity = 0.6,
  blue = true,
  fontSize = 10.5,
}: {
  n: number;
  onPlay: (n: number) => void;
  opacity?: number;
  blue?: boolean;
  fontSize?: number;
}) {
  return (
    <button
      type="button"
      onClick={() => onPlay(n)}
      aria-label={`Play demo — ${TITLES[n - 1]}`}
      className={`m-demo${blue ? ' m-demo-blue' : ''}`}
      style={{ ['--o' as string]: opacity, fontSize } as CSSProperties}
    >
      ▷ DEMO
    </button>
  );
}

/** Per-character drift — each glyph bobs on its own phase, like kelp. */
function Drift({ text }: { text: string }) {
  return (
    <>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: ch === ' ' ? '.26em' : undefined,
            animation: `medusa-drift ${6 + (i % 5)}s ease-in-out ${-(i * 0.45)}s infinite`,
          }}
        >
          {ch}
        </span>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function Medusa({
  releaseDate = '2026-12-20',
  motion = 1,
}: {
  releaseDate?: string;
  /** Shader time multiplier — 0.3 is a near-still sea, 2 is agitated. */
  motion?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const [days, setDays] = useState(0);
  /** 0 = above water (dark ink), 1 = submerged (pale ink), 2 = dawn (brown ink). */
  const [ui, setUi] = useState(0);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const curRef = useRef(0);
  const pctRef = useRef(0);
  const uiRef = useRef(0);
  /** Lets the `ended` listener advance to the next track without a stale closure. */
  const playTrackRef = useRef<(n: number) => void>(() => {});

  /* --- countdown ------------------------------------------------- */
  useEffect(() => {
    const tick = () => {
      const target = new Date(`${releaseDate}T00:00:00`).getTime();
      setDays(Math.max(0, Math.ceil((target - Date.now()) / 864e5)));
    };
    tick();
    const iv = window.setInterval(tick, 60000);
    return () => window.clearInterval(iv);
  }, [releaseDate]);

  /* --- smooth anchor scrolling, scoped to this route -------------- */
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  /* --- audio ------------------------------------------------------ */
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const au = new Audio();
    au.addEventListener('timeupdate', () => {
      const p = au.duration ? (au.currentTime / au.duration) * 100 : 0;
      if (Math.abs(p - pctRef.current) > 0.7) {
        pctRef.current = p;
        setPct(p);
      }
    });
    au.addEventListener('ended', () => {
      if (curRef.current < FILES.length) playTrackRef.current(curRef.current + 1);
      else setPlaying(false);
    });
    au.addEventListener('error', () => {
      setMissing(true);
      setPlaying(false);
    });
    audioRef.current = au;
    return au;
  }, []);

  const playTrack = useCallback(
    (n: number) => {
      if (n < 1 || n > FILES.length) return;
      const au = ensureAudio();
      if (curRef.current === n) {
        if (au.paused) {
          au.play().catch(() => {});
          setPlaying(true);
        } else {
          au.pause();
          setPlaying(false);
        }
        return;
      }
      au.src = FILES[n - 1];
      curRef.current = n;
      pctRef.current = 0;
      setCur(n);
      setMissing(false);
      setPct(0);
      au
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          // No demo uploaded yet — the bar still opens, labelled "demo 待上传".
          setMissing(true);
          setPlaying(false);
        });
    },
    [ensureAudio],
  );
  playTrackRef.current = playTrack;

  const stop = useCallback(() => {
    audioRef.current?.pause();
    curRef.current = 0;
    pctRef.current = 0;
    setCur(0);
    setPlaying(false);
    setPct(0);
  }, []);

  useEffect(
    () => () => {
      const au = audioRef.current;
      if (au) {
        au.pause();
        au.src = '';
      }
    },
    [],
  );

  /* --- shader ----------------------------------------------------- */
  useEffect(() => {
    const noGl = () => {
      if (bgRef.current) bgRef.current.style.background = MEDUSA_NO_GL_GRADIENT;
    };
    const cv = canvasRef.current;
    if (!cv) return noGl();

    const gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) return noGl();

    const mk = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = mk(gl.VERTEX_SHADER, MEDUSA_VS);
    const fs = mk(gl.FRAGMENT_SHADER, MEDUSA_FS);
    if (!vs || !fs) return noGl();

    const prog = gl.createProgram();
    if (!prog) return noGl();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(prog));
      return noGl();
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aP = gl.getAttribLocation(prog, 'aP');
    gl.enableVertexAttribArray(aP);
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(prog, 'uR');
    const uT = gl.getUniformLocation(prog, 'uT');
    const uD = gl.getUniformLocation(prog, 'uD');
    const uM = gl.getUniformLocation(prog, 'uM');

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = window.innerWidth * dpr;
      cv.height = window.innerHeight * dpr;
      gl.viewport(0, 0, cv.width, cv.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let mx = 0.5;
    let my = 0.45;
    let tx = 0.5;
    let ty = 0.45;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('mousemove', onMove);

    let raf = 0;
    const loop = () => {
      mx += (tx - mx) * 0.02;
      my += (ty - my) * 0.02;
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const d = Math.min(window.scrollY / max, 1);

      gl.uniform2f(uR, cv.width, cv.height);
      gl.uniform1f(uT, (performance.now() / 1000) * motion);
      gl.uniform1f(uD, d);
      gl.uniform2f(uM, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const next = d < 0.2 ? 0 : d < 0.87 ? 1 : 2;
      if (next !== uiRef.current) {
        uiRef.current = next;
        setUi(next);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [motion]);

  /* --- derived ---------------------------------------------------- */
  const uiColor = ui === 1 ? '#dceef6' : ui === 2 ? '#43372a' : '#0f2c40';
  const nowTitle = cur
    ? `${missing ? 'demo 待上传 · ' : ''}${String(cur).padStart(2, '0')} — ${TITLES[cur - 1]}`
    : '';

  return (
    <div
      className="medusa"
      style={{ fontFamily: `'Noto Serif SC', ${CORMORANT}`, color: '#dceef6' }}
    >
      <style dangerouslySetInnerHTML={{ __html: MEDUSA_CSS }} />

      {/* Fallback / underlay. The canvas paints over this when WebGL is available. */}
      <div
        ref={bgRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: 'linear-gradient(180deg,#7fb3cd,#123c5c 55%,#04121f)',
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '22px 32px',
          fontFamily: JOST,
          fontWeight: 300,
          fontSize: 12,
          letterSpacing: '.38em',
          color: uiColor,
          transition: 'color 1.2s',
        }}
      >
        <div style={{ fontWeight: 400 }}>QI · 琦</div>
        <div>12 · 20 · 2026</div>
      </header>

      <main style={{ position: 'relative', zIndex: 2 }}>
        {/* ---------------- Hero ---------------- */}
        <section style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/heart-of-the-jellyfish.webp"
            alt=""
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              WebkitMaskImage: 'linear-gradient(180deg,#000 58%,transparent 97%)',
              maskImage: 'linear-gradient(180deg,#000 58%,transparent 97%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              padding: '15vh 8vw 0',
              color: '#fdfeff',
              textShadow: '0 1px 22px rgba(10,50,80,.4),0 1px 4px rgba(10,50,80,.2)',
              maxWidth: 640,
            }}
          >
            <div
              style={{
                fontFamily: JOST,
                fontWeight: 300,
                fontSize: 11,
                letterSpacing: '.55em',
                opacity: 0.92,
              }}
            >
              QI · 琦 — DEBUT ALBUM · 首张概念专辑
            </div>
            <h1
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(30px,7vw,118px)',
                lineHeight: 1,
                margin: '0 0 4px',
                whiteSpace: 'nowrap',
                color: '#fdfeff',
                textShadow: '0 2px 34px rgba(10,50,80,.45),0 1px 6px rgba(10,50,80,.25)',
              }}
            >
              <Drift text="The Heart of the Jellyfish" />
            </h1>
            <div style={{ fontSize: 16, letterSpacing: '.66em', fontWeight: 300 }}>水母之心</div>
            <div
              style={{
                width: 42,
                height: 1,
                background: 'rgba(253,254,255,.65)',
                margin: '4px 0',
                boxShadow: '0 1px 8px rgba(10,50,80,.3)',
              }}
            />
            <div
              style={{
                fontFamily: JOST,
                fontWeight: 300,
                fontSize: 12,
                letterSpacing: '.3em',
                opacity: 0.95,
              }}
            >
              12 · 20 · 2026 — 还有 {days} 天
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '5vh',
              left: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: '#eaf4f9',
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: 18, animation: 'medusa-sink 2.6s ease-in-out infinite' }}>↓</div>
            <div
              style={{
                fontFamily: JOST,
                fontWeight: 300,
                fontSize: 10,
                letterSpacing: '.6em',
                opacity: 0.8,
              }}
            >
              下潜 DIVE
            </div>
          </div>
        </section>

        {/* ---------------- Poem index ---------------- */}
        <section
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 4,
            padding: '12vh 8vw',
            textAlign: 'center',
            color: '#0d2f45',
          }}
        >
          <Reveal
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontFamily: CORMORANT,
              fontStyle: 'italic',
              fontWeight: 500,
              fontSize: 'clamp(17px,1.8vw,23px)',
              lineHeight: 2.05,
            }}
          >
            <div className="m-poem" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {POEM.map((line, i) => (
                <a key={i} href={`#t${i + 1}`}>
                  {line}
                </a>
              ))}
            </div>
          </Reveal>
          <div
            style={{
              fontFamily: JOST,
              fontWeight: 300,
              fontSize: 10,
              letterSpacing: '.5em',
              opacity: 0.6,
              marginTop: '7vh',
            }}
          >
            点一行，潜到那首歌 · CLICK A LINE TO SINK TO IT
          </div>
        </section>

        {/* ---------------- 01 ---------------- */}
        <section
          id="t1"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            padding: '0 8vw 14vh',
            color: '#0a2a40',
          }}
        >
          <Reveal
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              alignItems: 'flex-start',
            }}
          >
            <div style={{ ...ghostNumeral, right: '-.4em', top: '-1.1em', opacity: 0.1 }}>01</div>
            <div style={trackLabel}>TRACK 01</div>
            <h2
              onClick={() => playTrack(1)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(52px,9vw,150px)',
                lineHeight: 0.95,
                margin: 0,
                cursor: 'pointer',
              }}
            >
              <Drift text="Sea rising" />
            </h2>
            <div style={row}>
              <span style={cnLine}>海正升起</span>
              <Demo n={1} onPlay={playTrack} opacity={0.65} blue={false} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 02 ---------------- */}
        <section
          id="t2"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 22,
            padding: '0 8vw',
            textAlign: 'center',
            color: '#e8f3f8',
          }}
        >
          <Reveal
            style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}
          >
            <div
              style={{
                width: 1,
                height: '9vh',
                background: 'linear-gradient(rgba(232,243,248,0),rgba(232,243,248,.6))',
              }}
            />
            <div style={trackLabel}>TRACK 02</div>
            <h2
              onClick={() => playTrack(2)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(24px,3vw,42px)',
                lineHeight: 1.5,
                margin: 0,
                maxWidth: '24ch',
                letterSpacing: '.06em',
                cursor: 'pointer',
              }}
            >
              In memory of those
              <br />
              who chose the sea
            </h2>
            <div style={row}>
              <span style={{ ...cnLine, fontSize: 13, color: '#e9d9b8' }}>纪念那些选择大海的人</span>
              <Demo n={2} onPlay={playTrack} />
            </div>
            <div
              style={{
                width: 1,
                height: '9vh',
                background: 'linear-gradient(rgba(232,243,248,.6),rgba(232,243,248,0))',
              }}
            />
          </Reveal>
        </section>

        {/* ---------------- 03 ---------------- */}
        <section
          id="t3"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '0 12vw',
            color: '#e6f2f8',
          }}
        >
          <Reveal
            baseTransform="rotate(-2deg)"
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ ...ghostNumeral, left: '-.35em', top: '-1.15em', opacity: 0.08 }}>03</div>
            <div style={trackLabel}>TRACK 03</div>
            <h2
              onClick={() => playTrack(3)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(44px,7vw,110px)',
                lineHeight: 1,
                margin: 0,
                cursor: 'pointer',
                filter: 'blur(.6px)',
              }}
            >
              <Drift text="A dream so real" />
            </h2>
            <div style={row}>
              <span style={{ ...cnLine, color: '#e9d9b8' }}>一场如此真实的梦</span>
              <Demo n={3} onPlay={playTrack} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 04 ---------------- */}
        <section
          id="t4"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-end',
            padding: '0 12vw',
            textAlign: 'right',
            color: '#e6f2f8',
          }}
        >
          <Reveal
            style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-end' }}
          >
            <div
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontSize: 'clamp(20px,2.4vw,34px)',
                opacity: 0.28,
                filter: 'blur(2.5px)',
                margin: 0,
              }}
            >
              a dream so real…
            </div>
            <div style={trackLabel}>TRACK 04</div>
            <h2
              onClick={() => playTrack(4)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(34px,5vw,78px)',
                lineHeight: 1.12,
                margin: 0,
                maxWidth: '16ch',
                cursor: 'pointer',
              }}
            >
              Wait, why is the dream so real?
            </h2>
            <div style={row}>
              <Demo n={4} onPlay={playTrack} />
              <span style={{ ...cnLine, color: '#e9d9b8' }}>等等，梦为什么这么真实？</span>
            </div>
          </Reveal>
        </section>

        {/* ---------------- 05 — the single hard cut ---------------- */}
        <section
          id="t5"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            padding: '0 8vw',
            textAlign: 'center',
            color: '#f6fbfd',
          }}
        >
          <Reveal
            style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}
          >
            <div style={{ ...trackLabel, opacity: 0.7 }}>TRACK 05</div>
            <h2
              onClick={() => playTrack(5)}
              style={{
                fontFamily: JOST,
                fontWeight: 200,
                fontSize: 'clamp(48px,8.6vw,140px)',
                lineHeight: 1,
                margin: 0,
                letterSpacing: '.28em',
                textIndent: '.28em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                textShadow: '0 0 70px rgba(255,255,255,.55)',
              }}
            >
              Wake up
            </h2>
            <div style={row}>
              <span style={{ fontSize: 15, letterSpacing: '.7em', textIndent: '.7em' }}>醒来</span>
              <Demo n={5} onPlay={playTrack} opacity={0.7} blue={false} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 06 — the heart ---------------- */}
        <section
          id="t6"
          style={{
            minHeight: '110vh',
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            padding: '0 10vw',
            color: '#dceef6',
          }}
        >
          <Reveal style={{ display: 'flex', gap: 'clamp(24px,4vw,60px)', alignItems: 'center' }}>
            <div
              style={{
                writingMode: 'vertical-rl',
                fontSize: 'clamp(30px,4.6vh,48px)',
                fontWeight: 300,
                letterSpacing: '.5em',
                opacity: 0.9,
              }}
            >
              水母之心
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={trackLabel}>TRACK 06</div>
              <h2
                onClick={() => playTrack(6)}
                style={{
                  fontFamily: CORMORANT,
                  fontStyle: 'italic',
                  fontWeight: 500,
                  fontSize: 'clamp(28px,3.6vw,54px)',
                  lineHeight: 1.15,
                  margin: 0,
                  maxWidth: '14ch',
                  cursor: 'pointer',
                }}
              >
                <Drift text="The heart of the jellyfish" />
              </h2>
              <div>
                <Demo n={6} onPlay={playTrack} />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ---------------- 07 ---------------- */}
        <section
          id="t7"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 16,
            padding: '0 8vw',
            textAlign: 'center',
            color: '#e6f2f8',
          }}
        >
          <Reveal
            slow
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div style={{ ...ghostNumeral, right: '-.7em', top: '-1.05em', opacity: 0.08 }}>07</div>
            <div style={trackLabel}>TRACK 07</div>
            <h2
              onClick={() => playTrack(7)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(46px,7.4vw,120px)',
                lineHeight: 1,
                margin: 0,
                cursor: 'pointer',
              }}
            >
              <Drift text="You shall see" />
            </h2>
            <div style={row}>
              <span style={{ ...cnLine, color: '#e9d9b8' }}>你会看见</span>
              <Demo n={7} onPlay={playTrack} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 08 ---------------- */}
        <section
          id="t8"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 20,
            padding: '0 3vw',
            textAlign: 'center',
            color: '#dceef6',
          }}
        >
          <Reveal
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              alignItems: 'center',
              width: '100%',
            }}
          >
            <div style={trackLabel}>TRACK 08</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'linear-gradient(90deg,transparent,rgba(220,238,246,.5))',
                }}
              />
              <h2
                onClick={() => playTrack(8)}
                style={{
                  fontFamily: CORMORANT,
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 'clamp(15px,2.1vw,32px)',
                  letterSpacing: '.24em',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                What belongs to the sea will always return to the sea
              </h2>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: 'linear-gradient(90deg,rgba(220,238,246,.5),transparent)',
                }}
              />
            </div>
            <div style={row}>
              <span style={{ ...cnLine, fontSize: 13, color: '#e9d9b8' }}>
                属于大海的，终将归于大海
              </span>
              <Demo n={8} onPlay={playTrack} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- 09 ---------------- */}
        <section
          id="t9"
          style={{
            minHeight: '115vh',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
            padding: '0 8vw 12vh',
            color: '#9fb9c8',
          }}
        >
          <Reveal
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              alignItems: 'flex-end',
              textAlign: 'right',
            }}
          >
            <div style={trackLabel}>TRACK 09</div>
            <h2
              onClick={() => playTrack(9)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 'clamp(17px,1.6vw,24px)',
                margin: 0,
                opacity: 0.85,
                cursor: 'pointer',
              }}
            >
              The day after — without us
            </h2>
            <div style={{ ...row, gap: 24 }}>
              <Demo n={9} onPlay={playTrack} opacity={0.55} fontSize={10} />
              <span style={{ fontSize: 12, letterSpacing: '.4em', opacity: 0.65 }}>
                后日 · 没有我们
              </span>
            </div>
          </Reveal>
        </section>

        {/* ---------------- 10 ---------------- */}
        <section
          id="t10"
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 18,
            padding: '0 8vw',
            textAlign: 'center',
            color: '#43372a',
          }}
        >
          <Reveal
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              alignItems: 'center',
            }}
          >
            <div style={{ ...ghostNumeral, left: '-.8em', top: '-1.05em', opacity: 0.09 }}>10</div>
            <div style={{ ...trackLabel, opacity: 0.7 }}>TRACK 10</div>
            <h2
              onClick={() => playTrack(10)}
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(52px,9vw,150px)',
                lineHeight: 0.95,
                margin: 0,
                cursor: 'pointer',
              }}
            >
              <Drift text="Sea risen" />
            </h2>
            <div style={row}>
              <span style={{ ...cnLine, opacity: 0.8 }}>海已升起</span>
              <Demo n={10} onPlay={playTrack} opacity={0.65} blue={false} />
            </div>
          </Reveal>
        </section>

        {/* ---------------- Email ---------------- */}
        <section
          style={{
            minHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 22,
            padding: '10vh 8vw 14vh',
            textAlign: 'center',
            color: '#3f3629',
          }}
        >
          <Reveal
            style={{ display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'center' }}
          >
            <h2
              style={{
                fontFamily: CORMORANT,
                fontStyle: 'italic',
                fontWeight: 500,
                fontSize: 'clamp(30px,4vw,52px)',
                margin: 0,
              }}
            >
              Follow thy heart ;)
            </h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 2.1, maxWidth: '44ch', opacity: 0.85 }}>
              留下邮箱，专辑浮出水面那天，你会第一个知道。
              <br />
              Leave your email — you&apos;ll be the first to know when it surfaces.
            </p>

            {sent ? (
              <div style={{ fontSize: 16, fontStyle: 'italic', fontFamily: CORMORANT }}>
                Heartbeat received, expect receiving mine too ;)
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (emailRef.current?.value.trim()) setSent(true);
                }}
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginTop: 4,
                }}
              >
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="Email address · 邮箱"
                  aria-label="Email address"
                  style={{
                    width: 'min(320px,74vw)',
                    padding: '14px 4px',
                    border: 'none',
                    borderBottom: '1px solid rgba(63,54,41,.55)',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: 15,
                    fontFamily: 'inherit',
                    outline: 'none',
                    textAlign: 'center',
                  }}
                />
                <button type="submit" className="m-sub">
                  订阅 SIGN UP
                </button>
              </form>
            )}

            <div
              style={{
                marginTop: '7vh',
                fontFamily: JOST,
                fontWeight: 300,
                fontSize: 10.5,
                letterSpacing: '.34em',
                opacity: 0.65,
                lineHeight: 2.6,
              }}
            >
              QI · 琦 — THE HEART OF THE JELLYFISH · 水母之心
              <br />
              12 · 20 · 2026 ·{' '}
              <a href="https://qi.land" style={{ borderBottom: '1px solid currentColor' }}>
                QI.LAND
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ---------------- Player bar ---------------- */}
      {cur > 0 && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '14px 26px',
            background: 'rgba(4,16,28,.78)',
            backdropFilter: 'blur(10px)',
            color: '#dff0f7',
          }}
        >
          <button
            type="button"
            className="m-bar-toggle"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => playTrack(cur)}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <div
            style={{
              fontFamily: JOST,
              fontWeight: 300,
              fontSize: 12,
              letterSpacing: '.2em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {nowTitle}
          </div>
          <div
            style={{ flex: 1, height: 2, background: 'rgba(223,240,247,.22)', borderRadius: 1 }}
          >
            <div
              style={{
                height: '100%',
                background: '#8fd6ea',
                borderRadius: 1,
                width: `${pct.toFixed(1)}%`,
              }}
            />
          </div>
          <button type="button" className="m-bar-close" aria-label="Close player" onClick={stop}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Route-scoped CSS. Hover states live here rather than inline because inline
 * styles outrank stylesheet rules — the design's `style-hover` attribute has no
 * DOM equivalent, so anything that changes on hover keeps its base value in a
 * class too. `--o` carries each demo button's resting opacity.
 */
const MEDUSA_CSS = `
body{background:#0a2438}
.medusa a{color:inherit;text-decoration:none}
.medusa a:hover{opacity:.7}
.medusa .m-poem a:hover{color:#f6fbfd;opacity:1}
.medusa ::selection{background:rgba(143,215,235,.35)}
.medusa ::placeholder{color:rgba(63,54,41,.45)}

.medusa .m-demo{
  font-family:'Jost',sans-serif;font-weight:300;letter-spacing:.4em;
  border:none;background:none;padding:0;color:inherit;cursor:pointer;
  opacity:var(--o,.6);transition:opacity .5s,color .5s;
}
.medusa .m-demo:hover{opacity:1}
.medusa .m-demo-blue:hover{opacity:1;color:#aee4f2}

.medusa .m-sub{
  padding:14px 30px;border:1px solid #3f3629;background:transparent;color:inherit;
  font-family:'Jost',sans-serif;font-weight:300;font-size:11px;letter-spacing:.4em;
  cursor:pointer;transition:background .4s,color .4s;
}
.medusa .m-sub:hover{background:#3f3629;color:#f2e9d8}

.medusa .m-bar-toggle{
  width:40px;height:40px;border-radius:50%;border:1px solid rgba(223,240,247,.6);
  background:transparent;color:inherit;font-size:13px;cursor:pointer;flex-shrink:0;
}
.medusa .m-bar-close{
  border:none;background:transparent;color:inherit;font-size:15px;cursor:pointer;
  opacity:.7;flex-shrink:0;transition:opacity .3s;
}
.medusa .m-bar-close:hover{opacity:1}

@keyframes medusa-drift{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-7px) rotate(.6deg)}}
@keyframes medusa-sink{0%,100%{transform:translateY(0);opacity:.5}50%{transform:translateY(10px);opacity:1}}

@media (prefers-reduced-motion: reduce){
  .medusa *{animation:none !important}
}
`;
