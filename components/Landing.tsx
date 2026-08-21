'use client';

/**
 * The qi.land front page — one screen, no scroll.
 *
 * Everything lives over the shore painting: the album title, the demo player,
 * the poem, and the mailing list. The two secondary things (poem, subscribe)
 * open as panels over the same image rather than as sections below it, so the
 * page never grows a second screen.
 *
 * This replaces the earlier shader treatment. That version painted the whole
 * ocean in WebGL and revealed it by scrolling; once the painting went full-bleed
 * and the scroll went away, the canvas sat permanently behind an opaque image
 * and cost ~100 kB to never be seen. It lives on at /descent in its R3F form.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * The album *is* the poem — ten titles that read straight through. Punctuation
 * and lower-case openings are canon, not sloppiness: they're what makes the
 * tracklist run on as verse. Do not "fix" the capitalisation.
 *
 * "\n" marks the one title that breaks across two lines in the poem's own
 * setting; the tracklist strip flattens it back to a single line.
 */
const POEM = [
  'Sea rising',
  'in memory of those who chose the sea—',
  'a dream so real...',
  'Wait—why is the dream so real?',
  'Wake up!',
  'The heart of the jellyfish.',
  'You shall see:',
  'what belongs to the sea\nwill always return to the sea.',
  'The day after, without us—',
  'sea risen.',
];

/** Player metadata — title case, no trailing punctuation. The poem is the poem. */
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

/**
 * Which tracks actually have a demo in `public/audio/`. Keep in sync when a new
 * file goes in — it drives which track LISTEN NOW starts on, and which lines the
 * poem panel marks as playable.
 */
const AVAILABLE_DEMOS = [2, 3, 5, 6, 7, 9, 10];
const FIRST_DEMO = AVAILABLE_DEMOS[0];

/**
 * The shore painting. Served as WebP; the PNG master is in `artwork/hero_oil.png`,
 * versioned but outside `public/` so it never ships. Swap the file at this path to
 * change the artwork — nothing else references it.
 */
const HERO_IMAGE = '/images/hero.webp';

const JOST = "'Jost', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";

type Panel = 'poem' | 'subscribe' | null;

/* ------------------------------------------------------------------ */

export function Landing({ releaseDate = '2026-12-20' }: { releaseDate?: string }) {
  const [days, setDays] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const curRef = useRef(0);
  const pctRef = useRef(0);
  /** Lets the `ended` listener advance a track without capturing a stale closure. */
  const playTrackRef = useRef<(n: number) => void>(() => {});

  /* --- countdown -------------------------------------------------- */
  useEffect(() => {
    const tick = () => {
      const target = new Date(releaseDate + 'T00:00:00').getTime();
      setDays(Math.max(0, Math.ceil((target - Date.now()) / 864e5)));
    };
    tick();
    const iv = window.setInterval(tick, 60000);
    return () => window.clearInterval(iv);
  }, [releaseDate]);

  /* --- Esc closes whatever panel is open -------------------------- */
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanel(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panel]);

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

  const nowTitle = cur
    ? (missing ? 'demo 待上传 · ' : '') +
      String(cur).padStart(2, '0') +
      ' — ' +
      TITLES[cur - 1]
    : '';

  const playFromPoem = (n: number) => {
    playTrack(n);
    setPanel(null);
  };

  /* ---------------------------------------------------------------- */

  return (
    <div className="landing">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/*
        Two copies of the same (cached) file. The blurred one fills whatever the
        viewport's aspect ratio happens to be; the sharp one sits on top. On a
        wide screen the sharp layer covers everything and the blur is never seen.
        Narrower than 13:10, the sharp layer switches to `contain` so neither the
        jellyfish nor the figure gets cropped out, and the blur becomes its
        surround. Positioning is in CSS, not inline — the media query has to be
        able to override it, and inline styles outrank stylesheet rules.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="l-bg-blur" src={HERO_IMAGE} alt="" aria-hidden />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="l-bg"
        src={HERO_IMAGE}
        alt="A figure on the shore, looking down at a jellyfish in the shallows"
      />
      <div className="l-scrim" />

      <nav className="l-nav">
        <div className="l-nav-left">
          <a href="/" className="l-nav-item l-nav-active">
            HOME
          </a>
          <button type="button" className="l-nav-item" onClick={() => setPanel('poem')}>
            ALBUM
          </button>
          <a href="/descent" className="l-nav-item l-nav-optional">
            DESCENT
          </a>
        </div>
        <button type="button" className="l-nav-item" onClick={() => setPanel('subscribe')}>
          PRE-SAVE
        </button>
      </nav>

      <div className="l-hero">
        <div className="l-eyebrow">NEW ALBUM · 2026</div>
        <h1 className="l-title">
          The Heart
          <br />
          of the Jellyfish
        </h1>
        <div className="l-title-cn">水母之心</div>

        <div className="l-play-row">
          <button
            type="button"
            className="l-play"
            aria-label={'Listen — ' + TITLES[FIRST_DEMO - 1]}
            onClick={() => playTrack(FIRST_DEMO)}
          >
            <svg width="13" height="15" viewBox="0 0 13 15" fill="currentColor" aria-hidden>
              <path d="M0 0l13 7.5L0 15z" />
            </svg>
          </button>
          <button type="button" className="l-play-label" onClick={() => playTrack(FIRST_DEMO)}>
            LISTEN NOW
          </button>
        </div>

        <div className="l-countdown">12 · 20 · 2026 — 还有 {days} 天</div>
      </div>

      {/* ---- the one bar at the bottom: tracklist, or the player ---- */}
      <div className="l-bar">
        {cur > 0 ? (
          <>
            <button
              type="button"
              className="l-bar-toggle"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => playTrack(cur)}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="l-bar-title">{nowTitle}</div>
            <div className="l-bar-track">
              <div className="l-bar-fill" style={{ width: pct.toFixed(1) + '%' }} />
            </div>
            <button type="button" className="l-bar-close" aria-label="Close player" onClick={stop}>
              ✕
            </button>
          </>
        ) : (
          <>
            <button type="button" className="l-strip-label" onClick={() => setPanel('poem')}>
              TRACKLIST
            </button>
            <div className="l-strip-items">
              {POEM.slice(0, 4).map((line, i) => (
                <button
                  key={i}
                  type="button"
                  className="l-strip-item"
                  onClick={() => playTrack(i + 1)}
                >
                  <span className="l-strip-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="l-strip-title">{line.replace('\n', ' ')}</span>
                </button>
              ))}
            </div>
            <button type="button" className="l-strip-all" onClick={() => setPanel('poem')}>
              ALL TEN
            </button>
          </>
        )}
      </div>

      {/* ---- panels ---- */}
      {panel && (
        <div
          className="l-panel"
          role="dialog"
          aria-modal="true"
          aria-label={panel === 'poem' ? 'The poem and full tracklist' : 'Get notified'}
        >
          <button
            type="button"
            className="l-panel-close"
            aria-label="Close"
            onClick={() => setPanel(null)}
          >
            ✕
          </button>

          {panel === 'poem' ? (
            <div className="l-poem">
              <div className="l-poem-head">THE HEART OF THE JELLYFISH · 水母之心</div>
              <ol className="l-poem-lines">
                {POEM.map((line, i) => {
                  const n = i + 1;
                  const has = AVAILABLE_DEMOS.includes(n);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={'l-poem-line' + (has ? '' : ' l-poem-soon')}
                        onClick={() => playFromPoem(n)}
                        aria-label={
                          (has ? 'Play demo — ' : 'No demo yet — ') + TITLES[n - 1]
                        }
                      >
                        <span className="l-poem-num">{String(n).padStart(2, '0')}</span>
                        <span className="l-poem-text">
                          {line.split('\n').map((seg, k) => (
                            <span key={k} className="l-poem-seg">
                              {seg}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="l-poem-foot">
                点一行听 demo · CLICK A LINE TO HEAR IT
                <br />
                01 · 04 · 08 demo 待上传
              </div>
            </div>
          ) : (
            <div className="l-sub">
              <h2 className="l-sub-title">Follow thy heart ;)</h2>
              <p className="l-sub-copy">
                留下邮箱,专辑浮出水面那天,你会第一个知道。
                <br />
                Leave your email — you&apos;ll be the first to know when it surfaces.
              </p>
              {sent ? (
                <div className="l-sub-thanks">
                  Heartbeat received, expect receiving mine too ;)
                </div>
              ) : (
                <form
                  className="l-sub-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (emailRef.current?.value.trim()) setSent(true);
                  }}
                >
                  <input
                    ref={emailRef}
                    type="email"
                    placeholder="Email address · 邮箱"
                    aria-label="Email address"
                    className="l-sub-input"
                  />
                  <button type="submit" className="l-sub-btn">
                    订阅 SIGN UP
                  </button>
                </form>
              )}
              <div className="l-sub-foot">
                QI · 琦 — 12 · 20 · 2026 ·{' '}
                <a href="https://qi.land" className="l-sub-link">
                  QI.LAND
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Route-scoped CSS. Hover and media-query states have to live here rather than
 * inline: inline styles outrank stylesheet rules, so a value that changes on
 * hover or at a breakpoint must keep its resting value in the class too.
 *
 * Careful — this is a template literal. No backticks inside, including comments.
 */
const LANDING_CSS = `
html,body{height:100%;overflow:hidden;background:#8cb9d4}
.landing{position:fixed;inset:0;overflow:hidden;color:#fff;
  font-family:'Noto Serif SC','Cormorant Garamond',serif}
.landing ::selection{background:rgba(143,215,235,.35)}
.landing button{font:inherit}

/* ---- background ---- */
.l-bg,.l-bg-blur{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.l-bg{object-position:center 45%}
.l-bg-blur{filter:blur(34px) saturate(1.06);transform:scale(1.14)}
.l-scrim{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(24,74,112,.28),rgba(24,74,112,.05) 30%,transparent 55%)}

/* Narrower than 13:10 a cover crop pushes either the jellyfish or the figure out
   of frame, so show the painting whole and let the blur surround it, sitting on
   top of the bar. The top edge meets the blur as a change in sharpness rather
   than a colour seam, because the blur behind it is the same sky. */
@media (max-aspect-ratio: 13/10){
  .l-bg{
    object-fit:contain;object-position:center bottom;
    /* Shrink the box so the contained painting lands on top of the bar instead
       of behind it. It has to be an explicit height: on an absolutely positioned
       replaced element, height:auto resolves from the intrinsic ratio and drops
       the bottom offset entirely, which parks the image at the top of the frame. */
    height:calc(100% - clamp(60px,8.6vh,84px));
  }
}

/* ---- nav ---- */
.l-nav{position:absolute;top:0;left:0;right:0;z-index:20;
  display:flex;justify-content:space-between;align-items:center;
  padding:26px clamp(24px,3vw,52px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;letter-spacing:.3em}
.l-nav-left{display:flex;gap:clamp(20px,2.6vw,42px);align-items:baseline}
.l-nav-item{color:inherit;text-decoration:none;white-space:nowrap;
  background:none;border:none;padding:0;cursor:pointer;opacity:.88;transition:opacity .4s}
.l-nav-item:hover{opacity:1}
.l-nav-active{border-bottom:1px solid currentColor;padding-bottom:5px}

/* ---- hero ---- */
.l-hero{position:absolute;z-index:10;
  left:clamp(24px,3vw,52px);top:clamp(96px,17vh,190px);
  display:flex;flex-direction:column;align-items:flex-start;
  text-shadow:0 1px 3px rgba(12,52,84,.30),0 1px 26px rgba(12,52,84,.34);
  animation:l-rise 1.6s cubic-bezier(.2,.7,.2,1) both}
@keyframes l-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.l-eyebrow{font-family:'Jost',sans-serif;font-weight:300;font-size:12px;
  letter-spacing:.34em;margin-bottom:clamp(14px,2.2vh,26px)}
.l-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:clamp(42px,7.2vw,104px);line-height:1.04;margin:0}
.l-title-cn{font-size:13px;letter-spacing:.55em;font-weight:300;margin-top:clamp(12px,1.8vh,20px)}
.l-play-row{display:flex;align-items:center;gap:20px;margin-top:clamp(22px,3.6vh,46px)}
.l-play{width:clamp(58px,4.6vw,76px);height:clamp(58px,4.6vw,76px);border-radius:50%;
  border:1px solid rgba(255,255,255,.8);background:transparent;color:#fff;cursor:pointer;
  flex-shrink:0;display:flex;align-items:center;justify-content:center;padding-left:4px;
  transition:background .45s,border-color .45s}
.l-play:hover{background:rgba(255,255,255,.16);border-color:#fff}
.l-play-label{border:none;background:none;padding:0;color:inherit;cursor:pointer;
  font-family:'Jost',sans-serif;font-weight:300;font-size:12px;letter-spacing:.34em;
  opacity:.92;transition:opacity .4s}
.l-play-label:hover{opacity:1}
.l-countdown{font-family:'Jost',sans-serif;font-weight:300;font-size:11px;
  letter-spacing:.28em;opacity:.82;margin-top:clamp(18px,2.6vh,30px)}

/* ---- the bar: tracklist, or the player ---- */
.l-bar{position:absolute;left:0;right:0;bottom:0;z-index:20;
  height:clamp(60px,8.6vh,84px);display:flex;align-items:center;
  gap:clamp(18px,2.6vw,44px);padding:0 clamp(24px,3vw,52px);
  background:#f3efe7;color:#2c2a26;overflow-x:auto;scrollbar-width:none}
.l-bar::-webkit-scrollbar{display:none}
.l-strip-label,.l-strip-all{font-family:'Jost',sans-serif;font-weight:400;font-size:11px;
  letter-spacing:.34em;flex-shrink:0;background:none;border:none;padding:0;color:inherit;
  cursor:pointer;opacity:1;transition:opacity .35s;white-space:nowrap}
.l-strip-all{font-weight:300;opacity:.55}
.l-strip-label:hover,.l-strip-all:hover{opacity:.7}
.l-strip-all:hover{opacity:1}
.l-strip-items{flex:1;display:flex;align-items:baseline;justify-content:space-between;
  gap:clamp(18px,2.6vw,44px);min-width:0}
.l-strip-item{display:flex;align-items:baseline;gap:11px;min-width:0;
  background:none;border:none;padding:0;color:inherit;cursor:pointer;
  opacity:1;transition:opacity .35s}
.l-strip-item:hover{opacity:.55}
.l-strip-num{font-family:'Jost',sans-serif;font-weight:300;font-size:11px;
  letter-spacing:.2em;color:#a29b90;flex-shrink:0}
.l-strip-title{font-family:'Cormorant Garamond',serif;font-size:15px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.l-bar-toggle{width:38px;height:38px;border-radius:50%;border:1px solid rgba(44,42,38,.45);
  background:transparent;color:inherit;font-size:12px;cursor:pointer;flex-shrink:0;
  transition:background .35s}
.l-bar-toggle:hover{background:rgba(44,42,38,.08)}
.l-bar-title{font-family:'Jost',sans-serif;font-weight:300;font-size:12px;letter-spacing:.2em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:1}
.l-bar-track{flex:1;height:2px;background:rgba(44,42,38,.18);border-radius:1px;min-width:60px}
.l-bar-fill{height:100%;background:#2c2a26;border-radius:1px}
.l-bar-close{border:none;background:transparent;color:inherit;font-size:14px;cursor:pointer;
  opacity:.55;flex-shrink:0;transition:opacity .3s}
.l-bar-close:hover{opacity:1}

/* ---- panels ---- */
.l-panel{position:absolute;inset:0;z-index:30;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:clamp(60px,9vh,110px) clamp(24px,6vw,80px);
  background:rgba(8,34,56,.80);backdrop-filter:blur(14px);
  animation:l-fade .5s ease both;overflow-y:auto}
@keyframes l-fade{from{opacity:0}to{opacity:1}}
.l-panel-close{position:absolute;top:22px;right:clamp(24px,3vw,52px);
  background:none;border:none;color:#fff;font-size:18px;cursor:pointer;
  opacity:.6;transition:opacity .3s;z-index:2}
.l-panel-close:hover{opacity:1}

.l-poem{display:flex;flex-direction:column;align-items:center;text-align:center;
  margin:auto;max-width:min(760px,92vw)}
.l-poem-head{font-family:'Jost',sans-serif;font-weight:300;font-size:10px;
  letter-spacing:.5em;opacity:.6;margin-bottom:clamp(20px,4vh,44px)}
.l-poem-lines{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;
  gap:clamp(4px,.9vh,10px);width:100%}
.l-poem-line{display:flex;align-items:baseline;gap:16px;width:100%;
  background:none;border:none;padding:3px 0;color:#eaf3f8;cursor:pointer;text-align:left;
  font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:clamp(17px,2.5vh,26px);line-height:1.5;
  opacity:.92;transition:opacity .35s,color .35s}
.l-poem-line:hover{opacity:1;color:#fff}
/* Tracks with no demo yet read slightly quieter — enough to hint, not enough to
   break the poem's even colour. The poem is the work; availability is metadata. */
.l-poem-soon{opacity:.62}
.l-poem-soon:hover{opacity:.8;color:#eaf3f8}
.l-poem-num{font-family:'Jost',sans-serif;font-style:normal;font-weight:300;
  font-size:10px;letter-spacing:.2em;opacity:.5;flex-shrink:0;width:2.2em}
.l-poem-text{display:flex;flex-direction:column}
.l-poem-seg{display:block}
.l-poem-foot{font-family:'Jost',sans-serif;font-weight:300;font-size:10px;
  letter-spacing:.34em;opacity:.5;line-height:2.4;margin-top:clamp(20px,4vh,44px);
  text-align:center}

.l-sub{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:20px;margin:auto;max-width:min(560px,92vw)}
.l-sub-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:clamp(28px,4vw,46px);margin:0}
.l-sub-copy{margin:0;font-size:14px;line-height:2;opacity:.88}
.l-sub-form{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:4px}
.l-sub-input{width:min(320px,74vw);padding:13px 4px;border:none;
  border-bottom:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;
  font-size:15px;font-family:inherit;outline:none;text-align:center}
.l-sub-input::placeholder{color:rgba(255,255,255,.45)}
.l-sub-btn{padding:13px 28px;border:1px solid rgba(255,255,255,.7);background:transparent;
  color:#fff;font-family:'Jost',sans-serif;font-weight:300;font-size:11px;
  letter-spacing:.4em;cursor:pointer;transition:background .4s,color .4s}
.l-sub-btn:hover{background:#fff;color:#0b2438}
.l-sub-thanks{font-size:16px;font-style:italic;font-family:'Cormorant Garamond',serif}
.l-sub-foot{font-family:'Jost',sans-serif;font-weight:300;font-size:10px;
  letter-spacing:.34em;opacity:.55;line-height:2.4;margin-top:clamp(18px,4vh,40px)}
.l-sub-link{color:inherit;border-bottom:1px solid currentColor;text-decoration:none}

/* ---- narrow ---- */
@media (max-width:760px){
  .l-strip-label{display:none}
  .l-strip-title{display:none}
  .l-strip-items{justify-content:flex-start;gap:26px}
}
@media (max-width:560px){
  .l-nav-optional{display:none}
  .l-nav{letter-spacing:.2em;font-size:11px}
}

@media (prefers-reduced-motion: reduce){
  .landing *{animation:none !important}
}
`;
