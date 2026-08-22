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

import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The album *is* the poem — ten titles that read straight through. Punctuation
 * and lower-case openings are canon, not sloppiness: they're what makes the
 * tracklist run on as verse. Do not "fix" the capitalisation.
 */
const POEM = [
  'Sea rising',
  'in memory of those who chose the sea—',
  'a dream so real...',
  'Wait—why is the dream so real?',
  'Wake up!',
  'The heart of the jellyfish.',
  'You shall see:',
  'what belongs to the sea will always return to the sea.',
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
 * Which tracks have a demo in `public/audio/`. All ten, as of the 2026-08-21
 * bounces. Kept as a list rather than assumed, so pulling a track back to
 * unreleased is one edit: drop its number and the poem panel dims that line,
 * the bar labels it "DEMO PENDING", and LISTEN NOW skips past it.
 */
const AVAILABLE_DEMOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * What LISTEN NOW starts on. Not track 01 — this is the one to meet the album
 * with, and it is a separate decision from the running order.
 */
const FEATURED_DEMO = 3;

/**
 * The shore painting. Served as WebP; the PNG master is in `artwork/hero_oil.png`,
 * versioned but outside `public/` so it never ships. Swap the file at this path to
 * change the artwork — nothing else references it.
 */
const HERO_IMAGE = '/images/hero.webp';

/**
 * Where the poem breaks. Four stanzas, uneven on purpose — the movements are not
 * the same length. Indices are track numbers, so this reads the same as the sleeve.
 */
const STANZAS = [[1, 2, 3], [4, 5, 6], [7, 8], [9, 10]];

/**
 * Where the one meta line (the ticking countdown) sits. Four positions, one edit
 * to switch — they read very differently against the painting, so this is a
 * look-at-it decision, not a reasoned one.
 */
type MetaPlacement = 'eyebrow' | 'underTitle' | 'underPlay' | 'topLeft';
const META_PLACEMENT: MetaPlacement = 'underTitle';

const JOST = "'Jost', sans-serif";
const CORMORANT = "'Cormorant Garamond', serif";
/**
 * Candidate faces for the poem. Each sets CSS variables rather than a
 * font-family alone, because the scripts have much smaller x-heights than
 * Cormorant and need their own size and leading to stay readable.
 *
 * Cormorant italic is the default: it is the album's own type, set rather than
 * scrawled. Try the others live at `/?type=1`.
 *
 * Once one is chosen, drop the rest from the Google Fonts link in app/page.tsx —
 * they are only loaded so the choice can be seen.
 */
const POEM_FONTS = [
  {
    key: 'nothing',
    label: 'Nothing You Could Do',
    family: "'Nothing You Could Do',cursive",
    style: 'normal',
    weight: '400',
    size: 'clamp(15px,2.2vh,24px)',
    lh: '1.75',
  },
  {
    key: 'cormorant',
    label: 'Cormorant italic',
    family: "'Cormorant Garamond',serif",
    style: 'italic',
    weight: '500',
    size: 'clamp(17px,2.5vh,26px)',
    lh: '1.55',
  },
] as const;

type PoemFontKey = (typeof POEM_FONTS)[number]['key'];
const POEM_FONT: PoemFontKey = 'nothing';

/**
 * The vignette: how dark the corners go, and how far in the darkening starts.
 * `inner` is where the ramp begins, as a percentage of the radius. With the eased
 * curve a low `inner` is fine — the first half of the ramp is nearly invisible —
 * so it can start early and stay gradual rather than starting late and banding.
 */
const VIGNETTE = { strength: 0.14, inner: 0 };

/**
 * Multiplier on the hero block's type — title, countdown, both actions. Qi's
 * setting, arrived at with the slider at /?tune=1. The CSS fallback on .landing
 * carries the same number; keep the two in step.
 */
const HERO_TYPE_SCALE = 1.15;

/**
 * How deep the album title sits in the surface.
 *
 * Qi picked the letterpress edge over nine noise textures and then asked for it
 * stronger. Two things were wrong with the version he was looking at, and only
 * one of them was strength:
 *
 * - The edge was 1px on a 120px letter, under eight thousandths of the cap
 *   height. Whatever it was doing, it was doing invisibly.
 * - text-shadow always paints *behind* the glyph, so an offset upward can only
 *   show a dark line above the letter, never inside it. That reads as a shadow
 *   cast by something floating, which is the opposite of what we want. A groove
 *   is shaded on its *inner* walls: dark along the top wall, which faces away
 *   from the light, bright along the bottom wall, which faces into it.
 *
 * So there are three styles here rather than one, in order of how literally they
 * commit to that. 'edge' and 'groove' stay text-shadow and just scale up, which
 * keeps the letters crisp. 'carve' uses an SVG filter to put real shading inside
 * the glyph — SourceAlpha minus a shifted blur of itself is exactly the band
 * along one inner edge — and is the only one of the three that can actually look
 * cut rather than lit.
 *
 * DEPTH multiplies all of it. Everything downstream is expressed in multiples of
 * it, so the slider at /?tune=1 moves the whole construction at once.
 */
const INSET_STYLES = [
  { key: 'edge', label: 'A  Edge' },
  { key: 'groove', label: 'B  Groove' },
  { key: 'carve', label: 'C  Carve' },
  { key: 'cut', label: 'D  Carve + Groove' },
] as const;

type InsetKey = (typeof INSET_STYLES)[number]['key'];
const INSET: InsetKey = 'carve';

/**
 * Which way the letters go: cut into the surface, or standing off it.
 *
 * It costs one sign. Light comes from above in both cases, so the only thing
 * that distinguishes a groove from a ridge is which of its two walls faces the
 * light — and every wall in all three styles is placed by a y offset. Flip every
 * one of those offsets and the shadowed wall moves from the top of each letter to
 * the bottom, the lit wall moves the other way, and the same construction reads
 * as raised. No second filter, no swapped colours.
 *
 * What does not flip is the cast shadow underneath. The sun did not move; a
 * ridge just throws a longer one than a dent does, hence --cast.
 */
const LIFTS = [
  { key: 'in', label: 'In' },
  { key: 'out', label: 'Out' },
] as const;

type LiftKey = (typeof LIFTS)[number]['key'];
const LIFT: LiftKey = 'in';

/**
 * Three knobs, because the three things Qi asked for pull against each other and
 * one slider cannot separate them.
 *
 * DEPTH  - how far into the letter the shading reaches.
 * SHARP  - how hard its edge is. 0 is a soft falloff, 1 is a crisp slab with only
 *          enough blur left to antialias.
 * WHITE  - how much of the letter face stays pure white, by taking the dark
 *          band's opacity down. 1 removes the shading entirely.
 *
 * The greyness he was seeing is SHARP and WHITE together, not DEPTH: the dark
 * band is merged *over* the glyph, so the more it is blurred the further it
 * spreads across the face, and the whole letter dims. Sharpen it and it collapses
 * back to a line along the top wall, leaving the rest of the face untouched —
 * which is both the crisper and the whiter result, from the same move.
 */
const INSET_DEPTH = 2.2;
/* Defaults moved toward what Qi actually asked for — sharper and whiter than
   the first carve — so the slider starts in the right neighbourhood rather
   than at the grey setting he was reacting to. */
const INSET_SHARP = 0.85;
const INSET_WHITE = 0.5;

/**
 * Candidates for the "this one is sounding" colour, every one of them sampled
 * off the painting rather than invented. Drives --lit / --lit-bright /
 * --lit-dim, which in turn drive the poem line, its number, the tracklist line,
 * the waveform, the progress fill, the seek knob and the selection colour.
 *
 * Try them at `/?tune=1`. Once one is settled the rest can go.
 */
const LITS = [
  { key: 'foam', label: 'A  Foam white', lit: '#eef6f8', bright: '#ffffff', dim: 'rgba(238,246,248,.26)' },
  { key: 'sand', label: 'B  Sand', lit: '#d3bd93', bright: '#e8d6ae', dim: 'rgba(211,189,147,.26)' },
  { key: 'shell', label: 'C  Shell', lit: '#e9e0cf', bright: '#f7f1e5', dim: 'rgba(233,224,207,.26)' },
  { key: 'sea', label: 'D  Sea blue', lit: '#5ab0e0', bright: '#8ccdf0', dim: 'rgba(90,176,224,.26)' },
] as const;

type LitKey = (typeof LITS)[number]['key'];
const LIT: LitKey = 'foam';

/** Bars drawn in the waveform. 400 peaks per track downsample into this cleanly. */
const WAVE_BARS = 160;


type Panel = 'poem' | 'subscribe' | null;

function secondsUntil(releaseDate: string) {
  const target = new Date(releaseDate + 'T00:00:00').getTime();
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}

/**
 * The release, counted down in days / hours / minutes / seconds.
 *
 * Its own component with its own interval, so the rest of the page — the
 * waveform above all — is not reconciled once a second for a number nothing
 * else reads.
 *
 * The page is statically prerendered, so the HTML carries a build-time number
 * and the client disagrees on first render. That is what suppressHydrationWarning
 * is for.
 *
 * Each unit is keyed by its own value, so React replaces the node only when that
 * number actually changes — the seconds tick every second, the days once a day,
 * and the animation fires per unit rather than on the whole row. The global
 * prefers-reduced-motion rule kills the animation without touching the count.
 */
/**
 * The clock is owned by Landing and handed down, rather than kept here where it
 * used to live. The title's beat has to land on the same instant as the seconds
 * digit, and two intervals started a few milliseconds apart would separate
 * visibly inside a minute. One timer is the only way they stay together.
 *
 * secs is null until mounted. The page is statically prerendered, so any number
 * baked into the HTML is wrong by the time anyone loads it — and React does not
 * merely warn about mismatched text, it throws hydration away and re-renders the
 * tree. suppressHydrationWarning does not help either: it covers an element's own
 * text, not its grandchildren, and the digits are three levels down. Rendering
 * the same placeholder on both passes removes the mismatch instead of silencing
 * it, and keeps the row's size so nothing jumps.
 */
function Countdown({ secs }: { secs: number | null }) {
  if (secs !== null && secs <= 0) {
    return (
      <div className="l-cd">
        <div className="l-cd-lead">ALBUM</div>
        <div className="l-cd-row">
          <span className="l-cd-num l-cd-out">OUT NOW</span>
        </div>
      </div>
    );
  }

  const units: [number | null, string][] =
    secs === null
      ? [
          [null, 'DAYS'],
          [null, 'HOURS'],
          [null, 'MINUTES'],
          [null, 'SECONDS'],
        ]
      : [
          [Math.floor(secs / 86400), 'DAYS'],
          [Math.floor(secs / 3600) % 24, 'HOURS'],
          [Math.floor(secs / 60) % 60, 'MINUTES'],
          [secs % 60, 'SECONDS'],
        ];

  return (
    <div className="l-cd">
      <div className="l-cd-lead">ALBUM RELEASE IN</div>
      <div className="l-cd-row">
        {units.map(([v, label]) => (
          <span className="l-cd-unit" key={label}>
            <span className="l-cd-num" key={v ?? 'wait'}>
              {v ?? '–'}
            </span>
            <span className="l-cd-lbl">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The seek bar's waveform./**
 * The seek bar's waveform. Peaks come precomputed from `public/waveforms.json`
 * (see scripts/waveform.mjs) — decoding a 4 MB mp3 in the browser to draw a
 * 26px graphic would be absurd.
 *
 * Two identical sets of bars: one dim, one lit and clipped to the play head.
 * Only the clip rect's width changes as playback advances, so the 160 bars are
 * memoised and never re-created.
 */
function Waveform({ data, pct }: { data: number[]; pct: number }) {
  const bars = React.useMemo(() => {
    const step = data.length / WAVE_BARS;
    return Array.from({ length: WAVE_BARS }, (_, i) => {
      let peak = 0;
      for (let j = Math.floor(i * step); j < Math.floor((i + 1) * step); j++) {
        if (data[j] > peak) peak = data[j];
      }
      // A floor, so silence still reads as a bar rather than a gap.
      const h = 9 + (peak / 255) * 82;
      return <rect key={i} x={i + 0.18} y={(100 - h) / 2} width={0.64} height={h} rx={0.32} />;
    });
  }, [data]);

  return (
    <svg
      className="l-wave"
      viewBox={`0 0 ${WAVE_BARS} 100`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <clipPath id="l-wave-clip">
          <rect x="0" y="0" width={(pct / 100) * WAVE_BARS} height="100" />
        </clipPath>
      </defs>
      <g className="l-wave-dim">{bars}</g>
      <g className="l-wave-lit" clipPath="url(#l-wave-clip)">
        {bars}
      </g>
    </svg>
  );
}


/* ------------------------------------------------------------------ */

/**
 * The relief filter. CSS has no inner shadow for text, so this builds one — four
 * times over, one per surface of a cut letter.
 *
 * The trick behind every band is the same. Compositing a shape "out" against a
 * *shifted, blurred copy of itself* leaves only the sliver one of them failed to
 * cover; which sliver depends on which way round the two go:
 *
 *   SourceAlpha  out  shifted-copy   ->  a band INSIDE the glyph, hugging one edge
 *   shifted-copy out  SourceAlpha    ->  a band OUTSIDE it, lying alongside
 *
 * A real groove has four surfaces and the two pairs are exactly those. Going down
 * the letter from above: the lip where the surface bends into the cut (outside,
 * shadowed); the far wall (inside, shadowed); the floor, which is the letter face
 * itself; the near wall (inside, lit); and the lip bending back out (outside,
 * lit). 'carve' draws only the inner pair. 'cut' adds the outer one, which is
 * what Qi liked about 'groove' — that style is those same two lips done with
 * text-shadow, and it cannot have the inner walls because text-shadow only ever
 * paints behind the glyph. Hence lip, and hence two instances of this filter.
 *
 * dir flips every y offset at once, which turns the whole thing inside out into a
 * ridge. Nothing else has to change: see the note over LIFTS.
 *
 * Every offset is a fraction of titlePx rather than a fixed px, because a rim
 * only reads as an edge relative to the stroke it sits on. The first version of
 * this used constants and the shadow came out wider than Cormorant's hairlines,
 * which filled them in and turned the whole title grey.
 */
function CarveFilter({
  id,
  titlePx,
  depth,
  sharp,
  white,
  dir,
  lip,
}: {
  id: string;
  titlePx: number;
  depth: number;
  sharp: number;
  white: number;
  dir: number;
  lip: number;
}) {
  /* SHARP only ever touches a blur, never an offset — that is what keeps the
     letter face white. A blurred band spreads across the face and dims the whole
     letter; a sharp one collapses to a line on the wall and leaves the face
     alone. The floor of 0.001 is there so the edge still antialiases at SHARP 1. */
  const wallDy = titlePx * 0.011 * depth * dir;
  const wallBlur = titlePx * depth * (0.001 + 0.007 * (1 - sharp));
  const sheenDy = titlePx * -0.008 * depth * dir;
  const sheenBlur = titlePx * depth * (0.001 + 0.004 * (1 - sharp));
  /* The lips sit further out and stay softer than the walls: they are a bend in
     the surface, not a face of it, so they have no hard edge to catch. */
  const lipDy = titlePx * 0.014 * depth * dir;
  const lipBlur = titlePx * depth * (0.004 + 0.012 * (1 - sharp));
  const shade = 0.9 * (1 - white);

  return (
    <filter
      id={id}
      x="-35%"
      y="-35%"
      width="170%"
      height="170%"
      colorInterpolationFilters="sRGB"
    >
      {/* far wall — inside, along the top */}
      <feOffset in="SourceAlpha" dx="0" dy={wallDy} result="wallShift" />
      <feGaussianBlur in="wallShift" stdDeviation={wallBlur} result="wallBlur" />
      <feComposite in="SourceAlpha" in2="wallBlur" operator="out" result="wallBand" />
      <feFlood floodColor="#08243c" floodOpacity={shade} result="wallInk" />
      <feComposite in="wallInk" in2="wallBand" operator="in" result="wall" />

      {/* near wall — inside, along the bottom */}
      <feOffset in="SourceAlpha" dx="0" dy={sheenDy} result="sheenShift" />
      <feGaussianBlur in="sheenShift" stdDeviation={sheenBlur} result="sheenBlur" />
      <feComposite in="SourceAlpha" in2="sheenBlur" operator="out" result="sheenBand" />
      <feFlood floodColor="#ffffff" floodOpacity={0.95} result="sheenInk" />
      <feComposite in="sheenInk" in2="sheenBand" operator="in" result="sheen" />

      {/* upper lip — outside, where the surface bends down into the cut */}
      <feOffset in="SourceAlpha" dx="0" dy={-lipDy} result="lipUpShift" />
      <feGaussianBlur in="lipUpShift" stdDeviation={lipBlur} result="lipUpBlur" />
      <feComposite in="lipUpBlur" in2="SourceAlpha" operator="out" result="lipUpBand" />
      <feFlood floodColor="#061c32" floodOpacity={lip * 0.8 * (1 - white)} result="lipUpInk" />
      <feComposite in="lipUpInk" in2="lipUpBand" operator="in" result="lipUp" />

      {/* lower lip — outside, bending back out and catching the light */}
      <feOffset in="SourceAlpha" dx="0" dy={lipDy * 0.55} result="lipDownShift" />
      <feGaussianBlur in="lipDownShift" stdDeviation={lipBlur * 0.35} result="lipDownBlur" />
      <feComposite in="lipDownBlur" in2="SourceAlpha" operator="out" result="lipDownBand" />
      <feFlood floodColor="#ffffff" floodOpacity={lip * 0.7} result="lipDownInk" />
      <feComposite in="lipDownInk" in2="lipDownBand" operator="in" result="lipDown" />

      {/* Lips behind the glyph, walls in front of it. Both lips lie outside the
          outline, so their order against each other does not matter. */}
      <feMerge>
        <feMergeNode in="lipUp" />
        <feMergeNode in="lipDown" />
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="sheen" />
        <feMergeNode in="wall" />
      </feMerge>
    </filter>
  );
}

export function Landing({ releaseDate = '2026-12-20' }: { releaseDate?: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(false);
  const [peaks, setPeaks] = useState<Record<string, number[]> | null>(null);
  /** `/?tune=1` (or `?type=1`) opens the tuner. Dev affordance; renders for nobody else. */
  const [tuner, setTuner] = useState(false);
  const [font, setFont] = useState<PoemFontKey>(POEM_FONT);
  const [fontScale, setFontScale] = useState(1);
  const [vig, setVig] = useState(VIGNETTE);
  const [lit, setLit] = useState<LitKey>(LIT);
  const [typeScale, setTypeScale] = useState(HERO_TYPE_SCALE);
  const [inset, setInset] = useState<InsetKey>(INSET);
  const [lift, setLift] = useState<LiftKey>(LIFT);
  const [depth, setDepth] = useState(INSET_DEPTH);
  const [sharp, setSharp] = useState(INSET_SHARP);
  const [white, setWhite] = useState(INSET_WHITE);
  /** +1 cuts the letters in, -1 stands them off. See LIFTS. */
  const dir = lift === 'in' ? 1 : -1;
  /**
   * The title's rendered font size, in px. The carve filter's offsets are SVG
   * attributes, which cannot read em or var(), so the one thing that must scale
   * with the type has to be measured and passed in. 96 is a placeholder that
   * renders identically on both hydration passes; the effect corrects it.
   */
  const [titlePx, setTitlePx] = useState(96);
  /** One clock for the countdown and the title's beat. See Countdown. */
  const [secs, setSecs] = useState<number | null>(null);
  const [stripCut, setStripCut] = useState(false);
  /**
   * Which face the bottom bar is showing. Playback and the bar's view are
   * separate concerns: leaving the player must not stop the music, and stopping
   * the music must not strand you on a dead player.
   */
  const [barView, setBarView] = useState<'list' | 'player'>('list');

  const stripRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const curRef = useRef(0);
  const pctRef = useRef(0);
  /** Lets the `ended` listener advance a track without capturing a stale closure. */
  const playTrackRef = useRef<(n: number) => void>(() => {});

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setTuner(q.get('tune') === '1' || q.get('type') === '1');
  }, []);

  useEffect(() => {
    setSecs(secondsUntil(releaseDate));
    const iv = window.setInterval(() => setSecs(secondsUntil(releaseDate)), 1000);
    return () => window.clearInterval(iv);
  }, [releaseDate]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const read = () => setTitlePx(parseFloat(getComputedStyle(el).fontSize) || 96);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('resize', read);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', read);
    };
  }, []);

  /*
   * Whether the run-on tracklist is wider than the bar. Measured rather than
   * guessed at a breakpoint: the width depends on the fluid type, on which font
   * has finished loading, and on how much room the POEM button leaves — no
   * media query knows all three. Re-runs when the bar swaps to the player.
   */
  useEffect(() => {
    const el = stripRef.current;
    if (!el) {
      setStripCut(false);
      return;
    }
    /*
     * Deferred a frame on purpose. The observer can fire mid-transition — while
     * the media query is swapping the row from flex to block, the items are
     * still shrunk and the row measures as fitting when it will not, or the
     * reverse. Measuring after layout settles gives the honest number: without a
     * second pass the fade latched on at 1100px wide with nothing to scroll to.
     *
     * A timer rather than requestAnimationFrame, because rAF is suspended in a
     * background tab and the second measurement would simply never arrive.
     */
    let t = 0;
    const measure = () => setStripCut(el.scrollWidth > el.clientWidth + 1);
    const check = () => {
      measure();          // the common case, right away
      window.clearTimeout(t);
      t = window.setTimeout(measure, 60); // and again once layout has settled
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    // Belt and braces: a ResizeObserver on this element misses some window
    // resizes, so listen for the window too. Both funnel into the same debounce.
    window.addEventListener('resize', check);
    // A late webfont reflows the sentence without resizing anything.
    document.fonts?.ready.then(check).catch(() => {});
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', check);
      ro.disconnect();
    };
  }, [cur]);

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
  const peaksRequested = useRef(false);
  const loadPeaks = useCallback(() => {
    if (peaksRequested.current) return;
    peaksRequested.current = true;
    fetch('/waveforms.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPeaks(d))
      // No peaks is not an error — the bar falls back to a hairline.
      .catch(() => {});
  }, []);

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
      loadPeaks();
      const au = ensureAudio();
      if (curRef.current === n) {
        setBarView('player');
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
      setBarView('player');
      pctRef.current = 0;
      setCur(n);
      setMissing(false);
      setPct(0);
      au
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          // No demo uploaded yet — the bar still opens, labelled "DEMO PENDING".
          setMissing(true);
          setPlaying(false);
        });
    },
    [ensureAudio, loadPeaks],
  );
  playTrackRef.current = playTrack;

  /* --- seeking ---------------------------------------------------- */
  const seekRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const seekToClientX = useCallback((clientX: number) => {
    const el = seekRef.current;
    const au = audioRef.current;
    if (!el || !au || !au.duration || !isFinite(au.duration)) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    au.currentTime = f * au.duration;
    pctRef.current = f * 100;
    setPct(f * 100);
  }, []);

  const onSeekDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      // Capture keeps the drag alive outside the 2px bar. It throws if the
      // pointer isn't active (synthetic events, some browsers) — not fatal.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      seekToClientX(e.clientX);
    },
    [seekToClientX],
  );
  const onSeekMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (draggingRef.current) seekToClientX(e.clientX);
    },
    [seekToClientX],
  );
  const onSeekUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);
  const onSeekKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const au = audioRef.current;
    if (!au || !au.duration) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === 'ArrowRight') au.currentTime = Math.min(au.duration, au.currentTime + step);
    else if (e.key === 'ArrowLeft') au.currentTime = Math.max(0, au.currentTime - step);
    else if (e.key === 'Home') au.currentTime = 0;
    else return;
    e.preventDefault();
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    curRef.current = 0;
    pctRef.current = 0;
    setCur(0);
    setPlaying(false);
    setPct(0);
    setBarView('list');
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


  /**
   * Playing from the poem leaves the poem open — someone may still be reading,
   * and the line they just started now lights and fills in front of them, which
   * is better feedback than being thrown back to the bar. Clicking the line that
   * is already sounding toggles it, the ordinary meaning of clicking the item
   * you are already playing.
   *
   * Audio outlives the view it was started from either way: navigating never
   * silences a track as a side effect.
   */
  const playFromPoem = (n: number) => playTrack(n);

  const litVals = LITS.find((l) => l.key === lit) ?? LITS[0];

  const waveData = cur > 0 ? peaks?.[String(cur).padStart(2, '0')] ?? null : null;

  const nowTitle = cur
    ? (missing ? 'DEMO PENDING · ' : '') +
      String(cur).padStart(2, '0') +
      ' — ' +
      TITLES[cur - 1]
    : '';

  /* ---------------------------------------------------------------- */

  return (
    <div
      className="landing"
      style={
        {
          ['--lit' as string]: litVals.lit,
          ['--lit-bright' as string]: litVals.bright,
          ['--lit-dim' as string]: litVals.dim,
          ['--type-scale' as string]: typeScale,
          ['--inset' as string]: depth,
          ['--sharp' as string]: sharp,
          ['--white' as string]: white,
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      {/*
        The two filters that do the relief. Same construction, one difference:
        'cut' turns the outer lips on. See CarveFilter.
      */}
      <svg className="l-defs" aria-hidden focusable="false">
        <CarveFilter
          id="l-carve"
          titlePx={titlePx}
          depth={depth}
          sharp={sharp}
          white={white}
          dir={dir}
          lip={0}
        />
        <CarveFilter
          id="l-cut"
          titlePx={titlePx}
          depth={depth}
          sharp={sharp}
          white={white}
          dir={dir}
          lip={1}
        />
      </svg>

      {/*
        One layer, cover at every aspect ratio — only the crop moves. There used
        to be a blurred copy underneath holding the letterbox on narrow screens;
        at the blur radius that kept it from competing, the oil texture was gone
        and it read as flat colour, which is the one thing the background must
        never be. Positioning is in CSS, not inline — the media query has to be
        able to override it, and inline styles outrank stylesheet rules.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="l-bg"
        src={HERO_IMAGE}
        alt="A figure on the shore, looking down at a jellyfish in the shallows"
      />
      <div className="l-scrim" />
      <div
        className="l-vignette"
        style={
          {
            ['--vig-strength' as string]: vig.strength,
            ['--vig-inner' as string]: vig.inner + '%',
          } as React.CSSProperties
        }
      />

      <nav className="l-nav">
        <div className="l-nav-left">
          {META_PLACEMENT === 'topLeft' && (
            <div className="l-meta">
              <Countdown secs={secs} />
            </div>
          )}
        </div>
        <button type="button" className="l-nav-item" onClick={() => setPanel('subscribe')}>
          PRE-SAVE
        </button>
      </nav>

      <div className="l-hero">
        {META_PLACEMENT === 'eyebrow' && (
          <div className="l-meta l-meta-eyebrow">
            <Countdown secs={secs} />
          </div>
        )}
        <h1 className="l-title" data-inset={inset} data-lift={lift} ref={titleRef}>
          {/*
            The relief moved off the h1 and onto these spans, and it had to. The
            beat is a shadow that swells around one word, and any shadow painted
            by a descendant of a filtered element is fed back into that filter's
            SourceAlpha — the carve would then be computed from the glyph plus its
            own halo and smear. Per-word filters put the beat outside the carve
            instead of inside it. Nothing about the relief itself changes: the
            construction reads the alpha of whatever glyphs it is given, and the
            spans do not overlap.
          */}
          <span className="l-t">The </span>
          {/*
            Keyed on the second, so React remounts it on each tick and the CSS
            animation restarts from zero. Same value the digit is drawn from, so
            the swell and the number land together by construction rather than by
            two timers happening to agree.
          */}
          <span className="l-t-beat" key={secs ?? 'wait'}>
            <span className="l-t">Heart</span>
          </span>
          <br />
          <span className="l-t">of the Jellyfish</span>
        </h1>
        {META_PLACEMENT === 'underTitle' && (
          <div className="l-meta l-meta-under">
            <Countdown secs={secs} />
          </div>
        )}

        <div className="l-play-row">
          {/* The circle and its label are one action, so they share a hover — but
              only with each other. */}
          <span className="l-act-primary">
            <button
              type="button"
              className="l-play"
              aria-label={'Listen — ' + TITLES[FEATURED_DEMO - 1]}
              onClick={() => playTrack(FEATURED_DEMO)}
            >
              <svg width="13" height="15" viewBox="0 0 13 15" fill="currentColor" aria-hidden>
                <path d="M0 0l13 7.5L0 15z" />
              </svg>
            </button>
            <button type="button" className="l-play-label" onClick={() => playTrack(FEATURED_DEMO)}>
              {/*
                Per letter, so the motion is a transform and never a reflow.
                Opening the letter-spacing would have been the obvious move and
                is the wrong one — it widens the button, which shoves the rule
                and TRACKLIST sideways every time the cursor arrives.
              */}
              {Array.from('LISTEN NOW').map((ch, i) => (
                <span
                  key={i}
                  className="l-ll"
                  style={{ ['--i' as string]: i } as React.CSSProperties}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </button>
          </span>
          {/*
            Second action, deliberately unequal to the first. The circle carries
            the primary; this one is type alone with a rule that only appears
            under the cursor, so the two read as "do this" and "or this" rather
            than as a pair of equal buttons competing at the same weight.

            Labelled TRACKLIST, not POEM. It opens onto a poem, and the format
            says so at a glance — naming it beforehand spends the surprise for
            nothing.
          */}
          <span className="l-act-rule" aria-hidden />
          <button type="button" className="l-act-second" onClick={() => setPanel('poem')}>
            <svg width="12" height="10" viewBox="0 0 12 10" aria-hidden>
              <path d="M0 .5h12M0 5h12M0 9.5h8" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
            {/*
              Typed rather than revealed. The label has to stay readable at rest,
              so nothing can be hidden and un-hidden — instead the letters brighten
              one after another, as if a caret were passing under them, and the
              caret itself appears at the end of the sweep and blinks.
            */}
            {/* One wrapper, because the button is inline-flex with a gap meant for
                icon-to-text — loose letters would each become a flex item and
                collect that gap between them. */}
            <span className="l-type">
              {Array.from('TRACKLIST').map((ch, i) => (
                <span
                  key={i}
                  className="l-tl"
                  style={{ ['--i' as string]: i } as React.CSSProperties}
                >
                  {ch}
                </span>
              ))}
              <span className="l-caret" aria-hidden />
            </span>
          </button>
        </div>

        {META_PLACEMENT === 'underPlay' && (
          <div className="l-meta l-meta-under">
            <Countdown secs={secs} />
          </div>
        )}
      </div>

      {/* ---- the one bar at the bottom: tracklist, or the player ---- */}
      <div className="l-bar">
        {cur > 0 && barView === 'player' ? (
          <>
            <button
              type="button"
              className="l-bar-back"
              aria-label="Back to the tracklist"
              onClick={() => setBarView('list')}
            >
              ←
            </button>
            <button
              type="button"
              className="l-bar-toggle"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => playTrack(cur)}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="l-bar-title">{nowTitle}</div>
            <div
              ref={seekRef}
              className="l-bar-track"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pct)}
              onPointerDown={onSeekDown}
              onPointerMove={onSeekMove}
              onPointerUp={onSeekUp}
              onKeyDown={onSeekKey}
            >
              {waveData ? (
                <Waveform data={waveData} pct={pct} />
              ) : (
                <div className="l-bar-line">
                  <div className="l-bar-fill" style={{ width: pct.toFixed(1) + '%' }}>
                    <span className="l-bar-knob" />
                  </div>
                </div>
              )}
            </div>
            <button type="button" className="l-bar-close" aria-label="Close player" onClick={stop}>
              ✕
            </button>
          </>
        ) : (
          <>
            {/*
              The ten titles run together as one sentence — which is what they
              are. Each is still its own button; the hover is the only thing that
              says so, plus a tooltip naming the track.
            */}
            <div
              ref={stripRef}
              className={'l-strip-items' + (stripCut ? ' l-strip-cut' : '')}
            >
              {POEM.map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 && ' '}
                  <button
                    type="button"
                    className={'l-strip-item' + (cur === i + 1 ? ' l-strip-playing' : '')}
                    onClick={() => (cur === i + 1 ? setBarView('player') : playTrack(i + 1))}
                    title={String(i + 1).padStart(2, '0') + ' — ' + TITLES[i]}
                    aria-label={
                      (cur === i + 1 ? 'Back to player — ' : 'Play ') +
                      String(i + 1).padStart(2, '0') +
                      ' — ' +
                      TITLES[i]
                    }
                  >
                    {line}
                  </button>
                </React.Fragment>
              ))}
            </div>

          </>
        )}
      </div>

      {/* ---- tuner, /?tune=1 ---- */}
      {tuner && (
        <div className="l-tuner">
          <div className="l-tuner-head">VIGNETTE</div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.01}
              value={vig.strength}
              aria-label="Vignette strength"
              onChange={(e) => setVig((v) => ({ ...v, strength: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">strength {vig.strength.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={80}
              step={1}
              value={vig.inner}
              aria-label="Vignette spread"
              onChange={(e) => setVig((v) => ({ ...v, inner: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">inner {vig.inner}%</span>
          </div>

          <div className="l-tuner-head">HERO TYPE SIZE</div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.8}
              max={1.45}
              step={0.01}
              value={typeScale}
              aria-label="Hero type scale"
              onChange={(e) => setTypeScale(Number(e.target.value))}
            />
            <span className="l-tuner-val">×{typeScale.toFixed(2)}</span>
          </div>

          <div className="l-tuner-head">NOW PLAYING COLOUR</div>
          <div className="l-tuner-row">
            {LITS.map((l) => (
              <button
                key={l.key}
                type="button"
                className={'l-tuner-btn' + (l.key === lit ? ' l-tuner-on' : '')}
                onClick={() => setLit(l.key)}
              >
                <span className="l-tuner-dot" style={{ background: l.lit }} />
                {l.label}
              </button>
            ))}
          </div>

          <div className="l-tuner-head">TITLE RELIEF</div>
          <div className="l-tuner-row">
            {LIFTS.map((l) => (
              <button
                key={l.key}
                type="button"
                className={'l-tuner-btn' + (l.key === lift ? ' l-tuner-on' : '')}
                onClick={() => setLift(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="l-tuner-row">
            {INSET_STYLES.map((t) => (
              <button
                key={t.key}
                type="button"
                className={'l-tuner-btn' + (t.key === inset ? ' l-tuner-on' : '')}
                onClick={() => setInset(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={depth}
              aria-label="Inset depth"
              onChange={(e) => setDepth(Number(e.target.value))}
            />
            <span className="l-tuner-val">depth x{depth.toFixed(1)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={sharp}
              aria-label="Inset sharpness"
              onChange={(e) => setSharp(Number(e.target.value))}
            />
            <span className="l-tuner-val">sharp {sharp.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={white}
              aria-label="How white the letter face stays"
              onChange={(e) => setWhite(Number(e.target.value))}
            />
            <span className="l-tuner-val">white {white.toFixed(2)}</span>
          </div>

          <div className="l-tuner-head">POEM TYPE</div>
          <div className="l-tuner-row">
            {POEM_FONTS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={'l-tuner-btn' + (f.key === font ? ' l-tuner-on' : '')}
                onClick={() => setFont(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.7}
              max={1.6}
              step={0.05}
              value={fontScale}
              aria-label="Poem size"
              onChange={(e) => setFontScale(Number(e.target.value))}
            />
            <span className="l-tuner-val">
              {font} ×{fontScale.toFixed(2)}
            </span>
          </div>
        </div>
      )}

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
              <div className="l-poem-head">The Heart of the Jellyfish</div>
              <div
                className={'l-poem-body l-poem-f-' + font}
                style={{ ['--poem-scale' as string]: fontScale } as React.CSSProperties}
              >
                {STANZAS.map((stanza, si) => (
                  <div className="l-poem-stanza" key={si}>
                    {stanza.map((n) => {
                      const has = AVAILABLE_DEMOS.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          className={
                            'l-poem-line' +
                            (has ? '' : ' l-poem-soon') +
                            (cur === n ? ' l-poem-playing' : '')
                          }
                          onClick={() => playFromPoem(n)}
                          style={
                            cur === n
                              ? ({ ['--p' as string]: pct.toFixed(1) + '%' } as React.CSSProperties)
                              : undefined
                          }
                          aria-label={
                            (cur === n
                              ? 'Pause — '
                              : has
                                ? 'Play demo — '
                                : 'No demo yet — ') + TITLES[n - 1]
                          }
                        >
                          <span className="l-poem-num" aria-hidden>
                            {String(n).padStart(2, '0')}
                          </span>
                          {POEM[n - 1]}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="l-sub">
              <h2 className="l-sub-title">Follow thy heart ;)</h2>
              <p className="l-sub-copy">
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
                    placeholder="Email address"
                    aria-label="Email address"
                    className="l-sub-input"
                  />
                  <button type="submit" className="l-sub-btn">
                    SIGN UP
                  </button>
                </form>
              )}
              <div className="l-sub-foot">
                QI — 12 · 20 · 2026 ·{' '}
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
  font-family:'Cormorant Garamond',serif;
  /* Fallbacks. The live values come from LITS via an inline style on this
     element, so /?tune=1 can swap them without a rebuild. Everything that means
     "this is the one sounding" reads them: the poem line, its number, the
     tracklist line, the waveform, the progress, the seek knob, the selection. */
  --lit:#eef6f8;
  --lit-bright:#ffffff;
  --lit-dim:rgba(238,246,248,.26);
  /* Multiplies the hero block's type — title, countdown, the two actions. Every
     one of those is already fluid, so this scales the whole curve rather than
     any one breakpoint. The bottom tracklist is deliberately NOT on it: its
     sizing is a measured fit for ten titles and scaling it would break that. */
  --type-scale:1.15}
.landing ::selection{background:rgba(230,207,130,.32)}
/* Normalises the UA button font. Note it is (0,1,1) and beats any bare .l-*
   class, so every button rule below that sets a font has to be written as
   ".landing .l-foo" to win. That is why those selectors look over-qualified. */
.landing button{font:inherit}

/* ---- background ---- */
.l-bg{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:center 45%}
.l-scrim{position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(180deg,rgba(24,74,112,.28),rgba(24,74,112,.05) 30%,transparent 55%)}

/* Darkens the corners so the painting sits in a frame rather than running off the
   edges, and so white type near the edges has something to sit on. Above the art,
   below every piece of type — z-index 1 against the nav/hero/bar's 10 and 20.

   Six stops on an ease-in curve, not two. A straight transparent-to-dark ramp is
   linear in alpha, and the eye reads the kink where the ramp begins as a hard
   elliptical ring. Weighting the early stops far below linear (.04, .14 where
   linear would be .30, .52) hides the onset completely and puts the darkness
   where it belongs, in the last fifth. --vig-inner marks where the ramp starts;
   --vig-span is the distance it has left to travel. */
.l-vignette{position:absolute;inset:0;z-index:1;pointer-events:none;
  --vig-span:calc(100% - var(--vig-inner,42%));
  background:radial-gradient(ellipse at center,
    rgba(5,22,38,0) var(--vig-inner,42%),
    rgba(5,22,38,calc(var(--vig-strength,.38) * .04)) calc(var(--vig-inner,42%) + var(--vig-span) * .30),
    rgba(5,22,38,calc(var(--vig-strength,.38) * .14)) calc(var(--vig-inner,42%) + var(--vig-span) * .52),
    rgba(5,22,38,calc(var(--vig-strength,.38) * .32)) calc(var(--vig-inner,42%) + var(--vig-span) * .70),
    rgba(5,22,38,calc(var(--vig-strength,.38) * .60)) calc(var(--vig-inner,42%) + var(--vig-span) * .86),
    rgba(5,22,38,var(--vig-strength,.38)) 100%)}

/* Narrower than 13:10 the painting is 16:9 against a portrait window, so a cover
   crop shows only a slice of it — and both subjects cannot survive that, since
   the jellyfish sits at the far left and the figure at the far right. Follow the
   jellyfish: it is the album's title and it reads at any size, while the shore
   break behind it gives the crop somewhere to go. Vertically 42% keeps sky over
   the type and water under it.

   Cropping is the whole point. The alternative was letterboxing the full
   painting over a blurred copy of itself, and the blur that made the backdrop
   recede also erased the brushwork — texture everywhere beats composition
   intact. */
@media (max-aspect-ratio: 13/10){
  /* 12%, not 22%: at 22 the right edge landed on the figure's head and clipped a
     corner of it, which reads as a smudge rather than a person. Better to leave
     him out of frame entirely than to show a piece of him. */
  .l-bg{object-position:12% 45%}
}
@media (max-aspect-ratio: 1/1){
  .l-bg{object-position:17% 42%}
}

/* ---- nav ---- */
.l-nav{position:absolute;top:0;left:0;right:0;z-index:20;
  display:flex;justify-content:space-between;align-items:center;
  padding:26px clamp(24px,3vw,52px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;letter-spacing:.3em}
.l-nav-left{display:flex;gap:clamp(20px,2.6vw,42px);align-items:baseline}
.l-nav-item{color:inherit;text-decoration:none;white-space:nowrap;
  background:none;border:none;padding:0;cursor:pointer;opacity:.95;transition:opacity .4s;
  text-shadow:0 1px 2px rgba(10,42,70,.5)}
.l-nav-item:hover{opacity:1}

/* ---- hero ---- */
.l-hero{position:absolute;z-index:10;
  left:clamp(24px,3vw,52px);top:clamp(96px,17vh,190px);
  display:flex;flex-direction:column;align-items:flex-start;
  text-shadow:0 1px 3px rgba(12,52,84,.30),0 1px 26px rgba(12,52,84,.34);
  animation:l-rise 1.6s cubic-bezier(.2,.7,.2,1) both}
@keyframes l-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
/* The countdown, four possible homes. Same type in all of them so the choice is
   only about position. */
.l-meta{white-space:nowrap}

.l-cd{display:flex;flex-direction:column;gap:clamp(7px,1.1vh,13px)}
/* The numbers are 21-40px Cormorant and read fine; the labels were 9px Jost at
   .62 opacity over a pale sky, which is nowhere near enough. The hero's shared
   text-shadow is tuned for large glyphs — small letterspaced caps need a tight
   dark one of their own, and the weight up from 300 to 400. */
.l-cd-lead{font-family:'Jost',sans-serif;font-weight:400;
  letter-spacing:.42em;opacity:.92;font-size:calc(11px * var(--type-scale,1));
  text-shadow:0 1px 2px rgba(10,42,70,.55),0 0 12px rgba(10,42,70,.4)}
.l-cd-row{display:flex;align-items:flex-end;gap:clamp(14px,1.8vw,32px)}
.l-cd-unit{display:flex;align-items:baseline;gap:.42em}
/* Tabular figures, or the row twitches sideways every time a digit changes width. */
.l-cd-num{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  text-shadow:0 1px 3px rgba(10,42,70,.45);
  font-size:calc(clamp(21px,2.7vw,40px) * var(--type-scale,1));line-height:1;
  font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1;
  display:inline-block;
  animation:l-tick .5s cubic-bezier(.16,.9,.24,1) both}
.l-cd-lbl{font-family:'Jost',sans-serif;font-weight:400;
  letter-spacing:.26em;opacity:.9;font-size:calc(11px * var(--type-scale,1));
  text-shadow:0 1px 2px rgba(10,42,70,.55),0 0 12px rgba(10,42,70,.4)}
.l-cd-out{animation:none;letter-spacing:.1em}

/* Fires per unit, because each unit's node is keyed by its own value — the
   seconds land every second, the minutes once a minute, the days once a day. */
@keyframes l-tick{
  from{opacity:0;transform:translateY(-.22em) scale(1.18);filter:blur(2px)}
  60%{opacity:1;filter:blur(0)}
  to{opacity:1;transform:none;filter:none}
}
.l-meta-eyebrow{margin-bottom:clamp(14px,2.2vh,26px)}
.l-meta-under{margin-top:clamp(18px,2.8vh,34px);opacity:.95}
.l-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:calc(clamp(42px,7.2vw,104px) * var(--type-scale,1));line-height:1.04;
  /* At line-height 1.04 the element's box is smaller than the ink it holds:
     measured at 106px, the glyphs overshoot it by 9px at the bottom and 9.5px at
     the top. Anything that paints from the box rather than from the outline then
     cuts through the letters — which is how the descender of "Jellyfish" once
     vanished entirely under background-clip:text, and which also decides where
     the carve filter's region gets measured from. Pad the box out past the ink
     and pull the same amount back off the margin, so the shape below does not
     move. .l-hero is a flex column, so these negative margins cannot collapse
     into the countdown's margin-top. */
  padding:.2em 0;margin:-.2em 0}

/* ---- how deep the title sits, /?tune=1 -------------------------------------
   Three readings of the same idea, all scaled by --inset so one slider moves the
   whole thing. Every length below is a multiple of it; nothing is a bare pixel.

   The physics being imitated is a groove under light from above: the wall at the
   top of the cut faces away from the light and goes dark, the wall at the bottom
   faces into it and catches a highlight. Get that pair the wrong way round and
   the letters pop out of the surface instead of into it. */

/* A - the original, only no longer 1px. Two hard rims and an ambient shadow
   underneath. text-shadow paints behind the glyph, so both rims sit just outside
   the letter rather than inside it — which is why this reads as lit from above
   rather than as cut, and why it stays perfectly crisp. */
/* --dir is the whole of "in" versus "out". Every y offset below is multiplied by
   it, so flipping it moves the shadowed wall from the top of each letter to the
   bottom and the lit wall the other way — a ridge instead of a groove, out of the
   same four shadows. The ambient underneath is the one thing it does not touch:
   the light is still overhead either way, so the cast shadow still falls below.
   A ridge does throw a longer one than a dent, which is what --cast is for. */
.l-title{--dir:1;--cast:1}
.l-title[data-lift=out]{--dir:-1;--cast:1.9}

.l-title[data-inset=edge] .l-t{
  text-shadow:
    0 calc(-.009em * var(--inset,1) * var(--dir)) 0 rgba(8,34,58,calc(.8 * (1 - var(--white,.3)))),
    0 calc(.009em * var(--inset,1) * var(--dir)) 0 rgba(255,255,255,.66),
    0 calc(.018em * var(--inset,1) * var(--cast)) calc(.06em * var(--inset,1)) rgba(8,34,58,.30)}

/* B - the same rims, but the dark one is doubled and the second copy falls off
   into the surface the way the lip of a depression would. Its blur is the one
   length here that SHARP touches; the light rim stays hard at every setting,
   because a lit edge is a specular and not a gradient. */
.l-title[data-inset=groove] .l-t{
  text-shadow:
    0 calc(-.009em * var(--inset,1) * var(--dir)) calc(.009em * var(--inset,1) * (1 - var(--sharp,.55))) rgba(6,28,50,calc(.9 * (1 - var(--white,.3)))),
    0 calc(-.02em * var(--inset,1) * var(--dir)) calc(.036em * var(--inset,1) * (1 - var(--sharp,.55))) rgba(6,28,50,calc(.44 * (1 - var(--white,.3)))),
    0 calc(.009em * var(--inset,1) * var(--dir)) 0 rgba(255,255,255,.76),
    0 calc(.027em * var(--inset,1) * var(--cast)) calc(.09em * var(--inset,1)) rgba(6,28,50,.26)}

/* C - the only one where the shading is genuinely inside the glyph. See the SVG
   in the markup for how the two inner bands are built, and INSET_DEPTH for what
   the three knobs do to them. text-shadow has to go, or it would fight the
   filter; the ambient shadow comes back as a drop-shadow chained after it, which
   sees the carved result rather than the raw outline — and stays outside the
   three knobs, since it is the only part that is not the relief itself. */
.l-title[data-inset=carve] .l-t{
  text-shadow:none;
  filter:url(#l-carve)
         drop-shadow(0 calc(.018em * var(--inset,1) * var(--cast)) calc(.08em * var(--inset,1)) rgba(8,34,58,.34))}

/* D - the whole cut. Same filter with its outer lips switched on, which is the
   pair of surfaces 'groove' was drawing with text-shadow. Groove can only ever
   have those two: text-shadow paints behind the glyph, so it has no way to reach
   the inner walls. Running both pairs at once is the only version of this that
   describes an actual groove rather than half of one. */
.l-title[data-inset=cut] .l-t{
  text-shadow:none;
  filter:url(#l-cut)
         drop-shadow(0 calc(.018em * var(--inset,1) * var(--cast)) calc(.08em * var(--inset,1)) rgba(8,34,58,.34))}

/* Every length above is in em, not px. A rim is only read as an edge relative to
   the stroke it sits on, and the stroke scales with the type: the same 2px that
   is a crisp edge at 120px is a smear at 48px. The carve's own offsets cannot be
   em — they are SVG attributes — which is why titlePx exists. */

.l-defs{position:absolute;width:0;height:0;overflow:hidden;pointer-events:none}

/* The beat on "Heart".

   It is the depth slider being pulled up and let go: a dark rim that swells out
   above the word and softens as it grows, and the lit rim below swelling with it.
   Both are drop-shadows on a wrapper *outside* the carve, so the swell reads as
   the cut deepening rather than as the glyph itself changing.

   Fast attack, slow release, because that is the shape of a beat — a symmetric
   swell reads as breathing. The dark rim is offset by --dir like every other
   shadow in the relief, so the beat follows the letters if they are ever turned
   inside out.

   Timing is not in this file. The span is keyed on the countdown's seconds, so
   React remounts it on the tick and the animation restarts from 0% — there is no
   second timer to drift. */
.l-t-beat{animation:l-beat 1s both}
@keyframes l-beat{
  0%{filter:drop-shadow(0 0 0 rgba(6,28,50,0)) drop-shadow(0 0 0 rgba(255,255,255,0));
     animation-timing-function:cubic-bezier(.15,.85,.25,1)}
  11%{filter:drop-shadow(0 calc(-.034em * var(--dir,1)) .055em rgba(6,28,50,.62))
             drop-shadow(0 calc(.021em * var(--dir,1)) .006em rgba(255,255,255,.72));
      animation-timing-function:cubic-bezier(.4,0,.55,1)}
  100%{filter:drop-shadow(0 0 0 rgba(6,28,50,0)) drop-shadow(0 0 0 rgba(255,255,255,0))}
}
@media (prefers-reduced-motion:reduce){
  .l-t-beat{animation:none}
}

.l-act-primary{display:flex;align-items:center;gap:clamp(14px,1.4vw,20px)}
.l-play-row{display:flex;align-items:center;gap:clamp(14px,1.4vw,20px);margin-top:clamp(26px,4.2vh,52px)}
/* The primary action. On hover the ring fills and the glyph inverts — the button
   stops being an outline and becomes a thing you have already half-pressed. The
   ::after is a second ring that expands and fades, so the state change reads as
   motion rather than as a colour swap. */
.landing .l-play{position:relative;
  width:clamp(58px,4.6vw,76px);height:clamp(58px,4.6vw,76px);border-radius:50%;
  border:1px solid rgba(255,255,255,.8);background:transparent;color:#fff;cursor:pointer;
  flex-shrink:0;display:flex;align-items:center;justify-content:center;padding-left:4px;
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,
             border-color .4s,transform .4s cubic-bezier(.2,.8,.2,1)}
.landing .l-play::after{content:'';position:absolute;inset:-1px;border-radius:50%;
  border:1px solid rgba(255,255,255,.75);opacity:0;transform:scale(1);
  transition:opacity .5s,transform .5s cubic-bezier(.2,.8,.2,1);pointer-events:none}
.landing .l-play svg{transition:transform .4s cubic-bezier(.2,.8,.2,1)}

.l-act-primary:hover .l-play,
.landing .l-play:focus-visible{background:#fff;color:#0d3550;border-color:#fff;
  transform:scale(1.06)}
.l-act-primary:hover .l-play::after,
.landing .l-play:focus-visible::after{opacity:0;transform:scale(1.42)}
.l-act-primary:hover .l-play svg{transform:scale(1.12)}
.landing .l-play-label{border:none;background:none;padding:0;color:inherit;cursor:pointer;
  font-family:'Jost',sans-serif;font-weight:400;letter-spacing:.32em;
  font-size:calc(12px * var(--type-scale,1));opacity:1;transition:opacity .4s;
  text-shadow:0 1px 2px rgba(10,42,70,.55),0 0 12px rgba(10,42,70,.4)}
/* A wave through the word: each letter lifts on its own delay and settles in the
   same order on the way out. 26ms apart is enough to read as a ripple and short
   enough that the whole word has moved before the eye finishes crossing it. */
.l-ll{display:inline-block;
  transition:transform .34s cubic-bezier(.2,.85,.25,1);
  transition-delay:calc(var(--i,0) * 26ms)}
.l-act-primary:hover .l-ll{transform:translateY(-3px)}

.l-act-rule{width:1px;align-self:stretch;margin:0 clamp(4px,.7vw,14px);
  background:currentColor;opacity:.28}
.landing .l-act-second{background:none;border:none;padding:2px 0;color:inherit;
  cursor:pointer;font-family:'Jost',sans-serif;font-weight:400;letter-spacing:.32em;
  font-size:calc(12px * var(--type-scale,1));opacity:1;
  text-shadow:0 1px 2px rgba(10,42,70,.55),0 0 12px rgba(10,42,70,.4);
  display:inline-flex;align-items:center;gap:9px;
  border-bottom:1px solid transparent;
  transition:opacity .4s,border-color .4s}
.landing .l-act-second svg{opacity:.8;transition:opacity .4s}
.landing .l-act-second:hover svg{opacity:1}
.landing .l-act-second:hover{border-bottom-color:currentColor}

/* Struck, not faded. The first version cross-faded each letter .74 -> 1 on a
   stagger and was invisible: a 26% opacity step on 12px white type over a pale
   sky is below the threshold at which anyone notices a sequence. Motion is not.

   So each letter is knocked down 2px and springs back, and animation-fill-mode
   set to both does the real work — during its delay a letter holds the 0% keyframe,
   which is the dimmed state, so the word darkens the instant the cursor lands
   and then re-types itself left to right. 50ms a letter against LISTEN NOW's
   26ms: a ripple is a wave and wants to be continuous, typing is discrete and
   wants you to hear each key. */
.l-type{display:inline-block;white-space:nowrap}
.l-tl{display:inline-block}
.landing .l-act-second:hover .l-tl{
  animation:l-strike .32s cubic-bezier(.22,.9,.3,1) both;
  animation-delay:calc(var(--i,0) * 50ms)}
@keyframes l-strike{
  0%{transform:none;opacity:.42}
  40%{transform:translateY(2px);opacity:1}
  100%{transform:none;opacity:1}
}

/* Arrives once the sweep has crossed all nine letters, then blinks. */
.l-caret{display:inline-block;width:1px;height:.9em;margin-left:-.18em;
  background:currentColor;opacity:0;vertical-align:-.06em}
.landing .l-act-second:hover .l-caret{
  animation:l-blink .9s steps(1) infinite;animation-delay:720ms}
@keyframes l-blink{0%,49%{opacity:1}50%,100%{opacity:0}}


/* ---- the bar: tracklist, or the player ---- */
/* A scrim, not a block. A solid bar cut ~70px off the bottom of the painting —
   which on a 16:9 canvas is the sand and the near water. The gradient keeps the
   type legible while the art runs all the way to the edge of the screen. */
.l-bar{position:absolute;left:0;right:0;bottom:0;z-index:20;
  height:clamp(76px,11vh,104px);display:flex;align-items:center;
  gap:clamp(12px,1.2vw,22px);padding:0 clamp(20px,2.2vw,44px);
  background:linear-gradient(0deg,rgba(9,36,58,.86),rgba(9,36,58,.52) 62%,transparent);
  color:#f2f6f8;overflow-x:auto;scrollbar-width:none;
  text-shadow:0 1px 8px rgba(6,26,44,.55)}
.l-bar::-webkit-scrollbar{display:none}
.landing 
/* Ten titles, each in its own slot, spread across the bar — no numbers, no
   separators. flex:0 1 auto (not 1 1 0) sizes each to its own text and shrinks
   them proportionally, so "Wake up!" never claims the same width as "what
   belongs to the sea will always return to the sea." Dropping the numbers freed
   roughly 155px, and all of it went into the gaps. */
.l-strip-items{flex:1;min-width:0;
  display:flex;align-items:baseline;justify-content:space-between;
  gap:clamp(10px,1.15vw,28px);
  font-family:'Cormorant Garamond',serif;font-style:italic;
  font-size:clamp(10.5px,.88vw,16.5px)}
.l-strip-item{flex:0 1 auto;min-width:0;
  background:none;border:none;padding:0;color:inherit;cursor:pointer;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  opacity:.88;transition:opacity .3s,color .3s}
.l-strip-item:hover{opacity:1;color:#fff}
/* The line that is sounding. Lit rather than badged — the bar gains no chrome,
   and clicking it is the way back into the player. */
.landing .l-strip-playing{opacity:1;color:var(--lit)}
.landing .l-strip-playing:hover{color:var(--lit-bright)}

.landing .l-bar-back{background:none;border:none;padding:0 2px;color:inherit;
  cursor:pointer;font-size:15px;opacity:.6;flex-shrink:0;transition:opacity .3s}
.landing .l-bar-back:hover{opacity:1}

/* Too narrow for ten slots, and ten ellipsised half-words read worse than
   anything. Below this the same markup becomes one scrolling sentence: the flex
   container turns into a line of inline buttons, and the whitespace between them
   — ignored while it was a flex container — starts doing its job as word space. */
@media (max-width:1180px){
  /* .landing-qualified, because the base rules are too — a bare .l-strip-items
     here loses on specificity no matter that it comes later. Same trap as
     .landing button{font:inherit}; see the note further down. */
  .landing .l-strip-items{display:block;white-space:nowrap;overflow-x:auto;
    scrollbar-width:none;font-size:clamp(11px,1.05vw,14px)}
  .landing .l-strip-items::-webkit-scrollbar{display:none}
  .landing .l-strip-item{display:inline;overflow:visible}
}

.l-bar-toggle{width:38px;height:38px;border-radius:50%;border:1px solid rgba(242,246,248,.6);
  background:transparent;color:inherit;font-size:12px;cursor:pointer;flex-shrink:0;
  transition:background .35s}
.l-bar-toggle:hover{background:rgba(242,246,248,.18)}
/* The title yields first. Track 08's name is 53 characters and was squeezing the
   waveform down to its 60px floor; the waveform is the thing you aim at, the
   title is a label you can read the end of somewhere else. */
.l-bar-title{font-family:'Jost',sans-serif;font-weight:300;font-size:12px;letter-spacing:.2em;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 1 auto;min-width:0}
/* Looks like a 2px hairline, but the hit area is the full bar height so it can
   actually be grabbed. The visible line is the ::before. */
.l-bar-track{flex:1 0 34%;min-width:130px;height:26px;display:flex;align-items:center;
  cursor:pointer;position:relative;touch-action:none;outline:none}
.l-bar-line{position:absolute;left:0;right:0;height:2px;
  background:rgba(242,246,248,.28);border-radius:1px}
.l-bar-fill{position:relative;height:2px;background:var(--lit);border-radius:1px}

/* The waveform fills the same hit area the hairline did, so seeking is
   identical either way. */
.l-wave{position:absolute;inset:0;width:100%;height:100%;display:block}
.l-wave-dim rect{fill:rgba(242,246,248,.30)}
.l-wave-lit rect{fill:var(--lit)}
.l-bar-knob{position:absolute;right:0;top:50%;width:9px;height:9px;border-radius:50%;
  background:var(--lit);transform:translate(50%,-50%) scale(0);
  transition:transform .2s}
.l-bar-track:hover .l-bar-knob,
.l-bar-track:focus-visible .l-bar-knob{transform:translate(50%,-50%) scale(1)}
.l-bar-track:focus-visible .l-bar-line{background:rgba(242,246,248,.6)}
.l-bar-track:focus-visible .l-wave-dim rect{fill:rgba(242,246,248,.5)}
.landing .l-bar-close{border:none;background:transparent;color:inherit;font-size:14px;cursor:pointer;
  opacity:.55;flex-shrink:0;transition:opacity .3s}
.l-bar-close:hover{opacity:1}

/* ---- panels ---- */
.l-panel{position:absolute;inset:0;z-index:30;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:clamp(60px,9vh,110px) clamp(24px,6vw,80px);
  background:rgba(8,34,56,.80);backdrop-filter:blur(14px);
  animation:l-fade .5s ease both;overflow-y:auto}
@keyframes l-fade{from{opacity:0}to{opacity:1}}
.landing .l-panel-close{position:absolute;top:22px;right:clamp(24px,3vw,52px);
  background:none;border:none;color:#fff;font-size:18px;cursor:pointer;
  opacity:.6;transition:opacity .3s;z-index:2}
.l-panel-close:hover{opacity:1}

.l-poem{display:flex;flex-direction:column;align-items:flex-start;text-align:left;
  margin:auto;max-width:min(880px,94vw);
  /* room for the numbers to hang outside the text column */
  padding-left:3.2em}
/* The poem's own hand, at Qi's call.
   
   The risk this accepts: "The heart of the jellyfish." is also line 06, so in the
   same face the title and that line are nearly the same string. What keeps them
   apart is not the typeface but the ranking — the title runs about 1.6x the
   line size with ~90px of air under it, and it is the only thing in the panel
   that is not a button. If it ever starts reading as the poem's first line, that
   ratio is the knob, not the font. */
.l-poem-head{font-family:'Nothing You Could Do',cursive;font-weight:400;
  font-size:clamp(24px,3.4vh,38px);letter-spacing:.01em;line-height:1.2;
  opacity:.72;margin-bottom:clamp(46px,9.5vh,98px)}
.l-poem-body{display:flex;flex-direction:column;
  gap:clamp(18px,3.2vh,38px)}          /* the space between stanzas */
.l-poem-stanza{display:flex;flex-direction:column;gap:clamp(1px,.35vh,5px)}

.landing .l-poem-line{position:relative;display:block;width:100%;text-align:left;
  background:none;border:none;padding:2px 0;color:#eef5f9;cursor:pointer;
  font-family:var(--poem-family);font-style:var(--poem-style);font-weight:var(--poem-weight);
  font-size:calc(var(--poem-size) * var(--poem-scale,1));line-height:var(--poem-lh);
  opacity:.94;transition:opacity .35s,color .35s}
.landing .l-poem-line:hover{opacity:1;color:#fff}
/* Tracks with no demo read slightly quieter — enough to hint, not enough to
   break the poem's even colour. The poem is the work; availability is metadata. */
.landing .l-poem-soon{opacity:.62}
.landing .l-poem-soon:hover{opacity:.8;color:#eef5f9}

/* One variable set per candidate face. Sizes are not interchangeable: the
   scripts have much smaller x-heights than Cormorant. */
.l-poem-f-nothing{--poem-family:'Nothing You Could Do',cursive;--poem-style:normal;
  --poem-weight:400;--poem-size:clamp(15px,2.2vh,24px);--poem-lh:1.75}
.l-poem-f-cormorant{--poem-family:'Cormorant Garamond',serif;--poem-style:italic;
  --poem-weight:500;--poem-size:clamp(17px,2.5vh,26px);--poem-lh:1.55}

.l-poem-num{position:absolute;right:calc(100% + .55em);top:.06em;
  font-family:'Nothing You Could Do',cursive;font-weight:400;
  font-size:.62em;letter-spacing:0;
  opacity:0;transition:opacity .3s}
.l-poem-line:hover .l-poem-num{opacity:.5}
/* No cursor to hover with — show them, or the poem hides that it is playable. */
@media (hover:none){.l-poem-num{opacity:.38}}

/* The line that is sounding does not merely light up — it fills, left to right,
   in step with the track. Someone reading along with a finger under the words.
   The poem and the player stop being two things.

   Mechanically: a two-stop gradient at 200% width, clipped to the glyphs, slid
   by --p (the play percentage, handed down inline). Sliding background-position
   is what makes it smooth — gradient colour stops cannot be transitioned, but
   position can, so the ~0.7s progress updates arrive as continuous motion
   instead of a stutter. The 48/52 split is a soft edge: ink spreading, not a
   wipe. */
.landing .l-poem-playing{opacity:1;color:var(--lit)}
.landing .l-poem-playing:hover{color:var(--lit-bright)}

@supports ((-webkit-background-clip:text) or (background-clip:text)){
  .landing .l-poem-playing{
    background-image:linear-gradient(90deg,
      var(--lit-bright) 48%, rgba(238,245,249,.34) 52%);
    background-size:200% 100%;
    background-position:calc(100% - var(--p,0%)) 0;
    background-repeat:no-repeat;
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;
    transition:background-position 1s linear,opacity .35s;
  }
  /* the number is a child, so it would inherit the transparent fill */
  .landing .l-poem-playing .l-poem-num{-webkit-text-fill-color:currentColor}
}

.landing .l-poem-playing .l-poem-num{color:var(--lit);
  animation:l-breathe 2.8s ease-in-out infinite}
@keyframes l-breathe{0%,100%{opacity:.32}50%{opacity:.95}}


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
.landing .l-sub-btn{padding:13px 28px;border:1px solid rgba(255,255,255,.7);background:transparent;
  color:#fff;font-family:'Jost',sans-serif;font-weight:300;font-size:11px;
  letter-spacing:.4em;cursor:pointer;transition:background .4s,color .4s}
.l-sub-btn:hover{background:#fff;color:#0b2438}
.l-sub-thanks{font-size:16px;font-style:italic;font-family:'Cormorant Garamond',serif}
.l-sub-foot{font-family:'Jost',sans-serif;font-weight:300;font-size:10px;
  letter-spacing:.34em;opacity:.55;line-height:2.4;margin-top:clamp(18px,4vh,40px)}
.l-sub-link{color:inherit;border-bottom:1px solid currentColor;text-decoration:none}

/* ---- narrow ---- */
/* Only when the row really is wider than the bar — see the ResizeObserver in the
   component. It scrolls rather than truncating, and the fade says so. */
.l-strip-cut{
  -webkit-mask-image:linear-gradient(90deg,#000 86%,transparent);
  mask-image:linear-gradient(90deg,#000 86%,transparent);
}
/* All four countdown units have to stay on one line, so on a phone the type
   gives. These are still multiplied by --type-scale — a hardcoded px here would
   silently opt the countdown out of the scale on mobile only, which is exactly
   the desktop/mobile split this page must not have.
   
   The two actions are the exception and do NOT scale below 560px: they sit on
   one horizontal line with a rule between them, and at 1.15 that row came within
   8px of a 390px screen's edge. The title has its own line and can grow; this
   row cannot. */
@media (max-width:560px){
  .l-nav{letter-spacing:.2em;font-size:11px}
  .l-cd-lead{letter-spacing:.3em;font-size:calc(10px * var(--type-scale,1))}
  .l-cd-row{gap:11px}
  .l-cd-unit{gap:.32em}
  .l-cd-num{font-size:calc(18px * var(--type-scale,1))}
  .l-cd-lbl{font-size:calc(8.6px * var(--type-scale,1));letter-spacing:.14em}
  .landing .l-play-label,
  .landing .l-act-second{font-size:11.5px;letter-spacing:.26em}
  .l-play-row{gap:12px}
  .l-act-primary{gap:12px}
}

/* Dev-only, behind /?type=1 — never rendered for a visitor. */
.l-tuner{position:absolute;right:18px;top:76px;z-index:40;max-width:248px;
  max-height:calc(100vh - 108px);overflow-y:auto;scrollbar-width:thin;
  display:flex;flex-direction:column;gap:10px;align-items:flex-start;
  padding:14px 18px;border-radius:4px;
  background:rgba(6,26,44,.88);backdrop-filter:blur(8px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11px;letter-spacing:.12em}
.l-tuner-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.l-tuner-btn{background:none;border:1px solid rgba(255,255,255,.28);color:#dfeaf1;
  padding:6px 11px;border-radius:3px;cursor:pointer;font-size:11px;letter-spacing:.1em;
  display:inline-flex;align-items:center;gap:7px}
.l-tuner-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;
  box-shadow:0 0 0 1px rgba(0,0,0,.25)}
.l-tuner-on{background:var(--lit-dim);border-color:var(--lit);color:#fff}
.l-tuner-val{opacity:.7;min-width:12ch}
/* Ten texture buttons, two to a row, so the labels stay readable and the
   panel does not run off the bottom of a laptop screen. */
.l-tuner-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;width:100%}
.l-tuner-grid .l-tuner-btn{padding:6px 8px;letter-spacing:.06em;
  justify-content:flex-start;white-space:nowrap}
.l-tuner-head{font-size:9px;letter-spacing:.34em;opacity:.45;margin-top:4px}
.l-tuner input[type=range]{width:120px;accent-color:var(--lit)}

@media (prefers-reduced-motion: reduce){
  .landing *{animation:none !important}
}
`;
