# qi.land web — context for Claude

The site for Qi · 琦's debut album *The Heart of the Jellyfish* (release: 2026-12-20).
Two things live here. `/` is the public front page: two screens — the shore painting
with the album over it, then the tracklist as a poem under water. `/descent` is the R3F telling of the same story — above
water → past the jellyfish → into the abyss — kept for later, not the front door.

## Stack

- **Next.js 15** App Router + TypeScript, **React 19**
- **react-three-fiber** + **drei** + **three.js** (`three/examples/jsm/objects/Water.js` for the water surface, drei `<Sky>` for atmosphere)
- **leva** for in-browser tweaking (toggled with `?tweak=1`)
- **Tailwind** for the typographic overlay
- Deployed on Vercel

## Architecture in one paragraph

[components/Descent.tsx](components/Descent.tsx) owns a single `depthRef` (0..1) driven by scroll. It mounts [components/OceanScene.tsx](components/OceanScene.tsx) (the R3F `<Canvas>` + scene) and [components/Poem.tsx](components/Poem.tsx) (the scrollable text overlay). Every visual element inside the scene reads `depthRef.current` from `useFrame` to drive its own appearance — fog color, camera Y, light shaft visibility, particle opacity, etc. There is **no global state library**; the ref is the single source of truth.

### Depth landmarks

| depth | landmark | camera Y |
|---|---|---|
| 0.00 | above water (sunset sky) | +14 |
| 0.05–0.18 | crossing the surface | — |
| 0.55 | jellyfish (the heart, frame VI) | -22 |
| 0.78 | shipwreck reveal threshold | — |
| 1.00 | abyss | -55 |

Constants live at the top of OceanScene: `SURFACE_Y`, `JELLY_Y`, `ABYSS_Y`, `WRECK_Y`, `WRECK_REVEAL_DEPTH`. Don't hardcode magic Y values in new props — derive them.

### Focus shortcuts

- `/descent` — full 3D descent (this was `/` until 2026-07-27)
- `/descent?focus=heart` — locks at d=0.55
- `/descent?focus=abyss` — locks at d=0.92
- `?tweak=1` — shows leva panel
- `/` — the two-screen front page (see below); shares no code with the above

## The front page (`/`) — two screens, one descent

*(rebuilt from one screen to two on 2026-08-22)*

`/` is two screens and nothing else: the shore, and the tracklist under water. The
document itself never scrolls — `html, body { overflow: hidden }`, the root is
`position: fixed`, and inside it **one fixed scroller** (`.l-scroll`) holds both
screens. Everything that must hold still while the type moves — the painting, the
nav, the player — is a sibling of that scroller, fixed to the window.

[components/Landing.tsx](components/Landing.tsx) is the whole thing — markup plus a
`LANDING_CSS` string at the bottom. Layers, back to front: the stage (painting,
scrim, vignette, and the four water layers over them), the scroller with its two
screens, the nav, the player, and the panel.

### The descent is one number

`--s` is the scroll position over one screen height, clamped to 0..1: **0 on the
shore, 1 in the water.** It is written straight to `.landing` as a custom property
by the scroll effect, and *everything* about the transition reads it — the veil's
opacity, the parallax and blur on the painting, the light from the surface, the
light shafts, the drift, screen one fading out, the arrow fading out, the wordmark
fading in.
One source of truth, so no two layers can disagree about how deep we are.

Two rules about it that are easy to undo by accident:

- **It is not React state.** Re-rendering this component — SVG filters, ten poem
  lines, a waveform — sixty times a second to move a gradient would be an absurd
  price for a backdrop. The only state the scroll drives is `atTwo` (a boolean, so
  it changes twice) and `tall` (see below).
- **It is read synchronously in the handler, not in a `requestAnimationFrame`.**
  rAF is suspended in a background tab, and a scroll that lands while it is
  suspended would leave `--s` frozen — backdrop showing one screen, type showing
  the other. The work is two property reads and one style set; there is nothing
  worth coalescing. (Same lesson as the tracklist measurement that used to live
  here, and the same reason.)

One thing about it is deliberately **not** interpolated: the blur on the painting.
A blur radius driven off `--s` re-rasterises a full-bleed image on every frame of
the scroll — the one moment the page cannot afford it and the one moment anyone
would notice. It is thresholded on `data-two` with a single bounded transition
instead, which is cheaper *and* reads better: sharp while you are moving, soft once
you have arrived. **Interpolate transforms and opacities off `--s`; step anything
that repaints.**

Screen two is *the same painting seen from further down*, not a second image: the
figure is still standing where he was one screen ago, as a ghost behind the veil.
That is the storyboard, not a compromise — see the frame notes in the workspace
CLAUDE.md. The veil stops short of opaque in both its gradients so the oil texture
survives the descent; **a flat colour is what this background must never be, at any
depth.**

### The Chinese title

It hangs in the right margin: 水母之心 set vertically between two hairlines, one at
each end so the title is stopped rather than merely started. Gone below 900px, where
there is no margin to hang anything in. Bilingual is the
album's voice and vertical is Chinese's own setting, not an ornament — that part is
settled.

**It was built out into a literal spine once** — a ruled band with a width, a lit
fold, banding at both ends and a 白文 seal in the foot compartment — and taken back
to the line the same day. The reasons are worth keeping, because the build was
*correct* and still wrong for the screen: the band was furniture the layout had to
make room for (screen two's right padding had to reserve it), and the seal was a
second focal point on a screen whose entire job is to hold one poem. Ceremony, not
architecture. If it ever comes back, it comes back on a screen that has room to be
an object rather than a page.

Vertical text has one trap worth knowing: letter-spacing lands *below* the last
character as well as between them, so the block carries a run of empty at its foot
that its head does not have. Invisible until something sits under it — which is
exactly what the second hairline does, and why the title carries a negative
`margin-inline-end` to make the two gaps equal. (Everything in that box is sized
logically, because in `vertical-rl` the inline axis runs down the page: `inline-size`
is the length of a rule, `block-size` is its thickness, and inline-start/-end are its
top and bottom.)

### Light, not particles

*(the first pass at this shipped drifting motes and was replaced on 2026-08-22 —
Qi's read was "有点假，小儿科", and he was right)*

The water above the poem is **five light shafts and two drift clouds**, and the rule
they are built on is worth keeping because it is the one that decides whether an
effect looks expensive or cheap:

**Particulate is a high-frequency cue and the eye resolves every speck
individually.** A repeating tile of 1px dots therefore fails twice — each dot is a
discrete object to be counted, and the tile's period is findable, so the moment you
notice it repeat the whole thing collapses into a pattern. Light is low-frequency,
and low frequency is what survives being looked at.

So: nothing on that layer is an object. The shafts are 12–26vw wide (floored at
112px, since on a phone a vw-sized shaft narrows until it reads as a band with
edges), soft-edged by a **mask rather than a blur** — same softness, none of the
rasterisation cost — and they all lean the same way, because there is one sun and it
is up and to the left. They pivot from their own top edge, which is what a shaft does
when the surface above it moves.

**The periods are 17 / 23 / 29 / 37 / 43s, and the clouds are 96 / 137s** — all
near-primes, so no two are ever in phase and the group never visibly repeats. Every
one runs `alternate` rather than looping: a shaft that returns to its start position
each cycle has a seam, one that sways back does not. **The effect is the absence of a
period anyone can find.** If this ever needs extending, add another near-prime — do
not round the numbers.

The clouds do almost nothing per frame, which is their job: they keep the dark from
being a flat fill without ever becoming something to look at. Same principle as the
painting itself.

**Bioluminescent glimmers were tried here and cut** (*"亮晶晶好难看，还变卡了"*).
Six rare, soft, double-flashing blooms on near-prime periods — a good idea on paper
and, on the page, both an ornament and a cost. Two things to take from it:

- **An effect whose entire value is being barely noticed is the first thing to cut
  when it costs frames.** It cannot win that trade by definition.
- The cost was not the six small elements. It was that each one animated
  `transform` inside a full-viewport container stacked over a blurred image and three
  alpha layers, so every frame invalidated the whole stack. **On this page, anything
  that animates inside the stage has to be promotable and cheap, or it is not worth
  having.** The shafts and the clouds carry `will-change` for that reason, and the
  clouds translate without scaling — they are the two largest elements on the page,
  and a scale on a gradient that size is a re-raster the compositor cannot help with.

The 3D question that came with it has a standing answer: **no.** This page exists
*because* the WebGL canvas came off it (130 kB first load against `/descent`'s
425 kB), and 300 kB of R3F for ambient anything is that trade run backwards. The
house rule already covers it — real models for creatures, procedural for light and
atmosphere.

### The sky in the deep (2026-08-23)

*(the third attempt at putting something small on that layer, and the first Qi
asked for — the brief was the starfield in the `Here` project, "他那个就不俗气")*

Screen two now has **stars that twinkle and, rarely, one that falls**. Read it
against the section above rather than as a reversal of it: what was rejected
there was a repeating tile of motes, and what was rejected after that was six
glimmers that animated `transform`. Neither objection is to "small things." Both
are to *how* they were built.

So the two standing rules from that history are what this is built on, and they
are the ones to keep if it is ever touched:

- **No tile.** Every star is placed once, with its own size, its own trough and
  peak, its own 4.5–11s period and its own phase. There is no shared period for
  the eye to find, which is the only thing that ever made the motes read as a
  pattern.
- **Opacity only, and no render surfaces.** A star fades and does nothing else,
  so each is a 2px quad the compositor promotes for the length of its animation
  and drops after. Nothing on the layer is masked, filtered, or given
  `will-change`. **A soft mask over the middle was built and taken out**: a mask
  forces the whole viewport-sized subtree into one render surface and re-rasters
  it every frame — the exact cost the glimmers were removed for, bought back for
  a nicety.

With masking off the table, **the poem's space is kept clear by placement.** A
candidate position inside an ellipse on the middle of the frame (±30% of the
width, ±44% of the height) is rejected outright; just outside it, it is kept only
sometimes; past ~1.7× it is always kept. The field thins toward the verse instead
of stopping at an edge, and it costs one `Math.random()` per rejected candidate at
mount and nothing after. A star inside a letterform is not atmosphere, it is a
typo — and unlike a fall, it sits there being one for as long as the reader stays.

**The falls are the exception that crosses the verse.** One thin line, ~2.4–5.2s,
peaking around a third of white and blurred half a pixel, so it reads as
something passing *behind* the poem. That restraint is the whole difference
between this and 小儿科: a bright streak through handwriting reads as a scratch on
the print. They are also rare on purpose — one 8–18s after arriving so the screen
shows what it does, then 24–96s apart with a quarter of the gaps deliberately
long. **An effect you might miss is the one worth having seen.** They are armed
only while `atTwo`, and never under `prefers-reduced-motion`.

The layer is gated on `--s` like everything else on the stage, but later than the
water: nothing until ~42% down, full by ~95%. The light going is what you notice
first; the stars are what is there once it has gone. Under reduced motion the
global `animation: none` would freeze every star at its trough — a field of
near-invisible dots reading as dirt on the screen — so there is one extra rule
holding each at its own peak instead. A still sky, not a dead one.

Whether they are stars seen up through the surface or something alive at that
depth is left open, and should stay open. Both readings are the record.

### Snap, and the one thing that can trap a reader

`scroll-snap-type: y mandatory` is the whole feeling of "two pages". It is also the
one thing here that can strand someone: a section taller than the window has no snap
position at its own bottom, so the scroller keeps pulling back and the tail of the
poem becomes unreachable.

So it gives way — **on a measurement, not on a breakpoint.** The scroll effect sets
`data-tall` when the two screens measure more than two screens, and that switches
the snap to `proximity`. What makes screen two overflow is how many of the ten lines
had to turn, which depends on the width, the height, which font finished loading and
whether the player is up; no media query knows all four. (The effect re-runs on
`barOn` for exactly this reason — the player changes screen two's padding.)

### The hero's primary action

It said `LISTEN NOW`, which is what a released album says. This one is not released —
these are demos, and saying so is not a disclaimer, it is the offer: you are hearing
it before it exists. So the idle label is `HEAR THE DEMOS`.

The other half of that is that **once a track is loaded the button stops being "start
the album" and becomes the transport for whatever is sounding** — `PAUSE` / `RESUME`,
with the glyph and the `aria-label` following. A hero play button that restarts a
different track while music is already playing is a bug the size of the hero. The
label's letters are keyed by label as well as index so they re-enter on a change
rather than morphing in place, and the pause glyph drops the play triangle's optical
offset (`[data-glyph=pause]`), since two symmetric bars do not need one.

`TRACKLIST` goes to screen two. It spent the rebuild still calling
`setPanel('poem')` — a panel that no longer existed — so it opened nothing at all,
which is exactly what it looked like from outside. Worth remembering as the failure
mode when a route or a view is deleted: the *caller* compiles fine.

### The player is one player, for both screens

The bar is fixed to the window and mounts **only when something is sounding** —
there is no idle state to design any more, because the tracklist it used to carry
when idle is a screen now. Starting a demo from the poem and scrolling back to the
shore does not interrupt it and does not leave the transport behind on the other
screen. `✕` is the one control that stops.

It is a gradient scrim, not a solid bar. A solid one cut ~70px off the bottom of the
painting, which on this canvas is the sand and the near water.

**The poem is a screen; the mailing list is still a panel.** `TRACKLIST` and the
arrow both scroll to screen two; `PRE-SAVE` opens the signup over whatever you were
looking at, and Escape closes it. The split is not layout convenience — a form is
not a place: it has no content to be read, it is answered and dismissed, and it must
not cost the visitor their position on the way back out. The poem is the opposite of
all three, which is why it stopped being a dialog you open and dismiss.

### The ask

`PRE-SAVE` is the site's one conversion, and it spent the first pass set as an 11.5px
link in a corner — the same weight as a wordmark that does nothing. It is now the
only thing on either screen built like a button, and it lives in **one** place: the
nav, top right, on both screens, with the same rule and the same fill-on-hover as
`SIGN UP` in the panel it opens. The two are one action seen twice, and looking
alike is how anyone knows that. (The nav's own padding came down from 26px to 18px
to pay for the button's height — screen two needed those pixels.)

A second one at the end of the poem — a hairline, *Be there when it surfaces.*, the
button — was built and cut. It was the right argument (someone who has just read ten
lines is the likeliest person on the site to say yes) and the wrong screen: the poem
is the one place on this site that is allowed to end in nothing, and anything set
after `sea risen.` is answering it. **One ask, always visible, never inside the
work.**

### The down-mark, and what it replaced

The bottom of screen one used to name all ten tracks. That meant the album was over
before anyone had scrolled — so it is a mark now, which says there is more without
saying what, and the poem gets to arrive whole.

It is **two chevrons and nothing else**: no rail, no ring, no container, the least
furniture of the eight candidates it was chosen from. The pair is drawn identical and
separated only by *when* it is bright — the light runs from the upper to the lower and
starts again, so they point by **moving** rather than by being drawn pointing. Offset
by 0.42s of a 2.6s cycle rather than by half of it, so the two are never both bright
and never both dim; either of those reads as blinking, and one travelling mark is what
this is. The whole mark also bobs, because movement is what the eye finds without being
asked.

**Two rejected directions, kept because both were reasonable and both were wrong.**
The mark sits at the bottom of the frame, which on this painting is sea and foam — the
lightest, busiest part of it:

- **Hairlines.** Five of them, on the argument that this page is 1px rules everywhere.
  Invisible, twice. A rule that is *structure* and a rule you are *meant to notice* are
  not the same job — and the second cannot hold the tight dark halo that keeps every
  other white mark here legible, because 1px is too little glyph to seat a shadow
  under. That halo is most of why the hero's 12px labels never disappear on the same
  painting with the same shadow.
- **Ink.** Five in the painting's own dark, on the reasoning that white cannot win on
  a light ground. True as physics and wrong as design (*抢眼*): a dark mark is then the
  darkest thing in the lower half of a painting whose lower half is entirely light, so
  it stops being an invitation and becomes an object. White is the page's colour and
  should not be spent to buy visibility.

What won keeps the white and takes the weight — 3px strokes at 46px wide, where the
first version was 1px at 22 — and buys the rest with motion.

Two mechanics on it that are easy to break:

- **The halo has to hug the glyph.** A wide soft dark bloom behind the whole mark was
  tried and cut: at the radius that helped it was a patch of grey on an oil painting,
  and nothing else on the page has one. Spread a halo and it stops being light and
  starts being a shadow — the same lesson the poem's halo learned in the panel.
- **`animation-fill-mode: backwards`, not `both`.** The entrance holds its first frame
  through its delay and then lets go, leaving the scroll fade free to take the opacity
  back. With `both`, the animation would own `opacity` forever and the mark would ride
  all the way down to the poem. The same trap decides why the reveal on screen two ends
  at `var(--o)` rather than at 1 — see below.

### Screen two

*The title, and the poem.* Two different footers have been tried under it — a
`RELEASING · 12 · 20 · 2026 — PRE-SAVE` line, and a full call to action — and both
were cut. The screen keeps arriving back at the same shape, which is probably the
answer: it ends on `sea risen.` and nothing follows that.

**Everything on this screen has to clear one window** — a screen that overflows
trips the `data-tall` fallback out of mandatory snap. With the title and the poem
the only things on it that is not tight, but every size is in `vh` for it, and it
was tight the moment a footer went back on. If you add anything here, take the
height out of something else: the poem's size, then the title's margin, then the
section's padding, in that order of how little they hurt.

The panel's markup, unchanged, on a screen: the same fill, the same press-to-seek,
the same transport in the margin. None of it was ever about being in a dialog. What
is new around it:

- **The album title, in the poem's own hand** — Qi's call, twice now. A letterspaced
  eyebrow (*TEN SONGS THAT READ AS A POEM*) was tried in its place and cut as
  redundant. The risk the title carries is real and is managed by ranking, not by
  type: "The heart of the jellyfish." is also line 06, so title and line are nearly
  the same string in the same face. What holds them apart is that the title runs
  ~1.6× the line size, has ~90px of air under it, and is the only thing on the screen
  that is not a button. **If it ever starts reading as the poem's first line, that
  ratio is the knob — not the font.** It is also why the nav's wordmark is `QI · 琦`
  and not the album: the same words twice on one screen is what that corner exists to
  avoid.
- The Chinese title set vertically in the right margin, the way it would run on a
  spine. Its rule is an inline-block inside vertical text, so its size is given
  logically — in `vertical-rl` the inline axis runs *down* the page, so `inline-size`
  is the length of the line and `block-size` is its thickness. Gone below 900px,
  where there is no margin to hang anything in.
- **The numbers appear on hover, not at rest, and all ten at once** — Qi's call
  twice over, and right both times. Printed, they make the screen a tracklist when
  it wants to be a poem first; revealed one at a time, they ask the reader to
  discover ten separate times that these lines are also tracks. **The numbering is
  not a property of the line you happen to be over.** So a cursor anywhere in the
  poem brings all ten up together and leaving takes all ten away — hung off
  `.l-poem-body:hover` rather than `:has(.l-poem-line:hover)`, so they do not
  flicker as the cursor crosses the gap between stanzas, and with the body's box
  reaching left over the number gutter (padding plus an equal negative margin, so
  nothing moves) because the numbers hang *outside* the text column and would
  otherwise turn themselves off. `.42`, not the `.5` a single number used to get:
  ten at once is far more ink than one. `:focus-within` gives a keyboard the same
  answer, and `@media (hover:none)` keeps them on for touch, where there is no
  reaching and the poem would otherwise hide that it is playable.
- **Nothing on this screen moves.** Line VI once carried a 60bpm bloom on its halo,
  on the argument that the album is named after it and the hero's "Heart" already
  swells once a second. Cut: the hero's beat is one word inside a display setting,
  where a pulse is a texture. Ten lines of verse are a thing being *read*, and a
  line that moves while you read it is a line asking to be watched instead. Same
  reason the numbers went back to hover — screen two is a poem first.

The reveal (`l-in`) staggers the lines in as you land. Two things keep it honest:
it lives inside `@media (prefers-reduced-motion: no-preference)`, because the base
`opacity: 0` must not exist for a reader whose global `animation: none` would then
leave them a blank screen; and it ends at `opacity: var(--o, 1)`, because three of
the elements it animates are deliberately *not* opaque and a fill-mode animation
ending at 1 would silently overrule them forever. Each row is a wrapper that exists
only to be animated, for the same reason — the line's own opacity means "no demo
yet" / "sounding", and an animation on the button would freeze all of it.

### The painting

`public/images/hero.webp`, from the PNG master in `artwork/`. It is **1672×941**, which
is the current weak point: on a 1440-wide retina screen the browser paints it at 2880
device pixels, a 1.7× upscale, and it reads soft. Quality isn't the lever — it's encoded
at q92 — resolution is. A replacement wants to be ~3840×2160 for the same crop.

#### The painter's credit is the man in the painting (2026-08-23)

The painting is **Sho Peng**'s (pengsho.com), and the figure standing on the
shore is a link to him. Nothing shows at rest. Hover or focus him and a light
comes up behind his outline while *PAINTING / SHO PENG ↗* fades in on the sky in
front of his face; clicking opens the artist's site in a new tab. On touch,
where there is no hover to find it with, the caption is simply on at .6 — the
same answer the poem's track numbers give, for the same reason.

**The credit is attached to him, not to the page.** That is the whole design
argument: this site has no footer and should not grow one, and a credit badge
laid over an oil painting is the thing screen one has now refused four separate
times. It also means the credit is only there when *he* is — below 13/10 the
crop follows the jellyfish and he is off the right-hand edge, and the layer
leaves the document entirely. There is currently **no credit at all on portrait
screens**; that is a known, deliberate gap, not an oversight.

#### The box that makes it free

`.l-art` reproduces, in CSS, the rectangle `object-fit: cover` paints `.l-bg`
into:

```
width  = max(100cqw, 100cqh × 1.77683)      // cover = the larger of the two scales
left   = (100cqw − width) × var(--bg-px)    // object-position places the overflow
```

Once that box **is** the painting's rectangle, an `<svg viewBox="0 0 1672 941">`
inside it makes every coordinate in it a *painting pixel* — so the traced
outline lands on him at every window size with nothing measured, no resize
listener, and no second copy of the crop rules to drift out of sync. This is why
`--bg-pos` was split into `--bg-px` / `--bg-py` as bare fractions: two things
now need those numbers, and one number they could disagree about is one too
many. `.l-art-plane` exists only to carry `.l-bg`'s parallax transform (same
transform, same origin — change one and you change both) and to be the query
container the box above measures against.

#### Three things that were wrong first, and are load-bearing now

- **It cannot live in `.l-stage`.** `.l-scroll` is fixed over the whole window
  at z-index 10 to catch the wheel, so anything inside the stage is unhoverable
  by construction — and nothing inside the stage can climb over it either, since
  the stage is its own stacking context at z-index 0. The layer is a sibling of
  the scroller at z-index 12. That is only safe because the one thing in it that
  takes a pointer is the path, and no control on this page stands where he does.
- **The glow is masked to the outside of him.** A blurred stroke straddles the
  edge, and the inside half is paint on the painting: it flattened his hair into
  a white smear and the whole figure read as a sticker cut out and laid back
  down. Masked to the outside it is a backlight instead. SVG applies the filter
  before the mask, so what gets cut is the blurred result, not the stroke.
- **Two strokes, because half of him stands on sand.** A wide soft light reads
  against the sky and does nothing at all against a ground nearly as bright as
  the light, so the legs and feet would not answer at all. A narrow rim
  (`.l-art-rim`) carries enough density per pixel to show on either. One
  falloff, not two effects.

`opacity` alone does not un-link a link: at `--s` 1 the anchor was invisible and
still catching clicks over the poem. It fades out by s = .294 and
`.landing[data-two]` then hides it with `visibility`, which is the one property
that takes it out of the paint, the tab order and the a11y tree together. Those
two numbers are paired — move one and move the other.

**The outline** is 120 points, ~1 kB, traced off `hero.webp` itself by
[scripts/trace-figure.py](scripts/trace-figure.py) — colour segmentation the
painting happens to make easy (sky is the only thing here with more blue than
red; sand the only thing both warm and not skin, *and only below the horizon* —
applied to the whole frame that rule also ate the shadow under his brow), then a
Moore-neighbour boundary walk and Douglas-Peucker. A cut-out PNG would have cost
~25× that and bought a mask with no hit area. **Replacing the painting makes the
path silently wrong** — it will still draw and still take clicks, just not on
anybody. Re-run the script.

One breath of the glow fires five seconds after arrival and never again, because
nothing else on the page says he is a link and nothing should. `backwards`, not
`both`: with `both` the animation owns `opacity` forever after it ends and the
hover transition is silently outranked — the same trap as the down-mark's
entrance.

### One layer, cover everywhere — only the crop moves

```
wide  (≥13:10)   object-position: center 45%
mid   (<13:10)   object-position: 12% 45%
tall  (<1:1)     object-position: 17% 42%
```

There used to be a second, blurred copy underneath, letterboxing the whole painting
on narrow screens so neither subject was cropped. It went, and the reason is worth
keeping: at the blur radius that stopped the backdrop competing, the oil texture was
gone and it read as flat colour — which for a painting-led page is the one thing the
background must never be. **Texture everywhere beats composition intact.**

Cropping a 16:9 painting into a portrait window shows about a quarter of its width,
and the two subjects sit at opposite extremes — jellyfish far left, figure far right
— so only one survives. Follow the jellyfish: it is the album's title and it reads at
any size, and the shore break behind it gives the crop somewhere to go.

The mid tier is 12% rather than 22% because at 22 the right edge landed *on* the
figure's head and clipped a corner of it, which reads as a smudge rather than as a
person. Leaving him out entirely is better than showing a piece of him. If the crop
ever needs retuning, that is the failure mode to watch for.

### The poem is canon

The ten titles read as one poem, and the punctuation is the poem:

```
Sea rising / in memory of those who chose the sea— / a dream so real... /
Wait—why is the dream so real? / Wake up! / The heart of the jellyfish. /
You shall see: / what belongs to the sea \n will always return to the sea. /
The day after, without us— / sea risen.
```

Lower-case openings and trailing marks are deliberate — they're what makes the tracklist
run on as verse. Don't "fix" them. `POEM` holds these; the `\n` in track 08 is the line
break the poem itself takes, which the strip flattens back to one line. `TITLES` is a
separate array of title-case names for the player and for `aria-label`s — player metadata,
not the work. `POEM_LINES` stores each line as its **sense units** — the caesuras Qi
would read aloud — because a phone cannot fit the long ones and the browser's own
break is nonsense: a turned line looks exactly like the next track, so a bad break
does not merely read badly, it invents a line of verse the album does not have.

### The seek bar is a real waveform

`public/waveforms.json` holds 400 normalised peaks per track, ~14 kB for all ten,
generated by [scripts/waveform.mjs](scripts/waveform.mjs):

```sh
npm run waveform     # after adding or replacing any mp3
```

It is precomputed because the alternative is decoding a 4 MB mp3 in the browser to
draw a 26px graphic. The JSON is fetched on the first play, not on load, and if the
fetch fails the bar silently falls back to the old hairline — no peaks is not an error.

Rendering is one SVG with two identical sets of 160 bars, one dim and one lit and
clipped to the play head. Only the clip rect's width changes as playback advances, so
the bars are memoised and never rebuilt. Peaks are normalised per track rather than
across the album: this is a seek affordance, not a mastering reference, and a quiet
song should still show a shape.

The bar looks 2px tall but its hit area is the full 26px, and it seeks on click, drag,
and arrow keys (Shift for 30s).

### The sounding line is the other seek bar

*(added 2026-08-22)*

In the poem panel the line that is playing fills left to right in step with the
track. Since 2026-08-22 it is also **pressed to seek** — press anywhere along the
words to land there, drag to sweep, and a hairline with a `m:ss` clock follows the
pointer to say where you would land. It began in the poem panel, where the panel
covered the bottom bar and there was otherwise no way to move through a track while
reading; it came across to screen two unchanged.

What makes it honest is **which box** it measures. The row is a fixed column width
— the longest line sets it — so a fill measured on the row finishes `Wake up!`
(69px of ink) at 17% of the track and then sits dead for three minutes. Both the
fill and the seek now read off `.l-poem-ink`, an inline-block that hugs its own
text, so every line ends its fill on its last glyph exactly as the track ends. The
price is that a short line is a coarse bar — seconds per pixel. That is the right
trade: the waveform downstairs is the precise instrument, this is the one you can
read. **If the fill and the pointer ever stop sharing a box, this breaks silently
— it will still seek, just not where you pressed.**

The number in the margin took over the transport, because press-to-seek eats the
click. As first shipped that was a 10×17px pair of digits reading as metadata —
a control nobody could find or hit — so it now grows an invisible ~30px hit box
(a `::before`, not padding, which would shove a glyph positioned off its right
edge) that reaches left into the empty margin and stops short of the first
letter, since a press at the start of the line has to stay a seek to zero. And
the digits cross-fade to `❚❚` / `▶` while the line is hovered, always on touch.
Its breath also holds while paused. Keyboard: the line is
`role="slider"`, arrows move 5s (Shift 30s), Home rewinds, Space holds. On touch
`touch-action:pan-y` keeps a vertical swipe scrolling the panel, and the hairline
stays hidden — a preview stranded at the last tap is worse than none.

### The poem's type

`POEM_FONTS` holds the candidate faces, each setting CSS variables rather than a
font-family alone — the scripts have much smaller x-heights than Cormorant and need
their own size and leading. La Belle Aurore is the current default, with Cormorant
italic the runner-up. Caveat and Petit Formal Script were tried and rejected: the
first reads as a marker note, the second as a wedding invitation.

Settled on **Nothing You Could Do**; Cormorant italic stays loaded as the runner-up
and for the rest of the page. Rejected along the way: Caveat (reads as a marker note),
Petit Formal Script (a wedding invitation), La Belle Aurore, Shadows Into Light Two,
The Girl Next Door, Sacramento.

The poem is titled in its own hand, at Qi's call — and the risk that accepts is
real: "The heart of the jellyfish." is also line 06, so title and line
were nearly the same string in the same face, held apart only by a size ratio. The
two-screen rebuild moved it onto screen two's head, where it still is — see *Screen
two* above for the ratio that keeps the two apart, and for why the nav corner gives
the album name up to it.

**`/?tune=1` opens a live tuner** (top right): vignette strength and spread, poem face
and size. Dev affordance, renders for nobody else. `?type=1` still works.

### The countdown and the vignette

The line above it states the release — `NEW ALBUM OUT DEC 20` — rather than leaving
the reader to work out what is being counted down to; the row beneath is then free
to be only *how long that is from now*. It is built from `releaseDate` by a
three-line month lookup rather than `toLocaleDateString`, because the page is
statically prerendered and the server's ICU data and the browser's have to produce
the identical string or React throws hydration away.

The meta line counts down in days / hours / minutes / seconds, live. It is its own
component with its own interval so the rest of the page — the waveform above all —
is not reconciled once a second. The page is statically prerendered, so the HTML
carries a build-time number and the client disagrees on first render; that is what
`suppressHydrationWarning` is for.

**Each unit's node is keyed by its own value.** That is what makes the tick animation
per-unit: React replaces the seconds node every second and the days node once a day,
so `l-tick` fires on exactly the number that changed and the others never flicker.
Figures are tabular (`font-variant-numeric`), or the row twitches sideways whenever a
digit changes width. The global `prefers-reduced-motion` rule kills the animation
without touching the count.

The vignette is a radial-gradient overlay at `z-index:1` — above the painting, below
every piece of type. Two knobs, both CSS variables so the tuner drives them live:
`--vig-strength` (corner darkness) and `--vig-inner` (where the ramp begins, as a
percentage of the radius). Settled at 0.5 / 0.

**It has six stops on an ease-in curve, not two, and that is the whole point.** A
straight transparent-to-dark ramp is linear in alpha, and the eye reads the kink
where the ramp begins as a hard elliptical ring — which is exactly what the first
version looked like. Weighting the early stops far below linear (.04 and .14 where
linear would be .30 and .52) hides the onset: at 44% of the radius alpha is 0.02, at
62% it is 0.07, and the darkness lands where it belongs, in the last fifth.

### How the title sits in the surface

`.l-title` carries `data-lift` (in / out) and `data-inset` (three styles), and
three CSS vars scale them. Pick at `/?tune=1`, then set `LIFT` / `INSET` /
`INSET_DEPTH` / `INSET_SHARP` / `INSET_WHITE`.

**In versus out costs exactly one sign.** The light is overhead in both cases, so
the only thing separating a groove from a ridge is which of its two walls faces
it — and every wall, in all three styles, is placed by a y offset. `--dir`
multiplies all of them; flip it and the shadowed wall moves from the top of each
letter to the bottom while the lit wall moves the other way. No second filter, no
swapped colours. The one thing `--dir` must *not* touch is the cast shadow
underneath: the sun did not move. A ridge does throw a longer shadow than a dent,
which is what `--cast` is for.

Qi rejected nine noise textures inside the letters and asked instead for the
letterpress edge to be *stronger*. Two things were wrong with what he was looking
at, and only one of them was strength:

- The edge was **1px on a 120px letter** — under eight thousandths of the cap
  height. Whatever it was doing, it was doing invisibly.
- **`text-shadow` always paints behind the glyph.** An offset upward can only put
  a dark line *above* the letter, never inside it, so it reads as a shadow cast by
  something floating — the opposite of inset. A groove is shaded on its inner
  walls: dark along the top wall, which faces away from the light, bright along
  the bottom, which faces into it. Reverse that pair and the letters pop out of
  the surface instead of into it.

**Three knobs, not one, because the qualities pull against each other.** Qi's
follow-up was "嵌进去的感觉,但我又想要锐利,够白" — carved *and* crisp *and*
white. `DEPTH` is how far the shading reaches in; `SHARP` is how hard its edge
is; `WHITE` is how much of the letter face stays pure white, by taking the dark
band's opacity down.

The greyness is `SHARP` and `WHITE` together, and `DEPTH` is not the culprit. The
dark band is merged *over* the glyph, so the more it is blurred the further it
spreads across the face and the more the whole letter dims. Sharpen it and it
collapses back to a line along the top wall, leaving the rest of the face
untouched — crisper and whiter from the same move. Worth remembering the next
time an inset looks muddy: reach for the blur before the offset.

**Four styles, and they divide along one line: inside the glyph or outside it.**
A real groove has four surfaces, and going down a letter from above they are —
the lip where the flat surface bends down into the cut (outside, shadowed), the
far wall (inside, shadowed), the floor, which is the letter face itself, the near
wall (inside, lit), and the lip bending back out (outside, lit).

`edge` and `groove` draw only the outer pair, because text-shadow paints *behind*
the glyph and can never reach an inner wall. `carve` draws only the inner pair.
`cut` runs both, and is the only one of the four that describes an actual groove
rather than half of one — it is the same SVG filter as `carve` with its lip
primitives switched on, which is why `CarveFilter` takes a `lip` prop and is
rendered twice into `.l-defs`.

CSS has no inner shadow for text, so the construction behind every band is worth
knowing:

> Compositing a shape `operator="out"` against a **shifted, blurred copy of
> itself** leaves only the sliver one of them failed to cover. Which sliver
> depends on which way round the two operands go:
>
> - `SourceAlpha out shifted-copy` → a band **inside** the glyph, hugging one edge
> - `shifted-copy out SourceAlpha` → a band **outside** it, lying alongside
>
> Shift the copy down and the band lands along the top of every letter; shift it
> up and it lands along the bottom. `feFlood` each band with a colour, then
> `feMerge` them back — lips behind `SourceGraphic`, walls in front of it.

**Everything scales with the type, and this is the part that bit.** A rim only
reads as an edge *relative to the stroke it sits on*, and Cormorant italic's
hairlines at 106px are only ~4px wide. The first carve used absolute px offsets
(`dy = 2.4 × depth` = 5.3px) — wider than the hairlines, so the shadow swallowed
whole strokes and the title went grey and muddy. The CSS rims are therefore in
`em`, and the filter — whose `dy` and `stdDeviation` are SVG *attributes* and so
can read neither `em` nor `var()` — takes a measured `titlePx` from a
ResizeObserver on the h1 and multiplies. Verified proportional: `dy/fontSize` is
0.0242 at both 119.6px and 48.3px.

The `.l-defs` SVG holding the filter must be in the document but never seen:
zero-size and `overflow:hidden`, **not** `display:none`, which stops the filter
resolving in some engines.

One consequence of the padding on `.l-title` (see below) is that the filter
region is measured from a box that already contains the ink.

### The beat on "Heart"

The word pulses once a second, in step with the countdown's seconds digit. It is
the depth slider being pulled up and let go: a dark rim swells out above the word
and softens as it grows, the lit rim swells below it, and both decay back over the
rest of the second. Fast attack, slow release — two-tenths in and eight-tenths out
reads as a beat, where a symmetric swell reads as breathing. That asymmetry does
more work than the amplitude does.

**`--amp` scales all of it** — every length and every alpha in the keyframes — so
the beat retunes from `/?tune=1` without changing shape. It exists because the
first version was too loud: Qi scored it 6/10 and asked for subtler, then picked
this mechanic out of six offered (the others were a double thump, a swinging
light, a dark pressure wave, a pale one, and a band travelling through the fill —
none shipped). 0.55 is a little over half the original, and the gap is deliberate
rather than drift; he checked it against production before confirming. At 119px
the peak at 110ms is the dark rim at −2.23px offset / 3.61px blur / .34 alpha,
against the first version's −4.05 / 6.56 / .62.

**One timer, not two.** The clock used to live inside `Countdown`; it now lives in
`Landing` and is passed down. The beat span is keyed on that same `secs`, so React
remounts it on the tick and the CSS animation restarts from 0%. Two intervals
started a few milliseconds apart would visibly separate inside a minute; sharing
the state makes them simultaneous by construction, with nothing to keep in sync.

**Why the relief moved off the h1 and onto per-word spans.** Any shadow painted by
a descendant of a filtered element is fed back into that filter's `SourceAlpha`.
Had the beat stayed inside the h1's filter, the carve would have been computed
from the glyph *plus its own swelling halo* and smeared once a second. So each
word now carries its own `.l-t` with the relief, and the beat is a `drop-shadow`
on a wrapper *outside* that — which is also the right reading: the swell is the
cut deepening, not the letter changing.

Nothing about the relief itself changed — the construction reads the alpha of
whatever glyphs it is handed, and the spans do not overlap. It also has more room
than before: an inline span's box is the font's content area (144px at a 119px
font) and fully contains the ink, where the h1's `line-height:1.04` box did not.

### The title's box is smaller than its ink

At `line-height:1.04` the h1's box cuts through the glyphs — measured 9px of
overshoot at the bottom and 9.5px at the top at a 106px font. Anything that
paints from the box rather than from the outline then clips the letters. This
first showed up as the descender of "Jellyfish" disappearing completely under
`background-clip:text`, which reads as the font being cropped and is actually the
background stopping.

Fix is `padding:.2em 0` with `margin:-.2em 0` to cancel it. The negative margins
do **not** collapse: `.l-hero` is a flex column, so the h1's `-.2em` bottom margin
*adds* to the countdown's `margin-top`. That is the intent — outer edges land
exactly where they did before the padding existed — but it means the two numbers
are coupled. Any future change to `line-height`, or a face with deeper
descenders, has to keep the padding ahead of the ink.

### Three traps worth remembering

**Specificity.** `.landing button{font:inherit}` normalises the UA button font at
(0,1,1), which beats any bare `.l-foo` class — so every button rule that sets a font
must be `.landing .l-foo`. That prefixing then bites back inside media queries: a
`@media` block containing a bare `.l-foo` loses to a base `.landing .l-foo` no
matter that it comes later, because specificity outranks source order. Both bugs looked identical from outside: a rule that reads correctly and
computes to something else. **If a base rule is `.landing`-qualified, its media
query override has to be too.**

**Hydration.** The page is statically prerendered, so anything derived from the
clock is baked at build time and wrong on arrival. React does not merely warn about
mismatched text — it discards hydration and re-renders the tree. `suppressHydration
Warning` does not save you either: it covers an element's own text, not its
descendants, and the countdown's digits are three levels down. The fix is to render
the *same placeholder on both passes* and fill in from `useEffect` — remove the
mismatch rather than silence it.

**Emoji-by-default characters.** A handful of otherwise ordinary symbols — U+25B6 `▶`
among them — carry *emoji presentation by default* in Unicode, so iOS and Android
substitute the colour emoji font for them. The glyph then ignores `color`, and a
transport button that is pure white on every desktop arrives on a phone as a
grey-blue cartoon triangle. It never shows up in a desktop preview, and Chrome on
macOS renders it as text, so nothing local catches it. **Draw UI glyphs, don't type
them.** The play/pause marks live as `--glyph-play` / `--glyph-pause` on `.landing`
(inline SVG data URIs), used as an SVG element in the bar and as a `mask` over a
`var(--lit)` fill in the poem margin — one shape, one colour, no font in the path.
Text glyphs are only safe when the codepoint has *text* presentation by default,
which `✕`, `←` and U+275A do.

### Demo audio

`public/audio/NN-<slug>.mp3` — **all ten**, from the 2026-08-21 bounces. Transcoded to
128 kbps CBR 44.1 kHz stereo with metadata stripped (`ffmpeg -b:a 128k -map_metadata -1`),
which took the set from 63 MB to 45 MB; the sources were a mix of 160 and 320 kbps.
Durations were checked against the originals afterwards — transcoding is where a track
quietly loses its tail. Masters are not in this repo.

Track 04 is a rough mix ("Rough with Woodwinds"), not a production bounce like the other
nine. Swap it when a production version exists.

`AVAILABLE_DEMOS` lists which tracks are playable. It's all ten now, but it stays a list
rather than an assumption: removing a number dims that line in the poem panel, labels the
bar `demo 待上传`, and makes LISTEN NOW skip past it.

**A correction worth keeping.** An earlier pass rescued seven demos off the Squarespace
CDN and matched three of them to tracks by position, because that page listed titles in
the body and URLs in a head JSON blob. Two of those three were wrong — `seagull bar with
vocal` and `OurOwnStar_Oct30` are not album tracks at all, and had been sitting on 02 and
06. Positional inference across two independent orderings is not evidence; it looked like
evidence because four filenames carried their own track numbers and corroborated. If a
mapping can't be read off the file itself, get it from Qi.

### What was removed, and why

The front page used to be a WebGL treatment ported from a Claude Design file — the whole
ocean, jellyfish included, drawn analytically in one fragment shader and revealed by
scrolling. Once the painting went full-bleed and the scroll went away, that canvas sat
permanently behind an opaque image, drawing frames nobody could see. Deleting it took the
route from 112 kB to 108 kB First Load JS — a small number, because 102 kB of that is the
React/Next runtime; the page's own code halved, 9.5 kB to 5.7 kB. Deleted (`Medusa.tsx`,
`medusaShader.ts` — both recoverable from git). The 3D telling of the same arc is alive
at `/descent`.

**Still not done:** the signup is local-only (`setSent(true)`); it posts nowhere. And
`PRE-SAVE` opens that signup rather than a DSP pre-save, because there isn't one yet.

## Adding a 3D prop (recipe for new sessions)

This is the path the user will repeatedly walk. **Follow it.**

1. **Place the GLB — and compress it first.** Put assets at `public/models/<name>/model.glb`. Existing examples: `chrysaora/` (5MB, external JPG textures), `wreck/` (2MB, Draco + WebP). Photogrammetry models (like the wreck) often bake bright lighting into the albedo — expect to multiply `mat.color` by 0.4–0.6 and bump `mat.roughness` in a `scene.traverse` after `useGLTF`.

   **Always compress Sketchfab-style GLBs before committing.** Raw downloads bundle PNG textures at 4k/8k inside the GLB (the wreck was 37MB raw → 2MB compressed, 18× reduction). Pipeline:
   ```sh
   npx --yes @gltf-transform/cli@latest dedup in.glb out.glb && \
   npx --yes @gltf-transform/cli@latest weld out.glb out.glb && \
   npx --yes @gltf-transform/cli@latest webp out.glb out.glb --slots baseColor && \
   npx --yes @gltf-transform/cli@latest resize out.glb out.glb --width 2048 --height 2048 && \
   npx --yes @gltf-transform/cli@latest draco out.glb out.glb
   ```
   Don't use `gltf-transform optimize` — its default `simplify`/`prune` strips NORMAL attributes, producing flat-shaded geometry. drei's `useGLTF` auto-fetches the Draco decoder from a CDN at first use (no code change needed).

2. **Decide the depth window.** Each prop has a reveal range on `depthRef`. Pick where it should appear in the descent (use the table above). Pass `depthRef` into the component and read it in `useFrame`.

3. **Gate large assets.** Anything > ~5MB should NOT use `useGLTF.preload` at module top. Instead, write a `<XxxGate>` wrapper that flips a `useState` only once `depthRef` crosses the reveal threshold — see `WreckGate` in OceanScene. This keeps first paint fast.

4. **Mount inside `SunsetScene`.** Add the component alongside `<ChrysaoraHero />` / `<WreckGate />` near the bottom of `SunsetScene`. Wrap GLB-loading components in `<Suspense fallback={null}>`.

5. **Match the fog/atmosphere.** Set `mat.fog = true` on every material so the prop dissolves into the depth palette. Underwater props should have `transparent: false` unless they really need alpha — fog handles the falloff.

6. **Credit the source.** If the asset has any attribution requirement, add a line to [CREDITS.md](CREDITS.md). Don't ship without it for CC-BY assets — it's legally required.

7. **Verify in the browser, don't just claim it works.** A preview server typically runs during sessions. Use it. For something at depth d=X, navigate to `/descent?focus=heart` or scroll programmatically, screenshot, and confirm the prop actually renders (camera framing, fog, lighting all read right).

## Asset budget

- First paint: keep `<5MB` of model data preloaded (currently: chrysaora ~1.6MB).
- Gated assets: target `<50MB` each; texture-resize before going higher.
- Texture rule of thumb: 1k for distant/abyss props, 4k for hero/close props, never 8k on the web.

## Don't

- **Don't touch `.next/` while the dev server is running.** `next dev` and `next build`
  share that directory, so either `npm run build` or `rm -rf .next` during a session
  yanks the running server's chunks out from under it and every request 500s with
  `Cannot find module './500.js'`. Nothing is wrong with the code; the fix is always
  stop the server, clear the directory, start it again. There is no CLI escape hatch:
  `--distDir` is a next.config option, not a `next build` flag. Stop the preview.
- Don't introduce a state library — the `depthRef` pattern is intentional and stays.
- Don't `useGLTF.preload` heavy assets at module scope (breaks first-paint budget).
- Don't add a prop without picking its depth window — "always visible" props clutter the descent.
- Don't ship without verifying in the browser preview.
- Don't pair `<Bloom>` with any `MeshPhysicalMaterial` that has `transmission > 0` (the jelly bell). The transmission backdrop produces NaN/Inf at animated mesh edges, and **no `luminanceThreshold` filters them out** — NaN comparisons always fail. The visible symptom is flashing black squares over the hero. If glow is wanted later, use the `<Selection>` + `<Select>` + `selectionLayer` pattern so only specific non-transmissive meshes feed the bloom input.
- Don't set `transparent: true` on a material that already uses `transmission`. Transmission handles its own alpha through a separate pass; doubling up with `transparent + DoubleSide` causes depth-sort flicker on animated skinned meshes.
