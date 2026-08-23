'use client';

/**
 * The qi.land front page — two screens, one descent.
 *
 * Screen one is the shore painting: the album title, the countdown, the two
 * actions. Screen two is the tracklist, which is a poem, under water. Nothing
 * loads between them — the backdrop is one fixed layer and the descent is that
 * layer changing as you scroll, so the second screen is the same painting seen
 * from below rather than a different picture.
 *
 * The mailing list is still a panel over both, because it is a form and a form
 * is not a place. The poem used to be one too; it is the second screen now.
 *
 * This replaces the earlier shader treatment. That version painted the whole
 * ocean in WebGL and revealed it by scrolling; once the painting went full-bleed
 * and the scroll went away, the canvas sat permanently behind an opaque image
 * and cost ~100 kB to never be seen. It lives on at /descent in its R3F form.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { JellyMark, JELLY_MARK_CSS } from './JellyMark';

/**
 * The album *is* the poem — ten titles that read straight through. Punctuation
 * and lower-case openings are canon, not sloppiness: they're what makes the
 * tracklist run on as verse. Do not "fix" the capitalisation.
 *
 * Each line is stored as its **sense units**, not as one string, because on a
 * phone the long ones do not fit and the browser's own break is nonsense: it
 * fills the row and drops whatever is left, so 02 came out as “…who chose the
 * sea” / “—” with the dash alone on a line of its own, and 08 as “…the sea will
 * always” / “return to the sea.”, cut mid-clause. In prose that is merely ugly.
 * Here the turned line looks exactly like the next track — same left edge, same
 * leading — so a bad break does not just read badly, it invents a line of verse
 * that is not in the album.
 *
 * So the breaks are authored. The units are the caesuras Qi would read aloud;
 * .l-poem-ink lays them out as a wrapping flex row, which breaks BETWEEN units
 * first and only ever inside one when a single unit cannot fit at all. Two units
 * means one honest break, three means the line can give twice on a small phone
 * without ever landing somewhere the poem does not have a pause.
 *
 * The \u2060 before an em dash is a word joiner: UAX-14 allows a break either
 * side of —, which is how the dash got orphaned in the first place. It is
 * zero-width — the string still reads as written.
 */
const POEM_LINES: readonly (readonly string[])[] = [
  ['Sea rising'],
  ['in memory of those', 'who chose the sea\u2060—'],
  ['a dream so real...'],
  ['Wait\u2060—\u2060why is', 'the dream so real?'],
  ['Wake up!'],
  ['The heart of', 'the jellyfish.'],
  ['You shall see:'],
  ['what belongs to the sea', 'will always return', 'to the sea.'],
  ['The day after,', 'without us\u2060—'],
  ['sea risen.'],
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
 * What the hero's play button starts on. Not track 01 — this is the one to meet
 * the album with, and it is a separate decision from the running order.
 */
const FEATURED_DEMO = 3;

/**
 * The hero's primary action, in its three states.
 *
 * It said LISTEN NOW, which is what a released album says. This one is not
 * released — these are demos, and saying so is not a disclaimer, it is the
 * offer: you are hearing it before it exists. So the idle label names what it
 * actually is, and the other two are the transport it becomes.
 *
 * Once a track is loaded the button stops being "start the album" and becomes
 * the transport for whatever is sounding — a play button that restarts a
 * different track while music is already playing is a bug the size of the hero.
 */
const PLAY_LABELS = {
  idle: 'HEAR THE DEMOS',
  playing: 'PAUSE',
  paused: 'RESUME',
} as const;

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
 * THE FILM PASS
 *
 * The photograph Qi pointed at is a video still, and what reads as "film" in it
 * is three things stacked. Grain is only the loudest one:
 *
 * - Grain proper. Silver halide is a random field, so the noise is strongest in
 *   the midtones and gone at both ends — there is no emulsion left to be random
 *   in a blown sky or a blocked-up shadow. `soft-light` is that curve for free:
 *   a 50% grey source is a no-op, and the blend is pinned at backdrop 0 and 1,
 *   so the grain dies out exactly where silver's does. No mask needed.
 * - Halation. Bright areas bleed warm because light punched through the
 *   emulsion and scattered back off the film base. This is the half everyone
 *   forgets, and it is the half that makes a still look photographed rather
 *   than dusted.
 * - The toe and the shoulder. Film cannot clip. Blacks sit lifted and whites
 *   roll off, which is why the wetsuits in the reference are dark teal and
 *   never black. contrast() below 1 pivots on mid-grey and does both ends.
 *
 * An oil painting adds a fourth problem the reference does not have: the canvas
 * already has texture. Grain reads as emulsion only if it is FINER than the
 * brushwork — at the same scale it just muddies the strokes. So `grainPx` is in
 * DEVICE pixels, not CSS ones, which keeps it sub-pixel on a retina screen
 * instead of doubling the weave.
 */
const FILM = {
  /**
   * Grain layer opacity on screen one, and again once you are under.
   *
   * It has to come down with depth, and the reason is main's depth blur rather
   * than anything about film. Screen two blurs the painting to 3px, which takes
   * away every piece of detail the grain was sitting on top of — so at the same
   * .42 the grain stops being a layer over a picture and becomes the only
   * texture left in the frame. Same number, twice the apparent weight.
   *
   * Interpolated on --s rather than switched at data-two, because opacity is
   * free to animate continuously and a hard step would be visible against a
   * background that is itself still moving.
   */
  grain: 0.42,
  grainTwo: 0.2,
  /**
   * Whether the strip moves, per screen. A single frame of film has static
   * grain, so screen one is off: it is a photograph, and it should sit as still
   * as one. Screen two turns it on, which is the point — everything down there
   * is already moving, and the grain waking up is what stops the descent from
   * reading as screen one with the lights off.
   *
   * This one cannot interpolate. It is an animation, so it snaps at data-two,
   * the same threshold main's depth blur crosses.
   */
  weave: false,
  weaveTwo: true,
  /**
   * How many fresh draws of grain per second.
   *
   * 24 because that is what a projector does, and because 11 — the first guess —
   * sits in the worst part of the range: fast enough to see as flicker, slow
   * enough that every step reads as a discrete jump rather than a boil. Real
   * grain does not twitch, it seethes, and the difference is entirely rate.
   *
   * This is a rate, not a step count. The keyframes below are a fixed ring of
   * twelve offsets and the duration is derived (12 / weaveHz), which is the only
   * way to make this adjustable at all — CSS cannot vary how many keyframes an
   * animation has, only how long it takes to walk them.
   */
  weaveHz: 24,
  /** One grain, in DEVICE pixels. 1 vanishes on a 3x phone, 3 is sandpaper. */
  grainPx: 1.6,
  /**
   * Halation strength, and it is deliberately small.
   *
   * Halation reads as bloom only around something SMALL and bright against
   * something darker. This painting has no point source at all — no sun, no
   * specular, nothing but broad bright fields: the sand, the sky, the boy's
   * white clothes. Bleed a broad field and you do not get bloom, you get fog,
   * and at .34/.74 the whole picture went milky and lost the blue.
   *
   * So the threshold is set high enough that only the surf line and the lit
   * edge of the shirt clear it, and the amount is low enough to soften them
   * rather than light them. Push it and watch the sky go grey — that is the
   * failure mode, and it arrives quickly.
   */
  halo: 0.18,
  /** Spread of the bleed, in vmin so it holds its scale on any screen. */
  haloBlur: 1.4,
  /** Luminance above which a pixel blooms, 0-1. Only the foam and the shirt. */
  haloThreshold: 0.88,
  /** Contrast. Below 1 to lift the blacks and roll the whites off. */
  contrast: 0.96,
  /** Saturation. Colour stock is a shade quieter than a screen. */
  saturate: 0.97,
};

/**
 * The grain tile, in texels. Tiled across the viewport, so it has to be big
 * enough that the eye does not catch the period. White noise has no structure to
 * latch onto, but the rhythm of the repeat itself is visible below about 128.
 */
const GRAIN_TILE = 256;

/**
 * How hard the halation mask is cut. Paired with --halo-gain below: contrast()
 * pivots on mid-grey, so to put the *threshold* at black rather than at grey the
 * image is first scaled so the threshold lands at (0.5 - 0.5/C). Everything
 * darker than that clips to nothing and never blooms; everything about 25%
 * brighter blooms fully.
 */
const HALO_CUT = 9;

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
 * How hard "Heart" beats, once a second, in step with the countdown's seconds.
 *
 * Qi chose the mechanic out of six — the cut deepening and letting go, against a
 * double thump, a swinging light, a dark pressure wave, a pale one, and a band
 * travelling through the fill. The five that lost never shipped. What survived
 * from that round is this number, because "subtler" turned out to be the whole
 * note: it scales every length and every alpha in the keyframes at once, so the
 * beat retunes from /?tune=1 without changing its shape.
 *
 * 0.55 is a little over half the strength the beat first shipped at, and the gap
 * is deliberate rather than drift — Qi caught it against production and confirmed
 * the quieter number. At 119px the peak lands at -2.23px offset / 3.61px blur /
 * .34 alpha, where the first version reached -4.05 / 6.56 / .62. Same curve, half
 * the reach.
 */
const BEAT_AMP = 0.55;

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

/* Mirrors the check in app/api/subscribe/route.ts. Duplicated on purpose: the
   server must not trust the client, and the client should not need a round trip
   to say "that isn't an email". */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* idle -> sending -> done, or -> error. The old code had only a `sent` boolean, so
   a failed signup still showed the thank-you line and the address was lost with
   the visitor believing they were on the list. */
type SubState = 'idle' | 'sending' | 'done' | 'error';

/** m:ss, for the scrub readout. Nothing on this page runs to an hour. */
function clock(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

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
/**
 * "NEW ALBUM OUT DEC 20", built from the release date rather than typed.
 *
 * Deliberately not Intl / toLocaleDateString: the page is statically
 * prerendered, so this string is produced once on the server and again in the
 * browser, and the two have to be identical to the byte or React throws
 * hydration away. Node and a browser do not always carry the same ICU data.
 * Three lines of lookup can't disagree with themselves.
 */
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
function outLine(releaseDate: string) {
  const [, m, d] = releaseDate.split('-').map(Number);
  return 'NEW ALBUM OUT ' + (MONTHS[m - 1] ?? '') + ' ' + d;
}

/** The down-mark's single glyph, drawn twice. Round caps and joins because at
 *  3px on a painting a mitred corner reads as a defect. */
function Chevron() {
  return (
    <svg className="l-down-chev" width="46" height="20" viewBox="0 0 30 13" aria-hidden>
      <path
        d="M1.6 1.6L15 11.4 28.4 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Countdown({ secs, releaseDate }: { secs: number | null; releaseDate: string }) {
  if (secs !== null && secs <= 0) {
    return (
      <div className="l-cd">
        <div className="l-cd-lead">NEW ALBUM</div>
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
      {/* States the thing, rather than making the reader do the arithmetic to
          find out what is being counted down to. The row underneath is then
          free to be what it is — how long that is from right now. */}
      <div className="l-cd-lead">{outLine(releaseDate)}</div>
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

/**
 * One tile of grain, as a data URL, made on the client.
 *
 * Generated rather than shipped because true white noise does not compress: a
 * tile this size is ~90 KB of PNG that would sit in the bundle earning nothing,
 * while the loop below costs about a millisecond. It also means the grain is a
 * different draw on every visit, which is what a fresh strip of stock would do.
 *
 * The values are gaussian-ish — two uniforms summed, the cheapest central limit
 * theorem there is — rather than flat random. Flat noise puts too many texels at
 * the extremes and reads as digital sensor noise; grain clusters near the middle
 * and only occasionally spikes.
 *
 * Null until the effect runs, so the server pass and the first client pass agree
 * and there is nothing to mismatch on hydration.
 */
function useGrainTile(size: number) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const g = 128 + (Math.random() + Math.random() - 1) * 118;
      const v = g < 0 ? 0 : g > 255 ? 255 : g;
      const o = i * 4;
      d[o] = d[o + 1] = d[o + 2] = v;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setUrl(c.toDataURL('image/png'));
  }, [size]);
  return url;
}

/**
 * Device pixel ratio, read on the client. The grain is the one thing on this
 * page specified in physical pixels rather than CSS ones, so it needs the real
 * number — and it needs to re-read it, because dragging a window between a
 * retina display and an external monitor changes it under you.
 */
function useDpr() {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const read = () => setDpr(window.devicePixelRatio || 1);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return dpr;
}

export function Landing({ releaseDate = '2026-12-20' }: { releaseDate?: string }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pct, setPct] = useState(0);
  const [missing, setMissing] = useState(false);
  const [subState, setSubState] = useState<SubState>('idle');
  const [subErr, setSubErr] = useState<'email' | 'server'>('server');
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
  const [amp, setAmp] = useState(BEAT_AMP);
  const [film, setFilm] = useState(FILM);
  const [weave, setWeave] = useState(FILM.weave);
  const [weaveTwo, setWeaveTwo] = useState(FILM.weaveTwo);
  /** Grain over the type too, so the screen is one photographed object. */
  const [grainOverAll, setGrainOverAll] = useState(false);
  const grainUrl = useGrainTile(GRAIN_TILE);
  const dpr = useDpr();
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
  /**
   * True once the descent is more than 40% of the way down. Two jobs: it reveals
   * screen two's type, and it hands the nav its wordmark. Deliberately a boolean
   * and not the scroll position — the position itself is a CSS variable written
   * straight to the DOM (see the scroll effect), because re-rendering this
   * component, SVG filters and all, sixty times a second to move a gradient
   * would be an absurd price for a backdrop.
   */
  const [atTwo, setAtTwo] = useState(false);
  /**
   * True when the two screens do not add up to exactly two screens — i.e. the
   * tracklist is taller than the window it is in. Measured rather than guessed
   * at a breakpoint, because what makes it overflow is how many of the ten
   * lines had to turn, which depends on the width, the height, the font that
   * finished loading and whether the player is up. No media query knows all
   * four. See the snap rule in the CSS for what it is for.
   */
  const [tall, setTall] = useState(false);
  /** Named because the layout depends on it, not only the markup. */
  const barOn = cur > 0;

  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
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
   * The descent, as one number.
   *
   * --s is scrollTop over one screen height, clamped to 0..1: 0 on the shore, 1
   * in the water. Everything about the transition reads it — the veil's opacity,
   * the parallax on the painting, the light from the surface, the marine snow,
   * the arrow fading out, the wordmark fading in — so there is exactly one
   * source of truth for "how deep are we" and no two layers can disagree.
   *
   * Written as a custom property rather than held in state on purpose; see
   * atTwo.
   *
   * Read synchronously in the handler, NOT deferred to requestAnimationFrame.
   * rAF is suspended in a background tab, and a scroll that lands while it is
   * suspended — a restored position, a programmatic jump, a snap finishing after
   * the tab was switched — would then leave --s frozen at whatever it was, with
   * the backdrop showing one screen while the type shows the other. The work
   * here is two property reads and one style set; there is nothing to coalesce.
   */
  useEffect(() => {
    const sc = scrollRef.current;
    const root = rootRef.current;
    if (!sc || !root) return;
    const read = () => {
      const h = sc.clientHeight || 1;
      const s = Math.min(1, Math.max(0, sc.scrollTop / h));
      root.style.setProperty('--s', s.toFixed(4));
      setAtTwo(s > 0.3);
      // Two screens should measure two screens. Anything over is the tracklist
      // spilling, and the snap has to give way — see .landing[data-tall].
      setTall(sc.scrollHeight > h * 2 + 2);
    };
    read();
    sc.addEventListener('scroll', read, { passive: true });
    window.addEventListener('resize', read);
    // A late webfont reflows the poem without resizing anything, and the hand
    // it is set in is the last thing to arrive.
    document.fonts?.ready.then(read).catch(() => {});
    return () => {
      sc.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
    // Re-measures when the player arrives or leaves: the bar changes screen
    // two's padding, which is exactly the kind of thing that tips it over.
  }, [barOn]);

  /**
   * The only way either screen is reached by a control. Smooth, unless the
   * visitor has asked for less motion — in which case a page that animates its
   * way down is exactly what they said no to.
   */
  const goTo = useCallback((screen: 0 | 1) => {
    const sc = scrollRef.current;
    if (!sc) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    sc.scrollTo({ top: screen * sc.clientHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, []);

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

  /**
   * The one place playback position is set by hand. Two surfaces seek now — the
   * bar's waveform and the sounding poem line — and they must land on the same
   * number from the same fraction, so the geometry stays with each surface and
   * only the fraction comes here.
   */
  const seekToFraction = useCallback((f: number) => {
    const au = audioRef.current;
    if (!au || !au.duration || !isFinite(au.duration)) return;
    const c = Math.min(1, Math.max(0, f));
    au.currentTime = c * au.duration;
    pctRef.current = c * 100;
    setPct(c * 100);
  }, []);

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = seekRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      seekToFraction((clientX - r.left) / r.width);
    },
    [seekToFraction],
  );

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

  /* --- scrubbing the poem line ------------------------------------ */
  /*
   * The sounding line already reads as a progress bar — it fills left to right
   * in step with the track — so it is treated as one: press anywhere along the
   * words to land there, drag to sweep. Where you press is where the edge of the
   * ink ends up, because the pointer and the fill are read off the same box.
   *
   * That box is the WORDS, not the row (.l-poem-ink, an inline-block that hugs
   * its text), and moving it there is what makes the feature honest. The row is
   * a uniform 412px because the longest line sets the column width, so a fill
   * measured on the row finishes "Wake up!" — 69px of ink — at 17% of the track
   * and then sits dead for three minutes. Measured on the ink, every line ends
   * its fill on its last glyph exactly when the track ends, whatever its length.
   * The cost is that a short line is a short scrub bar: seconds per pixel, not
   * tenths. That is the right trade here — the bar downstairs is the precise
   * instrument, this one is the one you can read.
   *
   * The number in the margin keeps the transport. Press-to-seek has to take the
   * click, and the panel covers the bar's play button while it is open, so pause
   * would otherwise have nowhere to live. It is the right size for a transport
   * anyway: metadata in the gutter, not a control laid over the verse.
   */
  const poemInkRef = useRef<HTMLSpanElement | null>(null);
  const poemTimeRef = useRef<HTMLSpanElement | null>(null);
  const scrubbingRef = useRef(false);

  /**
   * A callback ref, so that the line losing the track also loses the hairline it
   * was left holding. The attributes are set by hand and React does not know
   * they exist — without this, coming back to a track later shows a stale
   * hairline at wherever the pointer last was, until the next move wipes it.
   */
  const attachInk = useCallback((el: HTMLSpanElement | null) => {
    const prev = poemInkRef.current;
    if (prev && prev !== el) {
      prev.removeAttribute('data-scrub');
      prev.removeAttribute('data-scrubbing');
    }
    poemInkRef.current = el;
  }, []);

  /** Paint the hairline and its clock imperatively — a pointermove is not worth
   *  a render of the whole landing, and React owns neither of these values. */
  const paintScrub = useCallback((f: number) => {
    const ink = poemInkRef.current;
    if (!ink) return;
    ink.style.setProperty('--h', (f * 100).toFixed(2) + '%');
    ink.dataset.scrub = '';
    const t = poemTimeRef.current;
    const au = audioRef.current;
    if (t) t.textContent = au?.duration ? clock(f * au.duration) : '';
  }, []);

  /**
   * Null when the pointer is off the words — past the end of a short line, or
   * out in the margin. Nothing happens there rather than the press clamping to
   * 0 or 1, which is the difference between an empty press and losing your place.
   */
  const inkFraction = (clientX: number) => {
    const ink = poemInkRef.current;
    if (!ink) return null;
    const r = ink.getBoundingClientRect();
    if (!r.width || clientX < r.left - 4 || clientX > r.right + 4) return null;
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  const onLineDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // The number hangs outside the line's box, in the left margin. Caught here
      // and handed the transport: it is the only control left in the panel once
      // the line itself means position.
      if ((e.target as HTMLElement).closest('.l-poem-num')) {
        playTrackRef.current(curRef.current);
        return;
      }
      const f = inkFraction(e.clientX);
      if (f === null) return;
      scrubbingRef.current = true;
      poemInkRef.current?.setAttribute('data-scrubbing', '');
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      paintScrub(f);
      seekToFraction(f);
    },
    [paintScrub, seekToFraction],
  );

  const onLineMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const f = inkFraction(e.clientX);
      if (f === null) {
        if (!scrubbingRef.current) poemInkRef.current?.removeAttribute('data-scrub');
        return;
      }
      paintScrub(f);
      if (scrubbingRef.current) seekToFraction(f);
    },
    [paintScrub, seekToFraction],
  );

  const onLineUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    scrubbingRef.current = false;
    poemInkRef.current?.removeAttribute('data-scrubbing');
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const onLineLeave = useCallback(() => {
    if (scrubbingRef.current) return; // capture keeps the drag alive off the line
    poemInkRef.current?.removeAttribute('data-scrub');
  }, []);

  /**
   * The line is focusable, and it now means position rather than "play me", so
   * it takes the keys a slider takes. Space holds the music where the number
   * would, since a keyboard cannot press a span in the margin.
   */
  const onLineKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const au = audioRef.current;
      if (!au) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        playTrackRef.current(curRef.current);
        return;
      }
      if (!au.duration || !isFinite(au.duration)) return;
      const step = e.shiftKey ? 30 : 5;
      if (e.key === 'ArrowRight') seekToFraction((au.currentTime + step) / au.duration);
      else if (e.key === 'ArrowLeft') seekToFraction((au.currentTime - step) / au.duration);
      else if (e.key === 'Home') seekToFraction(0);
      else return;
      e.preventDefault();
    },
    [seekToFraction],
  );

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


  /**
   * Playing from the poem leaves the poem open — someone may still be reading,
   * and the line they just started now lights and fills in front of them, which
   * is better feedback than being thrown back to the bar. The line that is
   * already sounding does not come through here at all — it has become the
   * track's own scrub bar; see the scrubbing block above.
   *
   * Audio outlives the view it was started from either way: navigating never
   * silences a track as a side effect.
   */
  const playFromPoem = (n: number) => playTrack(n);

  /* The hero's primary action. See PLAY_LABELS: it is "start the album" until
     something is loaded and the transport for that thing afterwards. */
  const heroTrack = barOn ? cur : FEATURED_DEMO;
  const heroLabel = !barOn
    ? PLAY_LABELS.idle
    : playing
      ? PLAY_LABELS.playing
      : PLAY_LABELS.paused;
  const heroAria = !barOn
    ? 'Hear the demos — ' + TITLES[FEATURED_DEMO - 1]
    : (playing ? 'Pause — ' : 'Resume — ') + TITLES[cur - 1];

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
      ref={rootRef}
      /* Both are read by CSS alone. `data-two` gives the wordmark its pointer
         events back once it is actually visible; `data-bar` lifts the arrow and
         screen two's footer clear of the player when there is one. */
      data-two={atTwo ? '' : undefined}
      data-bar={barOn ? '' : undefined}
      data-tall={tall ? '' : undefined}
      style={
        {
          ['--lit' as string]: litVals.lit,
          ['--lit-bright' as string]: litVals.bright,
          ['--lit-dim' as string]: litVals.dim,
          ['--type-scale' as string]: typeScale,
          ['--inset' as string]: depth,
          ['--sharp' as string]: sharp,
          ['--white' as string]: white,
          ['--amp' as string]: amp,
          ['--grain' as string]: film.grain,
          ['--grain-two' as string]: film.grainTwo,
          ['--weave-dur' as string]: (12 / Math.max(1, film.weaveHz)).toFixed(3) + 's',
          ['--grain-size' as string]: (GRAIN_TILE * film.grainPx) / dpr + 'px',
          ['--halo' as string]: film.halo,
          ['--halo-blur' as string]: film.haloBlur + 'vmin',
          ['--halo-gain' as string]: (0.5 - 0.5 / HALO_CUT) / Math.max(0.04, film.haloThreshold),
          ['--halo-cut' as string]: HALO_CUT,
          ['--film-con' as string]: film.contrast,
          ['--film-sat' as string]: film.saturate,
        } as React.CSSProperties
      }
    >
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS + JELLY_MARK_CSS }} />

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
        The backdrop, fixed to the window rather than to a screen. Both screens
        share it: screen one is the painting, screen two is the same painting
        under deep water, and the descent between them is this layer changing
        rather than a second image loading.

        One layer, cover at every aspect ratio — only the crop moves. There used
        to be a blurred copy underneath holding the letterbox on narrow screens;
        at the blur radius that kept it from competing, the oil texture was gone
        and it read as flat colour, which is the one thing the background must
        never be. Positioning is in CSS, not inline — the media query has to be
        able to override it, and inline styles outrank stylesheet rules.
      */}
      <div className="l-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="l-bg"
          src={HERO_IMAGE}
          alt="A figure on the shore, looking down at a jellyfish in the shallows"
        />

        {/*
          Halation. A second copy of the painting, crushed until only its
          brightest end survives, tinted red-orange, blurred, and screened back
          on.

          The crush is the whole trick and it is done with two filters that were
          not designed for it: brightness() first scales the image so the chosen
          threshold lands where contrast() clips, then contrast() throws away
          everything below it. What comes out is a mask of just the surf line and
          the lit edge of the shirt. Blur last, so the spread happens to the mask
          and not to the painting.

          Inside .l-stage and directly behind the water, so the descent puts the
          bloom out the same way it puts the painting out: this is light coming
          off the art, and it has no business surviving into the deep.

          It carries the same crop as .l-bg or the glow drifts off the thing that
          is glowing — hence --bg-pos, which both read and the media queries set
          in one place.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="l-halo" src={HERO_IMAGE} alt="" aria-hidden="true" />

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
        {/*
          The water. All of it is driven by --s and is simply not there at 0,
          so screen one is untouched by any of it and nothing below costs a
          frame until someone starts down.

          Four layers, because being under water reads as four things: the light
          going (l-deep), the surface receding above you (l-surface), the shafts
          it still throws down (l-rays), and the body of the water itself moving
          through them (l-drift). All of them are light and volume — large,
          slow, soft. Nothing here is a discrete object, and the note on l-rays
          in the CSS is why that is not a stylistic preference.
        */}
        <div className="l-deep" aria-hidden />
        <div className="l-surface" aria-hidden />
        <div className="l-rays" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="l-drift" aria-hidden>
          <i />
          <i />
        </div>
      </div>

      {/*
        The emulsion. Above the vignette on purpose: the vignette is the lens and
        the grain is the film, so this is the physical order — and it has the
        happy side effect of dithering the vignette's ramp, which is the widest
        gradient on the page and the only place banding has room to show.

        Rendered only once the tile exists, which is after mount. There is no
        server-side version of a random field, and a placeholder would flash.
      */}
      {grainUrl && (
        <div
          className={'l-grain' + (grainOverAll ? ' l-grain-top' : '')}
          data-weave-one={weave ? '' : undefined}
          data-weave-two={weaveTwo ? '' : undefined}
          style={{ backgroundImage: `url(${grainUrl})` }}
        />
      )}

      <nav className="l-nav">
        <div className="l-nav-left">
          {/*
            The artist, not the album — screen two heads with the album title in
            its own hand, and the same words twice on one screen is the thing
            this corner is here to avoid. It fades up as screen one leaves, and
            it is the way back to the surface: there is no other one, and a page
            that can only be left by scrolling up is a page with no door.
          */}
          {/* Not in the tab order while it is invisible: opacity 0 plus
              pointer-events none still leaves a button a keyboard can land on,
              and a focus ring on nothing is worse than no control at all. */}
          <button
            type="button"
            className="l-mark"
            tabIndex={atTwo ? 0 : -1}
            aria-hidden={atTwo ? undefined : true}
            onClick={() => goTo(0)}
          >
            QI · 琦
          </button>
          {META_PLACEMENT === 'topLeft' && (
            <div className="l-meta">
              <Countdown secs={secs} releaseDate={releaseDate} />
            </div>
          )}
        </div>
        {/*
          The one thing being asked for, so it is the one thing built like a
          button. It reads as a link the moment it is set like the rest of the
          nav — and it was, in the same 11.5px Jost as everything else, in the
          corner. Same rule and same weight as SIGN UP in the panel it opens, on
          purpose: the two are one action seen twice.
        */}
        <button type="button" className="l-nav-cta" onClick={() => setPanel('subscribe')}>
          PRE-SAVE
        </button>
      </nav>

      {/*
        The scroller. Fixed to the window and holding both screens, rather than
        letting the document itself scroll: the backdrop, the nav and the player
        all have to stay put while the type moves past them, and a fixed shell
        with one scrolling child is the version of that with no position:fixed
        children inside a transformed ancestor waiting to go wrong on iOS.
      */}
      <div className="l-scroll" ref={scrollRef}>
        <section className="l-screen l-one">
          <div className="l-hero">
            {META_PLACEMENT === 'eyebrow' && (
              <div className="l-meta l-meta-eyebrow">
                <Countdown secs={secs} releaseDate={releaseDate} />
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
                <Countdown secs={secs} releaseDate={releaseDate} />
              </div>
            )}

            <div className="l-play-row">
              {/* The circle and its label are one action, so they share a hover — but
                  only with each other. */}
              <span className="l-act-primary">
                <button
                  type="button"
                  className="l-play"
                  /* Pause is two symmetric bars and wants no optical offset; the
                     triangle's mass sits on its flat edge and does. */
                  data-glyph={barOn && playing ? 'pause' : 'play'}
                  aria-label={heroAria}
                  onClick={() => playTrack(heroTrack)}
                >
                  {barOn && playing ? (
                    <svg width="12" height="15" viewBox="0 0 12 15" fill="currentColor" aria-hidden>
                      <path d="M0 0h3.8v15H0zM8.2 0H12v15H8.2z" />
                    </svg>
                  ) : (
                    <svg width="13" height="15" viewBox="0 0 13 15" fill="currentColor" aria-hidden>
                      <path d="M0 0l13 7.5L0 15z" />
                    </svg>
                  )}
                </button>
                <button type="button" className="l-play-label" onClick={() => playTrack(heroTrack)}>
                  {/*
                    Per letter, so the motion is a transform and never a reflow.
                    Opening the letter-spacing would have been the obvious move and
                    is the wrong one — it widens the button, which shoves the rule
                    and TRACKLIST sideways every time the cursor arrives.

                    Keyed by label as well as index, so the letters re-enter when
                    the word changes rather than morphing in place.
                  */}
                  {Array.from(heroLabel).map((ch, i) => (
                    <span
                      key={heroLabel + i}
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
              {/* Was setPanel('poem') and stayed that way through the rebuild —
                  the panel it opened no longer exists, so it opened nothing.
                  It is the same destination it always was, one screen down. */}
              <button type="button" className="l-act-second" onClick={() => goTo(1)}>
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
                <Countdown secs={secs} releaseDate={releaseDate} />
              </div>
            )}
          </div>

          {/*
            What the ten titles used to be. The bar named every track at the
            bottom of the first screen, which meant the album was already
            over before anyone had scrolled — the arrow says there is more
            without saying what, and the poem gets to arrive whole.

            The rail is not decoration: a light runs down it, once every few
            seconds, in the direction it is asking you to go.
          */}
          <button
            type="button"
            className="l-down"
            aria-label="Down to the tracklist"
            onClick={() => goTo(1)}
          >
            {/* Two marks and nothing else — no rail, no ring, no container. See
                the CSS for why the pair is drawn identical and separated only
                by when it is bright. */}
            <span className="l-down-a" aria-hidden>
              <Chevron />
            </span>
            <span className="l-down-b" aria-hidden>
              <Chevron />
            </span>
          </button>
        </section>

        {/*
          Screen two. The panel this replaces was a scrim over the painting with
          a close button; a screen is not, and the difference is the whole point
          — the poem is not something you open and dismiss, it is where the page
          was going all along. Everything inside is the panel's markup unchanged
          (the fill, the scrub, the transport in the margin), because none of it
          was ever about being in a dialog.
        */}
        <section
          className={'l-screen l-two' + (atTwo ? ' is-in' : '')}
          aria-label="The tracklist, as a poem"
        >
          <div className="l-poem">
            {/*
              The album, in the poem's own hand. Qi's call, twice now.

              The risk it accepts is real and has to be managed by ranking
              rather than by type: "The heart of the jellyfish." is also line
              06, so the title and that line are nearly the same string in the
              same face. What keeps them apart is that the title runs ~1.6x the
              line size, has ~90px of air under it, and is the only thing on the
              screen that is not a button. If it ever starts reading as the
              poem's first line, that ratio is the knob — not the font.
            */}
            <div className="l-poem-head">The Heart of the Jellyfish</div>
            <div
              className={'l-poem-body l-poem-f-' + font}
              style={{ ['--poem-scale' as string]: fontScale } as React.CSSProperties}
            >
              {STANZAS.map((stanza, si) => (
                <div className="l-poem-stanza" key={si}>
                    {stanza.map((n) => {
                      const has = AVAILABLE_DEMOS.includes(n);
                      const on = cur === n;
                      return (
                        /* The row exists only to be animated. The reveal is an
                           opacity, and so are three of the line's own states —
                           dimmed for no demo yet, full for sounding — so an
                           animation with a fill mode on the button itself would
                           win the cascade forever and freeze all three. One
                           wrapper keeps the entrance and the semantics apart. */
                        <div
                          className="l-poem-row"
                          key={n}
                          style={{ ['--i' as string]: n } as React.CSSProperties}
                        >
                          <button
                            type="button"
                            className={
                              'l-poem-line' +
                              (has ? '' : ' l-poem-soon') +
                              (on ? ' l-poem-playing' : '')
                            }
                            /* Sounding: the line is the track's length, so it is
                               pressed rather than clicked, and there is nothing
                               left for a click to mean. Silent: unchanged. */
                            onClick={on ? undefined : () => playFromPoem(n)}
                            onPointerDown={on ? onLineDown : undefined}
                            onPointerMove={on ? onLineMove : undefined}
                            onPointerUp={on ? onLineUp : undefined}
                            /* Both of these, or a drag that ends somewhere the
                               page never hears about leaves the line stuck mid-
                               scrub, with the fill frozen under a hairline. */
                            onPointerCancel={on ? onLineUp : undefined}
                            onLostPointerCapture={on ? onLineUp : undefined}
                            onPointerLeave={on ? onLineLeave : undefined}
                            onKeyDown={on ? onLineKey : undefined}
                            role={on ? 'slider' : undefined}
                            aria-valuemin={on ? 0 : undefined}
                            aria-valuemax={on ? 100 : undefined}
                            aria-valuenow={on ? Math.round(pct) : undefined}
                            data-paused={on && !playing ? '' : undefined}
                            style={
                              on
                                ? ({ ['--p' as string]: pct.toFixed(1) + '%' } as React.CSSProperties)
                                : undefined
                            }
                            aria-label={
                              (on
                                ? 'Seek — '
                                : has
                                  ? 'Play demo — '
                                  : 'No demo yet — ') + TITLES[n - 1]
                            }
                          >
                            <span
                              className="l-poem-num"
                              aria-hidden
                              title={on ? (playing ? 'Pause' : 'Play') : undefined}
                            >
                              {String(n).padStart(2, '0')}
                            </span>
                            {/* The words are their own box — see .l-poem-ink. The
                                button stays full width so a silent line is easy
                                to hit; the ink is what fills and what seeks.
                                Its children are the line's sense units, so a line
                                too long for the phone turns where the poem does —
                                see POEM_LINES. */}
                            <span className="l-poem-ink" ref={on ? attachInk : undefined}>
                              {POEM_LINES[n - 1].map((unit, ui) => (
                                <span className="l-poem-unit" key={ui}>
                                  {unit}
                                </span>
                              ))}
                              {on && <span className="l-poem-time" ref={poemTimeRef} aria-hidden />}
                            </span>
                          </button>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
          {/*
            The Chinese title, hanging in the right margin. It was built out
            into a full spine — a ruled band with a 白文 seal in its foot — and
            Qi took it back to the line. Worth knowing why the line wins: at
            this weight it is the album's second name and nothing else, while
            the band was a piece of furniture the screen had to make room for,
            and the seal was a second focal point on a screen whose whole job is
            to hold one poem. Ceremony, not architecture.

            Gone below 900px, where there is no margin to hang anything in.
          */}
          <div className="l-two-cn" aria-hidden>
            <span className="l-two-cn-rule" />
            <span className="l-two-cn-text">水母之心</span>
            <span className="l-two-cn-rule" />
          </div>
        </section>
      </div>

      {/*
        The player. One, fixed to the window, so it plays across both screens —
        starting a demo from the poem and scrolling back up to the shore does not
        interrupt it, and does not leave the transport behind on the other screen.

        It is only here when something is playing. There is no idle state to
        design: the bar used to carry the tracklist when nothing was sounding,
        and the tracklist is a screen now.
      */}
      {barOn && (
        <div className="l-bar">
          {/*
            Drawn, not typed. U+25B6 has emoji presentation by default, so iOS
            rendered the transport as a colour emoji — a grey-blue triangle
            that ignored `color` and sat next to the pure-white hero button
            looking broken. An inline SVG is the same shape the hero uses and
            takes currentColor everywhere.
          */}
          <button
            type="button"
            className="l-bar-toggle"
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => playTrack(cur)}
          >
            {playing ? (
              <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor" aria-hidden>
                <path d="M0 0h3.2v12H0zM6.8 0H10v12H6.8z" />
              </svg>
            ) : (
              <svg
                className="l-bar-tri"
                width="10"
                height="12"
                viewBox="0 0 10 12"
                fill="currentColor"
                aria-hidden
              >
                <path d="M0 0l10 6L0 12z" />
              </svg>
            )}
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
        </div>
      )}


      {/* ---- tuner, /?tune=1 ---- */}
      {tuner && (
        <div className="l-tuner">
          <div className="l-tuner-head">FILM</div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.01}
              value={film.grain}
              aria-label="Grain amount"
              onChange={(e) => setFilm((f) => ({ ...f, grain: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">grain {film.grain.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.8}
              max={3.5}
              step={0.1}
              value={film.grainPx}
              aria-label="Grain size in device pixels"
              onChange={(e) => setFilm((f) => ({ ...f, grainPx: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">size {film.grainPx.toFixed(1)}px</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={film.halo}
              aria-label="Halation amount"
              onChange={(e) => setFilm((f) => ({ ...f, halo: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">halo {film.halo.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.3}
              max={7}
              step={0.1}
              value={film.haloBlur}
              aria-label="Halation spread"
              onChange={(e) => setFilm((f) => ({ ...f, haloBlur: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">spread {film.haloBlur.toFixed(1)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.35}
              max={0.98}
              step={0.01}
              value={film.haloThreshold}
              aria-label="Halation threshold"
              onChange={(e) => setFilm((f) => ({ ...f, haloThreshold: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">above {film.haloThreshold.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.75}
              max={1.15}
              step={0.01}
              value={film.contrast}
              aria-label="Contrast"
              onChange={(e) => setFilm((f) => ({ ...f, contrast: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">contrast {film.contrast.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0.6}
              max={1.25}
              step={0.01}
              value={film.saturate}
              aria-label="Saturation"
              onChange={(e) => setFilm((f) => ({ ...f, saturate: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">sat {film.saturate.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <button
              type="button"
              className={'l-tuner-btn' + (weave ? ' l-tuner-on' : '')}
              onClick={() => setWeave((v) => !v)}
            >
              WEAVE
            </button>
            <button
              type="button"
              className={'l-tuner-btn' + (grainOverAll ? ' l-tuner-on' : '')}
              onClick={() => setGrainOverAll((v) => !v)}
            >
              OVER TYPE
            </button>
            <button
              type="button"
              className="l-tuner-btn"
              onClick={() =>
                setFilm((f) => ({ ...f, grain: 0, grainTwo: 0, halo: 0, contrast: 1, saturate: 1 }))
              }
            >
              BYPASS
            </button>
          </div>

          <div className="l-tuner-head">UNDER WATER</div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.01}
              value={film.grainTwo}
              aria-label="Grain amount on screen two"
              onChange={(e) => setFilm((f) => ({ ...f, grainTwo: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">grain {film.grainTwo.toFixed(2)}</span>
          </div>
          <div className="l-tuner-row">
            <button
              type="button"
              className={'l-tuner-btn' + (weaveTwo ? ' l-tuner-on' : '')}
              onClick={() => setWeaveTwo((v) => !v)}
            >
              WEAVE
            </button>
          </div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={6}
              max={30}
              step={1}
              value={film.weaveHz}
              aria-label="Weave rate in hertz"
              onChange={(e) => setFilm((f) => ({ ...f, weaveHz: Number(e.target.value) }))}
            />
            <span className="l-tuner-val">rate {film.weaveHz}fps</span>
          </div>

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

          <div className="l-tuner-head">HEART BEAT</div>
          <div className="l-tuner-row">
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={amp}
              aria-label="Beat amplitude"
              onChange={(e) => setAmp(Number(e.target.value))}
            />
            <span className="l-tuner-val">amp {amp.toFixed(2)}</span>
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

      {/* ---- the subscribe panel ---- */}
      {/*
        The one thing still worth covering the page for. A form is not a place:
        it has no content to be read, it is answered and dismissed, and it must
        not cost the visitor their position on the way back out.
      */}
      {panel === 'subscribe' && (
        <div className="l-panel" role="dialog" aria-modal="true" aria-label="Get notified">
          <button
            type="button"
            className="l-panel-close"
            aria-label="Close"
            onClick={() => setPanel(null)}
          >
            ✕
          </button>

          <div className="l-sub">
            <h2 className="l-sub-title">
              follow thy heart{' '}
              <JellyMark className="l-sub-wink" />
            </h2>
            {subState === 'done' ? (
              <div className="l-sub-thanks">You\u2019re on the list.</div>
            ) : (
              <form
                className="l-sub-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = emailRef.current?.value.trim() ?? '';
                  if (!EMAIL_RE.test(email)) {
                    setSubErr('email');
                    setSubState('error');
                    emailRef.current?.focus();
                    return;
                  }
                  setSubState('sending');
                  try {
                    const res = await fetch('/api/subscribe', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ email, source: 'qi.land' }),
                    });
                    if (!res.ok) {
                      // 400 is the address itself; anything else (503 no key, 502
                      // upstream, 500) is ours to own -- don't blame the visitor.
                      setSubErr(res.status === 400 ? 'email' : 'server');
                      setSubState('error');
                      return;
                    }
                    setSubState('done');
                  } catch {
                    setSubErr('server'); // never reached /api/subscribe at all
                    setSubState('error');
                  }
                }}
              >
                {/* The ask, the field and the verb are one sentence on one line --
                    the copy is the label, so there is nothing to read twice. It
                    wraps at the two gaps, never inside a clause. */}
                <span className="l-sub-say">receive a heartbeat at</span>
                <input
                  ref={emailRef}
                  type="email"
                  placeholder="email address"
                  aria-label="Email address"
                  className="l-sub-input"
                  disabled={subState === 'sending'}
                  onChange={() => {
                    if (subState === 'error') setSubState('idle');
                  }}
                />
                <span className="l-sub-say">when the album is out,</span>
                {/* The full stop is the sentence's, not the button's -- it sits
                    outside the rule so the underlined word stays the word, and it
                    goes away while the ellipsis is spinning. */}
                <button type="submit" className="l-sub-go" disabled={subState === 'sending'}>
                  {subState === 'sending' ? (
                    <span className="l-sub-go-ink">{'\u2026'}</span>
                  ) : (
                    <>
                      <span className="l-sub-go-ink">yes</span>.
                    </>
                  )}
                </button>
              </form>
            )}
            {subState === 'error' && (
              <p className="l-sub-err" role="alert">
                {subErr === 'email'
                  ? 'That address doesn\u2019t look right \u2014 mind checking it?'
                  : 'The tide didn\u2019t carry it \u2014 try again in a moment.'}
              </p>
            )}
          </div>
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
  /* The transport, as vectors. Every play/pause mark on the page reads from
     these, so the bar and the poem margin can never drift apart — and so no
     platform gets to substitute an emoji for one of them. */
  --glyph-play:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 12'%3E%3Cpath d='M0 0l10 6L0 12z'/%3E%3C/svg%3E");
  --glyph-pause:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 12'%3E%3Cpath d='M0 0h2.8v12H0zM7.2 0H10v12H7.2z'/%3E%3C/svg%3E");
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
.l-bg,.l-halo{position:absolute;inset:0;width:100%;height:100%;
  object-fit:cover;object-position:var(--bg-pos,center 45%)}

/* The tone curve, such as it is. contrast() pivots on mid-grey, so a value under
   1 lifts the blacks and rolls the whites off in one move — which is the whole
   of what a film toe and shoulder do to a picture this evenly lit. The painting
   is the only thing graded; the halo is a highlight bloom and does not want it,
   and the type is not part of the photograph. */
.l-bg{filter:contrast(var(--film-con,1)) saturate(var(--film-sat,1))}
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

/* ---- the film pass ---- */

/* Halation. Between the painting and the scrim, with no z-index of its own —
   DOM order alone puts it over .l-bg and under .l-vignette, which is the order
   the light actually happens in.

   The filter chain reads left to right and every step is load-bearing:
   brightness scales the picture so the threshold lands where contrast clips,
   contrast(9) discards everything under it, sepia+saturate+hue-rotate paint what
   survives the red-orange of light scattering back off a film base, and blur
   last spreads the mask rather than the painting. screen adds it back without
   ever darkening anything. */
.l-halo{pointer-events:none;opacity:calc(var(--halo,0) * (1 - var(--s)));mix-blend-mode:screen;
  filter:brightness(var(--halo-gain,.6)) contrast(var(--halo-cut,9))
         sepia(1) saturate(3.4) hue-rotate(-14deg)
         blur(var(--halo-blur,2.2vmin))}

/* Grain. Three things here are load-bearing:

   soft-light, because it is film's response curve for free. A 50% grey texel is
   a no-op and the blend is pinned at both ends, so the noise is loudest in the
   midtones and fades to nothing in the deep water and in the sun — no mask, no
   luminance maths, just the right blend mode.

   image-rendering:pixelated, because the default bilinear resample averages
   neighbouring texels into a soft haze. Grain has to have edges. A blurred
   random field is fog, and there is already a vignette for that.

   --grain-size in device pixels, because on the one screen that matters this
   painting is competing with its own brushwork, and grain only reads as
   emulsion when it is finer than the strokes it sits on.

   Inset past the viewport so the weave below never drags an edge into frame. */
.l-grain{position:absolute;inset:-8%;z-index:2;pointer-events:none;
  background-repeat:repeat;background-size:var(--grain-size,256px);
  image-rendering:pixelated;
  mix-blend-mode:soft-light;
  /* Lerped on --s: screen one's weight at the surface, screen two's once down.
     Opacity is the one property that can ride the scroll continuously without
     re-rasterising anything, so this costs the descent nothing. */
  opacity:calc(var(--grain,0) * (1 - var(--s)) + var(--grain-two,0) * var(--s))}

/* Over the type as well, so the screen is one photographed object rather than
   titles laid on a photograph. Above the poem panel, below the tuner — a tuner
   you cannot read is not a tuner. */
.l-grain-top{z-index:35}

/* Gate weave, in miniature. A frame of film is never still: the grain is a fresh
   draw every frame and the strip shifts in the gate. Six offsets on steps(1) is
   the projector's own rate. Nothing here repaints — it only re-composites one
   layer — but it does so at whatever --weave-dur asks for, so the rate slider is
   also the cost slider. */
/* Three rules, read top to bottom as one sentence: weave at the surface if
   screen one asked for it, never once we are under, unless screen two asked for
   it too. Specificity settles it without depending on source order —
   .landing[data-two] .l-grain beats .l-grain[data-weave-one], and adding
   [data-weave-two] beats that in turn. */
.l-grain[data-weave-one]{animation:l-grain-jitter var(--weave-dur,.5s) steps(1,end) infinite}
.landing[data-two] .l-grain{animation:none}
.landing[data-two] .l-grain[data-weave-two]{animation:l-grain-jitter var(--weave-dur,.5s) steps(1,end) infinite}

/* Twelve, not six, and the count is the point rather than the smoothness.
   These offsets are a RING — the grain is not random, it is the same short loop
   forever, and the loop is audible as a rhythm if it comes round too often. Six
   at 24 Hz would repeat four times a second; twelve halves that to two, which is
   where it stops reading as a pattern and starts reading as noise.

   Every offset is well under the tile period (~205px against ~40px of travel),
   so each one lands on a genuinely different phase of the tile instead of
   sliding back onto a repeat, and no two are near each other. */
@keyframes l-grain-jitter{
  0%      {transform:translate3d(0,0,0)}
  8.333%  {transform:translate3d(-2.4%,1.6%,0)}
  16.667% {transform:translate3d(1.8%,-2.2%,0)}
  25%     {transform:translate3d(-1.2%,-1.4%,0)}
  33.333% {transform:translate3d(2.6%,1.1%,0)}
  41.667% {transform:translate3d(-1.9%,2.4%,0)}
  50%     {transform:translate3d(0.7%,-2.9%,0)}
  58.333% {transform:translate3d(-2.8%,-0.6%,0)}
  66.667% {transform:translate3d(2.1%,2.7%,0)}
  75%     {transform:translate3d(-0.5%,1.9%,0)}
  83.333% {transform:translate3d(1.4%,-1.7%,0)}
  91.667% {transform:translate3d(-2.2%,-2.5%,0)}
}

/* A field of noise reshuffling two dozen times a second is precisely what this
   setting is for.
   The grain stays — it is part of the picture — only the shimmer stops. */
@media (prefers-reduced-motion: reduce){
  .l-grain[data-weave-one],
  .landing[data-two] .l-grain[data-weave-two]{animation:none}
}

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
  .landing{--bg-pos:12% 45%}
}
@media (max-aspect-ratio: 1/1){
  .landing{--bg-pos:17% 42%}
}

/* ---- nav ---- */
.l-nav{position:fixed;top:0;left:0;right:0;z-index:20;
  display:flex;justify-content:space-between;align-items:center;
  /* 18, not 26: the nav used to be two lines of 11.5px type and is now a
     bordered button ~36px tall. At the old padding it stood 88px off the top
     and screen two's title had to start below that — which is 88px the poem
     could not have. */
  padding:18px clamp(24px,3vw,52px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11.5px;letter-spacing:.3em}
.l-nav-left{display:flex;gap:clamp(20px,2.6vw,42px);align-items:baseline}
.l-nav-item{color:inherit;text-decoration:none;white-space:nowrap;
  background:none;border:none;padding:0;cursor:pointer;opacity:.95;transition:opacity .4s;
  text-shadow:0 1px 2px rgba(10,42,70,.5)}
.l-nav-item:hover{opacity:1}

/* The one thing being asked for, so it is the one thing built like a button.
   Set like the rest of the nav it reads as a link, which is what it was: 11.5px
   Jost in a corner, the same weight as a wordmark that does nothing. Same rule
   and same fill-on-hover as SIGN UP in the panel it opens — the two are one
   action seen twice, and looking alike is how anyone knows that. */
.landing .l-nav-cta{padding:9px 20px;border:1px solid rgba(255,255,255,.55);
  background:transparent;color:#fff;cursor:pointer;white-space:nowrap;
  font-family:'Jost',sans-serif;font-weight:400;font-size:11.5px;letter-spacing:.3em;
  text-shadow:0 1px 2px rgba(10,42,70,.5);
  transition:background .4s,color .4s,border-color .4s}
.landing .l-nav-cta:hover{background:#fff;color:#0d3550;border-color:#fff;text-shadow:none}

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
  11%{filter:drop-shadow(0 calc(-.034em * var(--dir,1) * var(--amp,1)) calc(.055em * var(--amp,1)) rgba(6,28,50,calc(.62 * var(--amp,1))))
             drop-shadow(0 calc(.021em * var(--dir,1) * var(--amp,1)) .006em rgba(255,255,255,calc(.72 * var(--amp,1))));
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
.landing .l-play[data-glyph=pause]{padding-left:0}
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
.l-bar{position:fixed;left:0;right:0;bottom:0;z-index:20;
  height:clamp(76px,11vh,104px);display:flex;align-items:center;
  gap:clamp(12px,1.2vw,22px);padding:0 clamp(20px,2.2vw,44px);
  background:linear-gradient(0deg,rgba(9,36,58,.86),rgba(9,36,58,.52) 62%,transparent);
  color:#f2f6f8;
  text-shadow:0 1px 8px rgba(6,26,44,.55);
  animation:l-bar-in .55s cubic-bezier(.2,.8,.2,1) both}
@keyframes l-bar-in{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:none}}
/* Colour stated, not inherited. The bar's #f2f6f8 was already what it wanted,
   but the glyph is the one thing on this page that must be unambiguously the
   same white as the hero's — say it here so it survives whatever the bar's own
   colour becomes. */
.landing .l-bar-toggle{width:38px;height:38px;border-radius:50%;
  border:1px solid rgba(242,246,248,.6);background:transparent;color:#fff;
  cursor:pointer;flex-shrink:0;transition:background .35s;
  display:flex;align-items:center;justify-content:center;padding:0}
.l-bar-toggle:hover{background:rgba(242,246,248,.18)}
/* A triangle centred on its bounding box looks left-of-centre in a circle,
   because its mass sits on the flat edge. The hero pads by 4 on a 58-76px ring;
   this one is 38px, so 1.5. Pause is two bars and is genuinely symmetric — it
   gets nothing. */
.l-bar-toggle .l-bar-tri{margin-left:1.5px}
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
.l-panel{position:fixed;inset:0;z-index:30;
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
  padding-left:3.2em;

  /* ---- the ink, and the light coming off it ----
     Two tokens, doing two different jobs:

     --poem-ink   a dark seat directly under the stroke, 1-2px, no more.
     --poem-halo  a cool bloom hugging it. Not black, because a jellyfish is lit
                  from inside and the panel is water — and cool rather than
                  neutral keeps it from reading as haze on the glass.

     Both radii are deliberately tiny, which is the opposite of where this
     started. The first pass used 10-30px blurs and was invisible on screen even
     at .7 alpha: this backdrop is a flat 80% navy scrim over a blurred painting,
     so a wide dark shadow is darkening something already dark, and a wide light
     one spreads its budget over hundreds of pixels and lands nowhere. The only
     place either has any contrast to work with is the pixel next to the stroke.
     Concentrate there and it reads; spread it and it evaporates.

     Which also decides what the effect *is*. There is no legibility problem here
     to solve — white on this scrim is already about 10:1 — so the halo is not a
     crutch, it is the light. Tight and bright, the hairline stops looking like
     UI text set over a picture and starts looking like something luminous in
     water. If it ever goes fuzzy instead of lit, the blur radius grew. */
  --poem-ink:rgba(2,14,26,.85);
  --poem-halo:rgba(186,230,252,.55)}
.l-poem-body{display:flex;flex-direction:column;
  gap:clamp(18px,3.2vh,38px);          /* the space between stanzas */
  /* Reaches left over the number gutter without moving anything in it: the
     padding grows the box, the negative margin puts the content back where it
     was. It matters because this box is what the hover reveal hangs off, and
     the numbers themselves hang OUTSIDE the text column — without this, moving
     the cursor onto a number leaves the box that is showing it. */
  padding-left:3.2em;margin-left:-3.2em}
.l-poem-stanza{display:flex;flex-direction:column;gap:clamp(1px,.35vh,5px)}

.landing .l-poem-line{position:relative;display:block;width:100%;text-align:left;
  background:none;border:none;padding:2px 0;color:#eef5f9;cursor:pointer;
  font-family:var(--poem-family);font-style:var(--poem-style);font-weight:var(--poem-weight);
  font-size:calc(var(--poem-size) * var(--poem-scale,1));line-height:var(--poem-lh);
  /* Bloom first, seat second — and the seat is offset down while the bloom is
     centred, so the light still reads as overhead without the glow lopsiding. */
  text-shadow:0 0 7px var(--poem-halo),
              0 1px 2px var(--poem-ink);
  opacity:.94;transition:opacity .35s,color .35s,text-shadow .35s}
/* Hover brightens the bloom and leaves the seat alone — the line lifts off the
   water rather than pressing harder into it. */
.landing .l-poem-line:hover{opacity:1;color:#fff;
  text-shadow:0 0 9px rgba(220,244,255,.8),
              0 1px 2px var(--poem-ink)}
/* Tracks with no demo read slightly quieter — enough to hint, not enough to
   break the poem's even colour. The poem is the work; availability is metadata. */
.landing .l-poem-soon{opacity:.62}
.landing .l-poem-soon:hover{opacity:.8;color:#eef5f9}

/* One variable set per candidate face. Sizes are not interchangeable: the
   scripts have much smaller x-heights than Cormorant. */
/* --poem-space is that face's own space advance, measured off the font. The ink
   row is a flex container, so the gaps between sense units are drawn by CSS, not
   by space characters — and if the number is wrong the poem visibly loosens or
   crowds at every word boundary that happens to be a unit boundary. */
.l-poem-f-nothing{--poem-family:'Nothing You Could Do',cursive;--poem-style:normal;
  --poem-weight:400;--poem-size:clamp(15px,2.2vh,24px);--poem-lh:1.75;--poem-space:.525em}
.l-poem-f-cormorant{--poem-family:'Cormorant Garamond',serif;--poem-style:italic;
  --poem-weight:500;--poem-size:clamp(17px,2.5vh,26px);--poem-lh:1.55;--poem-space:.234em}

.l-poem-num{position:absolute;right:calc(100% + .55em);top:.06em;
  font-family:'Nothing You Could Do',cursive;font-weight:400;
  font-size:.62em;letter-spacing:0;
  /* Seat only, no bloom. The number is metadata hanging in the margin; if it
     lights up the way the verse does it starts competing with it. */
  text-shadow:0 1px 2px rgba(2,14,26,.7);
  opacity:0;transition:opacity .3s}
/* All ten at once, from a cursor on any one line — and all ten gone the moment
   it leaves. Qi's call, and it is the right unit: the numbering is not a
   property of the line you happen to be over, it is the fact that these ten
   lines are also ten tracks. Revealing them one at a time asks the reader to
   discover that ten times.

   Hung off the body rather than off :has(.l-poem-line:hover), which would be
   the literal reading: the body's box IS the poem's column, and taking the
   whole column means the numbers do not flicker off and on every time the
   cursor crosses the gap between two stanzas.

   .42, where a single number used to be .5 — ten of them at once is far more
   ink than one, and the point of the reveal is to be answerable, not to turn
   the poem into a tracklist. :focus-within so a keyboard gets the same answer
   as a cursor. */
.l-poem-body:hover .l-poem-num,
.l-poem-body:focus-within .l-poem-num{opacity:.42}
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

/* The words, boxed. The row is a uniform column width — the longest line sets it
   — so anything measured on the row is measured against a length the reader
   cannot see. The ink box hugs its own text, which is the length they CAN see,
   and both the fill and the seek are read off it. vertical-align keeps a line
   that wraps from pushing its own row down by a descender. */
/* A wrapping flex row rather than a run of text, which is what makes the break
   authored instead of greedy: flex only breaks BETWEEN items, so the line gives
   at a caesura from POEM_LINES and nowhere else. A unit that cannot fit even
   alone still wraps inside itself — the guarantee is "turn at a pause if there
   is one", not "never overflow". Still shrink-to-fit (inline-flex), because the
   fill and the seek are both measured off this box hugging its own words. */
.l-poem-ink{position:relative;display:inline-flex;flex-wrap:wrap;
  column-gap:var(--poem-space,.5em);row-gap:0;
  max-width:100%;vertical-align:top}

@supports ((-webkit-background-clip:text) or (background-clip:text)){
  .landing .l-poem-playing .l-poem-ink{
    background-image:linear-gradient(90deg,
      var(--lit-bright) 48%, rgba(238,245,249,.34) 52%);
    background-size:200% 100%;
    background-position:calc(100% - var(--p,0%)) 0;
    background-repeat:no-repeat;
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;
    transition:background-position 1s linear,opacity .35s;

    /* text-shadow has to come off this line, and be replaced rather than
       dropped. Paint order inside an element is background, then text-shadow,
       then the glyph fill. Here the fill is transparent and the *background* is
       the gradient — so a text-shadow would land on top of the very thing it is
       supposed to sit behind, smearing dark over the progress fill and hollowing
       out the one line that is meant to be brightest.

       filter runs after the element is rasterised, so drop-shadow sees the
       gradient-filled glyphs as a finished picture and puts its blur underneath
       them, which is where a shadow belongs. Two passes only — drop-shadow
       blurs the whole layer, and it is not cheap.

       The bloom is mixed from --lit so it follows whichever colour is chosen at
       the top of this file; the rgba above it is the fallback for engines
       without color-mix, and is the foam value hard-coded. */
    text-shadow:none;
    filter:drop-shadow(0 1px 2px rgba(2,14,26,.7))
           drop-shadow(0 0 6px rgba(238,246,248,.45));
    filter:drop-shadow(0 1px 2px rgba(2,14,26,.7))
           drop-shadow(0 0 6px color-mix(in srgb,var(--lit) 45%,transparent));
  }
  /* The specificity fight this used to have with .l-poem-line:hover is gone now
     that the gradient sits one level down: a text-shadow on the row is an
     INHERITED value on the ink, and any rule that matches the ink directly beats
     inheritance outright, hover or not. The number stopped needing its
     text-fill patch for the same reason — it is a child of the row, and the row
     no longer paints its fill transparent. */
}

.landing .l-poem-playing .l-poem-num{color:var(--lit);
  animation:l-breathe 2.8s ease-in-out infinite}
@keyframes l-breathe{0%,100%{opacity:.32}50%{opacity:.95}}
/* Held, not stopped. The breath going still is one of the two things the margin
   reports; the glyph below is the other. */
.landing .l-poem-playing[data-paused] .l-poem-num{animation:none;opacity:.85}

/* ---- the number on the sounding line is the transport ----

   Press-to-seek took the line's click, so pause moved out here — which is where
   a player keeps its transport anyway, in the gutter to the left of the row. But
   as shipped it was a 10x17px pair of digits that reads as metadata, so it was
   a control nobody could find or hit. Two fixes, neither of which touches the
   verse:

   The hit area grows to ~30px without moving the glyph — an invisible ::before,
   not padding, since the number is positioned off its right edge and padding
   would shove it. It grows LEFT into the empty margin and stops 6px short of the
   first letter: a press near the start of the line has to stay a seek to zero,
   which is the one seek anyone makes by hand. */
.landing .l-poem-playing .l-poem-num::before{content:'';position:absolute;
  right:0;top:-4px;bottom:-4px;width:30px}
/* And the digits become a play glyph while the line is under the cursor — the
   number is still the number the rest of the time, which is what keeps the
   margin looking like a margin. Crossfaded rather than swapped: colour on the
   digits, opacity on the glyph, both .18s, so it reads as one thing turning
   over. The glyph restates its colour because the digits' transparent is an
   inherited value it would otherwise pick up. */
.landing .l-poem-playing .l-poem-num{transition:opacity .3s,color .18s}
.landing .l-poem-playing:hover .l-poem-num,
.landing .l-poem-playing:focus-visible .l-poem-num{color:transparent}
/* Both glyphs are drawn, for the same reason the bar's are: U+25B6 is
   emoji-by-default, so the paused state of a tracklist line came up on iOS as a
   colour emoji — wrong hue, wrong weight, and immune to var(--lit). A mask over
   a --lit fill keeps the glyph the exact colour of everything else that means
   "this is the one sounding", and keeps the two states the same optical weight,
   which no font pairing of U+275A and U+25B6 ever managed.
   Sized in em so it tracks the number, which is itself .62em of the verse. */
.landing .l-poem-playing .l-poem-num::after{content:'';position:absolute;
  right:0;top:50%;transform:translateY(-50%);display:block;
  width:.62em;height:.82em;background:var(--lit);
  -webkit-mask:var(--glyph-pause) right center/contain no-repeat;
          mask:var(--glyph-pause) right center/contain no-repeat;
  opacity:0;transition:opacity .18s}
.landing .l-poem-playing[data-paused] .l-poem-num::after{width:.58em;
  -webkit-mask-image:var(--glyph-play);mask-image:var(--glyph-play)}
.landing .l-poem-playing:hover .l-poem-num::after,
.landing .l-poem-playing:focus-visible .l-poem-num::after{opacity:1}
/* No cursor to reveal it with, so on a touch screen the sounding line wears the
   glyph the whole time. Losing that one number costs nothing — it is the line
   you are listening to, and the poem still numbers the other nine. */
@media (hover:none){
  .landing .l-poem-playing .l-poem-num{color:transparent}
  .landing .l-poem-playing .l-poem-num::after{opacity:1}
}

/* ---- the sounding line as its own scrub bar ----

   The words are the length of the track — they are what the fill crosses — so
   they are pressed rather than clicked, and a hairline follows the pointer to
   say where the ink would end up if you let go. Hover is the whole affordance:
   nothing is added to the verse until someone reaches for it.

   pan-y and not none: the panel scrolls on a short screen, and a thumb starting
   its swipe on the line that happens to be playing must still be able to move
   the poem. Horizontal intent is what arrives here. */
/* A drag across the words is a scrub, so it must not also be a text selection —
   the highlight lands on top of the fill, and on a phone it summons the copy
   bubble over the poem. Only the sounding line gives it up. */
.landing .l-poem-playing{touch-action:pan-y;-webkit-user-select:none;user-select:none}
/* No transition while a drag is live — the fill's 1s glide is there to smooth
   the once-a-second progress tick, and under the pointer it reads as lag. */
.landing .l-poem-playing .l-poem-ink[data-scrubbing]{transition:opacity .35s}
.landing .l-poem-playing .l-poem-ink::after{content:'';position:absolute;
  left:var(--h,0);top:-.06em;bottom:-.06em;width:1px;background:var(--lit-bright);
  opacity:0;transition:opacity .22s;pointer-events:none}
.landing .l-poem-playing .l-poem-ink[data-scrub]::after{opacity:.6}
/* The clock rides above the hairline, in the leading of the line above, where
   there is already air. Its fill has to be restated: the parent's is
   transparent, and that inherits. */
.l-poem-time{position:absolute;left:var(--h,0);bottom:calc(100% - .18em);
  transform:translateX(-50%);font-family:'Jost',sans-serif;font-weight:300;
  font-size:9px;letter-spacing:.14em;color:var(--lit-bright);
  -webkit-text-fill-color:var(--lit-bright);
  text-shadow:0 1px 2px rgba(2,14,26,.8);
  opacity:0;transition:opacity .22s;pointer-events:none;white-space:nowrap}
.landing .l-poem-ink[data-scrub] .l-poem-time{opacity:.8}
/* No pointer to hover with, so there is no preview to give — the tap is the
   seek. A hairline stranded at the last touch is worse than none. */
@media (hover:none){
  .landing .l-poem-ink[data-scrub]:not([data-scrubbing])::after,
  .landing .l-poem-ink[data-scrub]:not([data-scrubbing]) .l-poem-time{opacity:0}
}


/* Wide enough that the sentence the form lives in holds one line on a laptop;
   under that it wraps at the flex gaps, which sit between clauses. */
.l-sub{display:flex;flex-direction:column;align-items:center;text-align:center;
  gap:20px;margin:auto;max-width:min(780px,92vw)}
.l-sub-title{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:clamp(28px,4vw,46px);margin:0}
/* Sized off the title's em so it stays a mark in the line, not an image beside
   it. Everything else about the creature -- how it is drawn and how it swims --
   lives in components/JellyMark.tsx, whose CSS is appended below. */
.l-sub-wink{width:.57em;height:.66em;vertical-align:-.02em;margin-left:.16em}
.l-sub-form{display:flex;align-items:baseline;justify-content:center;
  flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:clamp(15px,1.7vw,19px)}
.l-sub-say{opacity:.85;white-space:nowrap}
.l-sub-input{width:min(240px,58vw);padding:0 4px 5px;border:none;
  border-bottom:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;
  font-size:inherit;font-family:inherit;outline:none;text-align:center;
  transition:border-color .3s}
.l-sub-input:focus{border-bottom-color:rgba(255,255,255,.95)}
.l-sub-input::placeholder{color:rgba(255,255,255,.4)}
/* .landing-qualified for the same reason .landing button{font:inherit} is: a
   bare .l-sub-go would lose to it on specificity however late it comes. */
.landing .l-sub-go{position:relative;padding:0 1px;border:none;
  background:transparent;color:#fff;font-family:inherit;font-size:inherit;
  font-style:italic;cursor:pointer;opacity:.85;transition:opacity .3s}
.l-sub-go-ink{border-bottom:1px solid rgba(255,255,255,.55);transition:border-color .3s}
/* A two-letter word is a thumb-sized target only if something invisible says so.
   Absolute, so the sentence keeps its own metrics. */
.l-sub-go::after{content:'';position:absolute;left:-16px;right:-16px;top:-14px;bottom:-14px}
.l-sub-go:hover{opacity:1}
.l-sub-go:hover .l-sub-go-ink{border-bottom-color:#fff}
.l-sub-go:disabled{cursor:default;opacity:.45}
.l-sub-thanks{font-size:16px;font-style:italic;font-family:'Cormorant Garamond',serif}
.l-sub-err{margin:0;font-size:13px;font-style:italic;
  font-family:'Cormorant Garamond',serif;color:#ffd9c9;opacity:.9}

/* ---- narrow ---- */
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
.l-tuner{position:fixed;right:18px;top:76px;z-index:40;max-width:248px;
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

/* ==================================================================
   TWO SCREENS, ONE DESCENT
   ==================================================================

   Everything below is the second screen and the way down to it. The rule that
   makes it work is that nothing here is a second page: the painting, the nav
   and the player are fixed to the WINDOW and only the type scrolls past them,
   so screen two is the same picture seen from further down rather than a new
   one. One number carries it — --s, the scroll position over one screen height,
   0 on the shore and 1 in the water, written to .landing by the scroll effect.
   Every layer below reads it. None of them reads anything else. */

.landing{
  /* Defaults so the page is correct before a single scroll event has fired,
     and so it is still correct with JS off: --s pinned at 0 is exactly screen
     one, and the scroller still scrolls. */
  --s:0;
  /* The bar's own height, named once. Two things have to get out of its way
     and neither should have to know the number. */
  --barh:clamp(76px,11vh,104px);
  --bar:0px}
.landing[data-bar]{--bar:var(--barh)}

/* The scroller. Fixed, with both screens inside it, rather than letting the
   document scroll: the backdrop and the player have to hold still while the
   type moves, and one fixed shell with a single scrolling child is the version
   of that which does not depend on position:fixed behaving inside whatever
   ancestor iOS has decided to make a containing block this year.
   The scrollbar is hidden because the arrow is the affordance. */
.l-scroll{position:fixed;inset:0;z-index:10;overflow-y:auto;overflow-x:hidden;
  scroll-snap-type:y mandatory;scrollbar-width:none;overscroll-behavior-y:none}
.l-scroll::-webkit-scrollbar{display:none}
.l-screen{position:relative;width:100%;min-height:100%;scroll-snap-align:start}
.l-one{height:100%;
  /* The shore does not merely leave, it dissolves. Multiplied so it is gone at
     ~87% of the way down, which is where the water has taken over anyway. */
  opacity:clamp(0,calc(1 - var(--s) * 1.15),1)}

/* Mandatory snap is the whole feeling of "two pages", and it is also the one
   thing here that can trap a reader: a screen taller than the window has no
   snap position at its own bottom, so the tail of the poem becomes unreachable
   — the scroller keeps pulling back to the top of the section.

   So it gives way, and it gives way on a measurement rather than on a
   breakpoint. data-tall means the two screens measured more than two screens;
   see the scroll effect. Proximity still settles onto a screen when you let go
   near one, so the two-page feel survives everywhere it can afford to. */
.landing[data-tall] .l-scroll{scroll-snap-type:y proximity}

/* With scripting off, --s never moves and screen two would be white
   handwriting over a bright sky. Everything else on this page is gone in that
   world too — the countdown, the player, the panels — but a static page is one
   kind of broken and an unreadable one is another, so the water gets painted in
   a way that does not need a scroll position to exist. */
@media (scripting: none){
  .l-two{background:linear-gradient(180deg,rgba(6,28,50,.88),rgba(2,13,27,.95))}
  .landing .l-down{display:none}
}

/* ---- the backdrop, and the water that comes over it ---- */
.l-stage{position:fixed;inset:0;z-index:0;overflow:hidden}
/* The camera sinks: the painting drifts up and opens slightly as it goes, which
   is parallax and nothing more — but it is what keeps the second screen from
   reading as the first screen with a filter on it. Transform only, so it stays
   on the compositor. */
.l-bg,.l-halo{transform:translate3d(0,calc(var(--s) * -3.4vh),0) scale(calc(1 + var(--s) * .07));
  transform-origin:50% 42%;will-change:transform;transition:filter .55s ease}
/* Depth eats detail and colour before it eats light.

   Thresholded, NOT interpolated off --s. A blur whose radius changes every
   frame re-rasterises a full-bleed image every frame, and it does it exactly
   while the scroll is in flight — which is the one moment the page cannot
   afford it and the one moment anyone would notice. Crossing data-two instead
   costs a single bounded transition, and reads better besides: sharp while you
   are moving, soft once you have arrived.

   Wide screens only. A laptop absorbs one full-bleed blur; a phone should not
   be asked to. */
@media (min-width:900px){
  .landing[data-two] .l-bg{filter:blur(3px) contrast(var(--film-con,1)) saturate(calc(var(--film-sat,1) * .62))}
}

/* The dark. Two gradients, because deep water does two things at once and one
   of them is not vertical.

   The linear one is depth: heaviest at the bottom of the frame, because that is
   where the reader is going and because it puts the weight under the footer
   rather than under the verse.

   The radial one is the water closing in — it darkens everything the poem is
   not, which is what stops the second screen from reading as the first screen
   with the lights off. It is also what leaves the figure on the shore as a
   ghost rather than as a subject: he is still there, still standing where he
   was one screen ago, but he is no longer the thing being looked at. That is
   the storyboard, not a compromise — see the frame notes in CLAUDE.md.

   Both stop short of opaque so the oil texture survives the descent. A flat
   colour is the one thing this background must never be, at any depth. */
.l-deep{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:var(--s);
  background:
    radial-gradient(78% 62% at 46% 46%,transparent 24%,rgba(2,13,27,.34) 68%,rgba(2,13,27,.62) 100%),
    linear-gradient(180deg,
      rgba(7,32,56,.66) 0%,
      rgba(5,24,45,.86) 44%,
      rgba(2,13,27,.94) 100%)}

/* The light that is left, which comes from above and behind — the surface,
   receding. It breathes, which is the same 9-11s swell the water in /descent
   has. The breathing lives on the child so that its keyframes hold plain
   numbers: a keyframe that multiplies --s would have to re-resolve mid-scroll,
   and engines disagree about whether it does. Parent carries --s, child
   carries the motion. Nothing has to agree with anything. */
.l-surface{position:absolute;left:50%;top:-22vh;width:150vw;height:88vh;z-index:3;
  transform:translateX(-50%);pointer-events:none;opacity:var(--s)}
.l-surface::before{content:'';position:absolute;inset:0;
  background:radial-gradient(46% 62% at 50% 0%,
    rgba(158,214,240,.22),rgba(158,214,240,.07) 52%,transparent 78%);
  animation:l-swell 11s ease-in-out infinite}
@keyframes l-swell{0%,100%{opacity:.62;transform:scale(1)}50%{opacity:1;transform:scale(1.06)}}

/* Shafts from the surface.
   
   This replaces a field of drifting dots, and the reason is worth keeping: at
   any size a repeating tile of 1px specks reads as CSS stars, not as water.
   Particulate is a HIGH-frequency cue and the eye resolves every one of them
   individually, so the moment the tile repeats — and it always repeats — the
   illusion is a pattern.
   
   Light is the low-frequency cue, and low frequency is what survives being
   looked at. Nothing below is an object: five shafts, each 12-26vw wide, each
   soft-edged by a mask rather than by a blur, all leaning the same way because
   there is one sun and it is up and to the left. They pivot from their own top
   edge, which is what a shaft does when the surface above it moves.
   
   The periods are 17/23/29/37/43s — near-primes, so no two are ever in phase
   and the group never visibly repeats. 'alternate' rather than a loop, because
   a shaft that returns to its start position every cycle has a seam, and a
   shaft that sways back does not. That is the whole trick: the effect is the
   absence of a period anyone can find. */
.l-rays{position:absolute;inset:-10% 0 0;z-index:3;pointer-events:none;overflow:hidden;
  opacity:calc(var(--s) * .95);
  /* Gone well before the poem: this is light in the water above the reader, not
     a wash over the verse. */
  -webkit-mask-image:linear-gradient(180deg,#000 0 46%,transparent 84%);
          mask-image:linear-gradient(180deg,#000 0 46%,transparent 84%)}
.l-rays i{position:absolute;top:-14%;height:114%;left:var(--x);
  transform-origin:50% 0;
  /* A floor, not a media query: the widths are in vw so they hold their share
     of the frame, and on a phone that share is 60-100px — narrow enough that a
     shaft starts reading as a band with edges. Below the floor it stops being
     light. */
  width:max(var(--w),112px);
  background:linear-gradient(180deg,
    rgba(190,228,250,var(--a)) 0%,
    rgba(190,228,250,calc(var(--a) * .34)) 46%,
    transparent 78%);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 46%,#000 54%,transparent);
          mask-image:linear-gradient(90deg,transparent,#000 46%,#000 54%,transparent);
  animation:l-ray var(--dur) ease-in-out infinite alternate;
  animation-delay:var(--delay);will-change:transform,opacity}
@keyframes l-ray{
  from{transform:rotate(var(--r1)) scaleX(.88);opacity:.5}
  to{transform:rotate(var(--r2)) scaleX(1.3);opacity:1}
}
.l-rays i:nth-child(1){--x:2%;--w:18vw;--a:.16;--dur:29s;--delay:-4s;--r1:-4deg;--r2:-1deg}
.l-rays i:nth-child(2){--x:19%;--w:13vw;--a:.2;--dur:17s;--delay:-11s;--r1:-1deg;--r2:2deg}
.l-rays i:nth-child(3){--x:38%;--w:26vw;--a:.11;--dur:43s;--delay:-19s;--r1:2deg;--r2:5deg}
.l-rays i:nth-child(4){--x:63%;--w:15vw;--a:.17;--dur:23s;--delay:-7s;--r1:4deg;--r2:8deg}
.l-rays i:nth-child(5){--x:80%;--w:21vw;--a:.13;--dur:37s;--delay:-26s;--r1:6deg;--r2:10deg}

/* The body of the water, moving.
   
   Two enormous, very soft, very quiet clouds crossing on periods long enough
   that you never catch one arriving — 96s and 137s, again not multiples. They
   do almost nothing per frame, which is the point: they keep the dark from
   being a flat fill without ever becoming something to look at. Same rule as
   the painting itself — a flat colour is what this background must never be. */
.l-drift{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;
  opacity:calc(var(--s) * .9)}
.l-drift i{position:absolute;top:var(--y);left:0;width:var(--w);height:var(--h);
  background:radial-gradient(closest-side,rgba(126,186,222,var(--a)),transparent 74%);
  animation:l-drift-x var(--dur) ease-in-out infinite alternate;
  animation-delay:var(--delay);will-change:transform}
/* Translation only. These are the two largest elements on the page (78vw x 66vh
   for the first), and a scale on a gradient that size is a re-raster the
   compositor cannot help with — where a translate is free. Nothing was gained
   by the scale that a slower crossing does not give for nothing. */
@keyframes l-drift-x{
  from{transform:translate3d(var(--from),0,0)}
  to{transform:translate3d(var(--to),5vh,0)}
}
.l-drift i:nth-child(1){--y:6%;--w:78vw;--h:66vh;--a:.13;--dur:96s;--delay:-30s;
  --from:-24vw;--to:34vw}
.l-drift i:nth-child(2){--y:44%;--w:56vw;--h:52vh;--a:.09;--dur:137s;--delay:-64s;
  --from:62vw;--to:6vw}

/* ---- the wordmark, which is also the way back up ---- */
.landing .l-mark{background:none;border:none;padding:0;color:inherit;cursor:pointer;
  font-family:'Jost',sans-serif;font-weight:300;
  font-size:clamp(13px,1.05vw,16px);letter-spacing:.34em;
  white-space:nowrap;text-shadow:0 1px 2px rgba(10,42,70,.5);
  /* Exactly the inverse of the title it stands in for: it arrives as the carved
     one leaves, so the album is named on both screens and never twice at once.
     Untouchable until it is actually there — an invisible button in the corner
     of the first screen is a trap, not a courtesy. */
  opacity:calc(var(--s) * .8);pointer-events:none;transition:opacity .25s}
.landing[data-two] .l-mark{pointer-events:auto}
.landing[data-two] .l-mark:hover{opacity:1}


/* ---- the down-mark ----

   What the ten titles used to be. Naming every track at the bottom of screen
   one meant the album was over before anyone had scrolled — so it is a mark
   now, which says there is more without saying what, and the poem gets to
   arrive whole.

   Chosen out of eight over three rounds, and the two rejected directions are
   the useful record:

   - HAIRLINES. Five of them, on the argument that this page is 1px rules
     everywhere. Invisible, twice. A rule that is structure and a rule you are
     meant to notice are not the same job, and the second one cannot hold the
     tight dark halo that keeps every other white mark on this painting legible
     — 1px is simply too little glyph to seat a shadow under.
   - INK. Five in the painting's own dark, on the reasoning that white cannot
     win on a light ground. True as physics, wrong as design: a dark mark is
     then the darkest thing in the lower half of a painting whose lower half is
     entirely light, so it stops being an invitation and becomes an object.

   What won keeps white, takes the weight, and has no container at all — two
   marks and nothing else, which is the least furniture of the eight. It sits
   at the bottom of the frame, which on this painting is sea and foam: the
   lightest, busiest part of it. */
.landing .l-down{position:absolute;left:50%;z-index:10;
  bottom:calc(clamp(22px,4vh,40px) + var(--bar));
  display:flex;flex-direction:column;align-items:center;gap:9px;
  background:none;border:none;padding:14px 30px;cursor:pointer;color:#fff;
  transform:translateX(-50%);
  opacity:clamp(0,calc(1 - var(--s) * 3),1);
  transition:bottom .5s cubic-bezier(.2,.8,.2,1);
  /* Two, in sequence: the bob's delay is the entrance's delay plus its
     duration, so it takes over the transform exactly as the entrance lets go.
     fill-mode backwards, not both — the entrance holds its first frame through
     the delay and then lets go, leaving the scroll fade above free to take the
     opacity back. With 'both' the animation would own opacity forever and the
     mark would ride all the way down to the poem. */
  animation:l-down-in 1.2s cubic-bezier(.2,.7,.2,1) 1.15s backwards,
            l-down-bob 3.4s ease-in-out 2.35s infinite}
@keyframes l-down-in{
  from{opacity:0;transform:translate(-50%,12px)}
  to{opacity:1;transform:translate(-50%,0)}
}
@keyframes l-down-bob{
  0%,100%{transform:translate(-50%,0)}
  50%{transform:translate(-50%,6px)}
}
/* The same halo the hero's labels carry, and for the same reason. Tight, or it
   stops being light and becomes the patch of grey we took out from behind an
   earlier version of this mark. */
.l-down-chev{display:block;
  filter:drop-shadow(0 1px 2px rgba(10,42,70,.55)) drop-shadow(0 0 10px rgba(10,42,70,.45))}
/* The pair is drawn identical and separated only by WHEN it is bright: the
   light runs from the upper mark to the lower and starts again, so the two
   point by moving rather than by being drawn pointing. Offset by 0.42s of a
   2.6s cycle rather than by half of it, so they are never both bright and
   never both dim — either reads as blinking, and one travelling mark is what
   this is meant to be. */
.l-down-a{animation:l-down-lead 2.6s ease-in-out infinite}
.l-down-b{animation:l-down-lead 2.6s ease-in-out infinite;animation-delay:.42s}
@keyframes l-down-lead{
  0%,100%{opacity:.34;transform:translateY(0)}
  30%{opacity:1;transform:translateY(2px)}
  60%{opacity:.34;transform:translateY(0)}
}
.l-down:hover .l-down-a,
.l-down:focus-visible .l-down-a,
.l-down:hover .l-down-b,
.l-down:focus-visible .l-down-b{animation-play-state:paused;opacity:1}
.l-down:focus-visible{outline:none}

/* ---- screen two ---- */
/* Top clears the fixed nav, bottom clears the player when there is one. The
   poem itself is centred in what is left, so adding the player nudges the verse
   up rather than putting the bar on top of it. */
.l-two{display:flex;align-items:center;justify-content:center;
  /* Top clears the fixed nav, bottom clears the player when there is one. */
  padding:clamp(78px,11vh,118px) clamp(24px,6vw,80px)
          calc(clamp(44px,7.6vh,90px) + var(--bar))}

/* The album, in the poem's own hand — see the note in the markup for the one
   thing that keeps it from reading as the poem's first line. A wider bloom than
   the lines get, because the strokes are bigger here and the same 7px would sit
   inside the letterform instead of around it. Same dark seat. */
.l-poem-head{--o:.72;font-family:'Nothing You Could Do',cursive;font-weight:400;
  font-size:clamp(26px,3.7vh,42px);letter-spacing:.01em;line-height:1.2;
  opacity:.72;margin-bottom:clamp(46px,9.5vh,98px);
  text-shadow:0 0 11px rgba(186,230,252,.5),0 1px 2px rgba(2,14,26,.8)}

/* The Chinese title, set the way it would be on a spine. It is the only thing
   on this screen that is neither English nor a control, and it hangs in the
   right margin where a seal would — the one place it can be large and quiet at
   once. Below 900px there is no margin to hang anything in, so it goes.

   It was built out into a literal spine once — a ruled band with a 白文 seal in
   its foot — and taken back to this. The band was furniture the screen had to
   make room for and the seal was a second focal point, on a screen whose whole
   job is to hold one poem. Ceremony, not architecture.

   The rule above it is an inline-block inside vertical text, which is why its
   size is given logically: in vertical-rl the inline axis runs down the page, so
   inline-size is the length of the line and block-size is its thickness. */
.l-two-cn{--o:.32;position:absolute;right:clamp(20px,3.4vw,54px);top:50%;
  transform:translateY(-50%);writing-mode:vertical-rl;pointer-events:none;
  font-family:'Noto Serif SC','Songti SC',serif;font-weight:300;
  font-size:clamp(13px,1.55vh,18px);letter-spacing:.62em;color:#dcecf6;opacity:.32;
  text-shadow:0 0 10px rgba(150,210,240,.35),0 1px 2px rgba(2,14,26,.7)}
/* One rule at each end, so the title is stopped rather than merely started.
   Sizes are logical because the box is in vertical-rl: the inline axis runs down
   the page, so inline-size is the length of a rule and block-size is its
   thickness, and inline-start/-end are its top and bottom.

   The text needs its own negative margin or the two gaps come out unequal.
   Letter-spacing lands after the last character as well as between, so the
   title's box carries .62em of empty run at the bottom that the top does not
   have — which is invisible until something is sitting under it. */
.l-two-cn-rule{display:inline-block;inline-size:clamp(24px,6vh,58px);block-size:1px;
  background:currentColor;opacity:.55;vertical-align:middle}
.l-two-cn-rule:first-child{margin-inline-end:clamp(12px,2.6vh,26px)}
.l-two-cn-rule:last-child{margin-inline-start:clamp(12px,2.6vh,26px)}
.l-two-cn-text{margin-inline-end:-.62em}
@media (max-width:900px){.l-two-cn{display:none}}

/* The verse gets more room than it had in the panel, since it now has a screen
   rather than a hole cut in one. Both faces move together — see POEM_FONTS for
   why they cannot share a number. */
/* The verse gets more room than it had in the panel, since it now has a screen
   rather than a hole cut in one. It still has to clear one window — see the
   'tall' measurement for what happens when it does not — but with the title and
   the poem the only things on the screen, that is no longer tight. */
.l-two .l-poem-f-nothing{--poem-size:clamp(16px,2.5vh,27px)}
.l-two .l-poem-f-cormorant{--poem-size:clamp(18px,2.8vh,29px)}
/* Hover only, at Qi's call, and he is right: printed numbers make the screen a
   tracklist, and the screen wants to be a poem first and a tracklist second.
   They are still there the moment anyone reaches for the poem — see the reveal
   on .l-poem-body — and always there on touch, where there is no reaching. */

/* ---- how screen two arrives ----

   The lines surface one after another, from blurred and low to sharp and still,
   which is a poem coming into focus as you sink to it — and the same 55ms
   stagger as everything else that reads left to right on this page.

   Two things make it safe. It is wrapped in no-preference, so the base opacity:0
   never exists for a reader who asked for less motion (the global
   animation:none would otherwise leave them a blank screen). And it ends at
   var(--o) rather than at 1, because three of these elements are deliberately
   not opaque and a fill-mode animation ending at 1 would silently overrule
   every one of them, forever. */
@media (prefers-reduced-motion:no-preference){
  .l-poem-head,.l-poem-row,.l-two-cn{opacity:0}
  .l-two.is-in .l-poem-head{animation:l-in .9s cubic-bezier(.2,.7,.2,1) both}
  .l-two.is-in .l-poem-row{animation:l-in .85s cubic-bezier(.2,.7,.2,1) both;
    animation-delay:calc(var(--i,0) * 55ms)}
  .l-two.is-in .l-two-cn{animation:l-in-cn 1.3s cubic-bezier(.2,.7,.2,1) .5s both}
}
@keyframes l-in{
  from{opacity:0;transform:translateY(16px);filter:blur(4px)}
  to{opacity:var(--o,1);transform:none;filter:none}
}
/* The vertical title comes in along its own axis, so it keeps its centring. */
@keyframes l-in-cn{
  from{opacity:0;transform:translateY(-50%) translateX(14px)}
  to{opacity:var(--o,1);transform:translateY(-50%)}
}

@media (max-width:560px){
  /* The numbers hang outside the column, and on a phone that column is most of
     the screen — 3.2em of margin is a fifth of it. */
  .l-two .l-poem{padding-left:2.5em}
  /* A phone is where the poem stops being ten lines. Three of them turn, so the
     column is fourteen rows rather than ten and the type has to come down to
     pay for the four it did not budget for — 2.5vh of a phone is a comfortable
     size for a line that fits and an overflowing screen for one that doesn't. */
  .l-two{padding-top:clamp(70px,10vh,110px)}
  .l-two .l-poem-f-nothing{--poem-size:clamp(15px,2.15vh,22px)}
  .l-two .l-poem-f-cormorant{--poem-size:clamp(16px,2.4vh,24px)}
  .l-two .l-poem-body{gap:clamp(16px,2.6vh,30px)}
  .l-poem-head{font-size:clamp(23px,3.1vh,32px);margin-bottom:clamp(30px,5.8vh,64px)}
  .landing .l-mark{font-size:12.5px;letter-spacing:.24em}
  .landing .l-nav-cta{padding:8px 14px;font-size:10.5px;letter-spacing:.22em}
}

@media (prefers-reduced-motion: reduce){
  .landing *{animation:none !important}
}
`;
