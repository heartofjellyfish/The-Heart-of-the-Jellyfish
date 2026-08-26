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
- `/` — the three-screen front page (see below); shares no code with the above

## The front page (`/`) — three screens, one descent

*(rebuilt from one screen to two on 2026-08-22; the floor was added 2026-08-23)*

`/` is three screens: the shore, the tracklist under water, and the floor where
visitors' messages drift. The
document itself never scrolls — `html, body { overflow: hidden }`, the root is
`position: fixed`, and inside it **one fixed scroller** (`.l-scroll`) holds all
three screens. Everything that must hold still while the type moves — the painting, the
nav, the player — is a sibling of that scroller, fixed to the window.

[components/Landing.tsx](components/Landing.tsx) is the whole thing — markup plus a
`LANDING_CSS` string at the bottom. Layers, back to front: the stage (painting,
scrim, vignette, and the four water layers over them), the scroller with its three
screens, the nav, the player, and the panel.

### The descent is one number

`--s` is the scroll position over one screen height, clamped to 0..1: **0 on the
shore, 1 in the water.** Screen three has its own **`--s3`**, on the same scale,
one screen lower. It is a second variable rather than stretching `--s` to 0..2
because `--s` describes a descent that is *finished* once the poem is on screen
— rescaling it would have silently retuned every layer that reads it. It is written straight to `.landing` as a custom property
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

**The deep field (2026-08-23).** A second population of ~150 smaller,
fainter, quicker stars whose trough AND peak are both multiplied by
`--sbloom`, which the star channel of DeepLight's surge writes on the root
(at ~6Hz, not per frame — the envelope moves over seconds and every write
restyles a couple of hundred elements). At rest `--sbloom` is 0 and none of
them exist; in a surge the sky gains a hundred and fifty stars it did not
have, and loses them again — density as spectacle, the one axis the light
alone cannot reach (Qi's call: 疏密明亮也可以造成奇观). Placed by the same
`starOdds`, animated by the same keyframes, opacity-only like everything on
this layer. Under reduced motion DeepLight's loop never runs, `--sbloom`
stays 0, and the deep field simply never exists — the still sky stays the
resting 96. Leaving the screen mid-surge resets the var so the bloom is
never stranded half-lit.

### The light in the deep (2026-08-23)

Screen two also carries **a slow field of deep-water light** — nebulous,
never twice the same, passing behind the verse. It is the one thing on the
stage that is *drawn* rather than declared: a hand-written WebGL fragment
shader (`DeepLight` / `.l-lumen` in Landing.tsx), domain-warped fbm, ~4 kB of
code and no library. The brief was light that is 迷离、随机、不可捉摸 —
continuous structure with no edges and no findable period — and that is the
one thing layered CSS gradients cannot do: a gradient is a shape, and a shape
that moves is an object. This does not reopen the standing "no" to 3D here;
that no was to 300 kB of R3F, and the house rule has always allowed
procedural for light and atmosphere.

The field alone read as mist, not light — Qi's first note, and he was right.
What makes it *light* is **the rays**: beams from one sun up and to the left
(the same sun the CSS shafts lean toward), built from two angular noises
drifting at different speeds, so beams wander, brighten where the two align,
and die where they don't. No beam has an edge, a width, or a schedule —
which is what the CSS shafts, swaying on fixed periods, could never do.
**The CSS `.l-rays` now hand off to this layer** over the same `--s` window
the canvas arrives in, dropping to four tenths at depth: they are the light
of the crossing, and five fixed columns standing among moving beams would
read as scenery.

Two corrections that took a round each, both worth keeping:

- **The sun is in the middle distance (~2.7 screens up), and the middle is
  the point — it took a round in each ditch to find.** Near (1.4) its apex
  sat on the screen and the fan read as a cone with a fixed angle — Qi's
  second note. Pushed far (7.5) the beams went parallel and Qi preferred
  the cone: parallel light had lost the one thing that made the picture
  read as HOLY, convergence toward a point. Crepuscular rays — the light
  sacred painting reaches for — converge visibly toward a sun that is
  emphatically not in frame. Middle distance keeps the fan and keeps the
  apex out of the picture.
- **The angular frequency is what makes a beam a beam, and it must scale
  with the sun's distance.** Lateral feature size is `dst / freq`: the same
  freq that drew beams under a near sun drew *clouds* under a far one.
  Beams are long and thin (lateral ≈ 4% of the frame, along-beam ≈ most of
  it); clouds never are. The bend on `ang` is in radians, so at dst 7.5
  every 0.001 of amplitude is most of a hundredth of the frame of arm —
  small numbers, big arms.
- **The light needs a source, and the source is a surface.** Qi answered the
  fourth round with three reference images — sea surface from below, an
  ocean-projector lamp on a ceiling, a cathedral shot down a fish tunnel —
  and their common term was the thing ours lacked: a rippling, luminous
  ceiling the beams visibly hang from. Beams from nowhere read as an
  effect; beams from a surface read as light. It is ridged noise (the fold
  where fbm crosses its middle — the water-light network every projector
  lamp throws), riding the top quarter of the frame, brightest toward the
  same off-frame sun the beams converge on, and the fastest-moving thing on
  the layer: the surface is where water shows its speed.
- **Nothing about the curtain may be even** — Qi's third note ("太均匀了"),
  and the tell was three uniformities at once: every beam the same
  brightness, the same coverage across the width, and dying on one hem
  line. Two angular-only noises fix all three: a *clump* term gathers the
  beams into a few bright reaches of the width and leaves the rest nearly
  dark, and a *hem* term lets every shaft die at its own depth. Both are
  constant along a beam and drift slower than the beams, so the bright
  reaches migrate over a surge. Even is what reads as painted.

**The surge is the drama Qi asked for** ("时暗时亮，暗的时候占大部分，
亮的时候像奇观一样神圣"). Dark is the resting state — gain wanders around a
third — and every 26–130s (a third of the gaps long, never owed) the whole
picture opens for 14–26s: gain climbs past 1.5, beams widen, reach deeper,
and warm half a step toward white. Attack-hold-release (28% / hold / from
62%), not a sine: a swell that arrives, stays, and leaves is an event, an
oscillation is weather. The scheduler lives in the effect's closure on
purpose — every arrival at the poem re-arms an early first surge (6–14s), so
the screen shows what it does to whoever has just come down.

**The sun itself wanders** — sideways across the top and nearer/farther in
depth, on two pairs of incommensurate periods, phases off the seed. A fixed
sun was the last stiffness left: every beam could move and the LIGHT still
stood still. The surface hot-spot follows it (distances are computed
relative to the sun's height, not as fixed numbers — the first version
hard-coded them and the patch would have detached from the sun).

**Every channel chases its target through an asymmetric follower** — quick
up, slow down, each with its own release constant. The beams leave crisply
(2.6s), the surface close behind, the stars take their time (7s), and the
blue veil drags an ~11s tail: the ghost is still in the dark long after the
light that raised it has gone (Qi: 蓝色幽灵可以 linger 更久). The light
leaving crisply is what makes the staying read — soften the beam release
and the whole contrast dies.

**Four channels, four throttles** (Qi: 错落有致，随机一点). One shared gain
made the blue veil, the whitish hearts, the beams and the lit surface
arrive and leave as one thing, which no sea has ever done. Each channel now
has its own dark-state wander (own incommensurate periods — even the dark
is out of step with itself), and each surge deals every channel its own
share and its own entrance delay, re-rolled per surge: some surges are all
phantom and no beam, in some the surface lights first and the shafts
follow, and who leads is never the same twice.

**The crossing is sacred: this layer does NOTHING while `--s` is moving.**
Shipping v1 stuttered the descent (Qi felt it immediately), and the cause
was three costs all armed at the `atTwo` flip — mid-snap: the draw loop
starting (plus a layout read), `--sbloom` restyling the whole page from the
root, and 220 deep-star animations running at computed opacity 0, whose
layers all activated the moment the star container's opacity left zero.
The fixes are structural, keep them: the loop draws only once `--s ≥ 0.97`
(the static mount frame carries the fade-in); `--sbloom` is written on
`.l-stars`, never the root, so a write restyles the stars and nothing
else; and the deep field is `animation:none` until DeepLight raises
`data-bloom` on the container — an animation at computed opacity 0 still
runs and still holds a layer. Anything added to this layer later must
answer the same question first: what does it cost while the page is
scrolling?

**`/?lumen=surge` pins the surge at its peak** (all four channels full —
the brightest the screen can be, brighter than almost any real surge) —
same species of dev affordance as `?tune=1`, because the real thing spends
most of its life dark and nobody tuning it should wait a minute per look.

The contracts that keep it cheap and honest:

- **Premultiplied additive alpha, NOT `mix-blend-mode: screen`.** The
  shader writes alpha = its brightest channel, so ordinary source-over
  compositing equals screen-blending on that channel, and the layer can
  only ever *add* light — it cannot wash, tint, or flatten the dark under
  it, at any bug. It shipped first as an opaque black canvas under
  mix-blend-mode:screen and that stuttered and flashed the descent: a
  blend mode isolates the whole stage into a render surface, and building
  that surface mid-scroll is a white flash. Never put a blend mode back on
  this element. (Related backstop: `.landing` now carries a `color-mix`
  background that follows `--s` from sky to abyss, so a missed raster tile
  flashes depth-coloured instead of the body's pale sky.)
- **The bitmap is a third of the CSS pixels** (200–480 wide). Everything
  drawn is soft, so the compositor's upscale is invisible; measured GPU cost
  is microseconds a frame. The canvas is its own compositor surface — its
  frames invalidate nothing else on the stage.
- **30fps cap, and the loop is armed only while `atTwo`** (and never under
  `prefers-reduced-motion` — those readers get one still frame, same answer
  as the stars held at their peak). One static frame is drawn at mount so the
  scroll down fades in a field, not a blank; at this speed a still first
  frame is indistinguishable from a moving one.
- **The drift offsets are computed on the CPU per frame**, not from a time
  uniform: shader float time drifts out of precision on a long stay, JS
  doubles do not. The breath is two incommensurate sine periods multiplied —
  the same no-findable-period reasoning as the shafts' near-prime durations.
- **The verse's space is kept by shading, not masking**: an ellipse in the
  shader holds the light to 45% of itself where the poem sits (the analog of
  `starOdds`, done in-shader because light has no position to reject). A
  dither line in the shader breaks the banding every slow 8-bit gradient
  otherwise shows; the film grain above finishes the job.
- **Seeded per visit** — the field is never the same field twice.
- `--lumen` on `.l-lumen` is the one tuning knob (a multiplier on the
  layer's opacity, default 1).

If WebGL is unavailable the component renders nothing and the drift and the
stars carry the screen alone — the layer is an addition, never a dependency.

### Screen three — the drift (2026-08-23)

*(Qi's brief: 一个实时的弹幕之类的聊天室, 不用审核 — a live danmaku, no moderation)*

The floor of the descent is a guestbook, and the whole design question was what
shape a guestbook takes on **this** page. A list of dated entries is a comments
section wearing the album's colours. What is there instead is the album's last
frame taken literally: a world without us, with small lights still moving in the
dark. Every message **rises** — off the floor, out through the surface — at its
own speed and brightness, and there is one input at the bottom of the screen.

**Sideways was built first and was wrong twice over**, which is worth keeping
because it is the obvious way to build a danmaku. It is the motion of a stock
ticker; and it forces every message onto one line, so a 140-character one is
about three phone screens wide and can only ever be read as the fragment
passing the window. Rising fixes both, and buys a third thing: a riser is a
**block**, not a line. It wraps to two or three short lines and holds together
as an object — a scrap of paper going up — which is why it can be read while it
moves. Rising is also the site's own direction run backwards, for the one thing
on the page that belongs to someone else.

Everything lives in [components/Drift.tsx](components/Drift.tsx) — markup, hook
and a `DRIFT_CSS` string, the same shape as Landing. Landing knows two things
about it: one import, and one boolean.

**The three decisions worth keeping**, each against an obvious alternative:

- **Polling, not a socket.** A message takes 42–76 seconds to rise, so a
  6-second poll lands well inside the time anything is visible — nobody can
  perceive the difference from a WebSocket. What they *would* perceive is the
  cost: a socket on Vercel means either a function billed for the length of the
  connection or a second vendor with an SDK in the bundle. The poll is gated on
  being on this screen, sleeps on a hidden tab, and backs off to 15s and then
  30s as the sea goes quiet. **The realtime feel comes from how long a message
  stays visible, not from how fast it arrives** — which is also why the poll
  interval is the cheapest knob there is on the store's monthly bill.
- **One CSS animation per message, and no rAF.** Each line is an absolutely
  positioned `translate3d` keyframe the compositor owns. Sixty cost about what
  one costs, and the whole layer pauses (`animation-play-state`) the moment you
  scroll off — same rule as the shafts and the stars: *anything animating on
  this page has to be promotable and cheap.*
- **History arrives mid-flight, via a negative `animation-delay`.** Without it
  the water is empty for a minute after you land and then everything appears at
  the floor in a clump. Column, speed, size, brightness, sway and starting phase
  are all derived from a hash of the message id, so nothing is stored per
  message and every visitor sees the same water.

**The randomness is three sources, not one**, and that is deliberate: a uniform
`hash % 100` reads *more* regular than this does, because a uniform scatter has
no clumps and real water does. A riser gets a coarse column, a per-message
offset, and a slow horizontal **sway** on a near-prime period that is not a
fraction of its rise — the same trick the light shafts use, so no message ever
repeats the same path twice on the way up. Without the sway a riser is on a
wire and the whole layer reads as a machine. The sway lives on an inner
`<span>`: the rise and the sway are two transforms that have to compose, and one
element can only run one.

### The composer is in front, and the water goes behind it

Qi's call, and it changed what the composer is allowed to be. It sits under two
layers of its own, both inside `.l-say`'s stacking context on negative
z-indexes, both soft to nothing at every edge:

- **a pool** in the floor's own colour, which does the occluding. It needs a
  *plateau*, not a ramp — a single ramp from the centre was measured against a
  message parked exactly behind the composer and only reached ~.35 alpha at the
  far end of the words, which is dimmed rather than hidden and reads worse than
  either. The near-opaque part has to be at least as wide as the text it hides
  things behind. Verified by placing a riser on the composer's exact
  coordinates: it disappears completely.
- **a dim light** over the pool, flickering. It is not a scrim laid over the
  picture — the colour is the deep's own, so it reads as the water being denser
  here, and water is allowed to be denser somewhere.

The **geometry rule for both**: last colour stop × radius must be under 50% *on
each axis*, because radial-gradient percentages resolve per axis. Getting that
wrong is what made the first glow read as a banner — sized `56% 100%`, its
vertical radius was the box's full height, so the ramp was still at ~.04 alpha
when it hit the top and bottom edges and simply stopped. **A glow with a
straight edge is not a glow.**

### Why two messages never sit on each other

*(the brief: 可以短暂的堆叠但是要迅速分开 — brief overlap is fine, a stack is not)*

Everything above is per-message, and **every stacking problem is a relationship
between two of them**, so motion stopped being a pure function of the id. It is
now assigned with knowledge of what is already in the water, and **cached for
the life of the tab** — that part is not an optimisation. Re-deriving phases
when somebody posts would make the entire field jump mid-rise.

Three rules, and each one was added because measurement said the previous set
was not enough:

- **Speeds are quantised into five bands, not drawn from a range.** Two
  overlapping messages at the *same* speed never come apart — they are glued
  for as long as both are in the water. A continuous range produces
  near-identical pairs constantly.
- **Anything that can overlap horizontally gets a band at least two away.**
  Merely *different* was tried and measured: 41s against 50s is ~1.6px per
  second of relative drift on an 880px rise, and the pair was still stacked
  twenty seconds later. That is not brief overlap, it is a stack that
  eventually resolves. Two bands apart is ~6px/s and clears in under ten
  seconds. The bands were widened at the same time (36–84s).
- **Density is capped by viewport width, and that is the biggest lever.** About
  one message per 80px of width, floored at 8 and capped at 16. A screen holds
  what a screen holds: a phone is effectively *one* column, and eighteen
  messages there measured thirteen overlapping pairs at the worst moment. No
  amount of placement cleverness fixes that — there is nowhere for them to be.
  Arrivals are exempt from the cap; someone who has just typed must see their
  message. **When a field looks broken, check how many things are in it before
  improving where they go.**
- **The collision geometry lives in the component, not the stylesheet.** It used
  to be a CSS override that squeezed the offsets on a phone while the JS model
  still used desktop numbers — so the model believed the field was seven
  spread-out columns while the screen showed one stack, and cheerfully gave
  overlapping messages the same speed. Phones were visibly worse than desktops
  for exactly that reason. One source of truth; the CSS places what it is given.
- **Starting phase is chosen against the neighbours, not within the column.**
  Spreading evenly *inside* a column was the first attempt and it barely helped,
  for a reason worth remembering: **a riser is ~30% of the width and the columns
  are 10% apart, so most of a message's real neighbours are in other columns.**
  The phase now tries sixteen positions around the cycle and keeps the one
  furthest from everything it can actually overlap. Arrivals go to the emptiest
  column — two people posting in the same minute is the commonest way a field
  gets a stack.

  **A message with no neighbours yet must still be scattered, not defaulted.**
  Returning a constant in that branch was a real and quiet bug: the *first*
  message placed in each clear stretch of the width got the same phase as every
  other first message, so a handful of them began life in a row at the same
  height. An unconstrained message is not one to put anywhere in particular, it
  is one to put anywhere at all.

Measured over two minutes of motion with 16 messages: **none overlapping at
load**, 26 pairs overlap at some point during the two minutes, the median one
for **6 seconds** and the worst for 14. Nothing is permanent, which was the
brief. Before these rules there were three pairs that never came apart at all.

There are **seven** speed bands rather than five for the same reason the cap
exists: on a phone every message is every other message's neighbour, and with
five bands and eight messages three pairs were forced to share a speed — and a
shared speed is a pair that never converges but also never comes apart.

**How to measure it, because two obvious methods are both wrong.** A screenshot
cannot tell a busy field from a broken one, and neither can watching — the
question is whether a *specific pair* separates, over a minute, while everything
else moves.

- **Do not measure in the preview pane.** Its document timeline is frozen:
  `getAnimations()` reports `playState: "running"` while `currentTime` never
  advances, so two measurements ten seconds apart return the identical frame and
  every overlap looks permanent. Check `document.timeline.currentTime` before
  believing any before/after.
- **Do not seek by setting `currentTime` to an absolute value.** History arrives
  mid-flight via a *negative* `animation-delay`, and seeking to an absolute time
  throws all of it away — every message snaps to the start of its cycle, which
  is the one configuration the phase placement exists to prevent. Read each
  animation's `currentTime` first and seek to `base + dt`.
- **Do not measure the `<li>`.** The sway is a transform on the inner span, so
  it moves the text without moving the outer element's box, and
  `getBoundingClientRect()` on the `<li>` is blind to it — it will report a
  clean field while two messages are visibly on top of each other. Measure
  `.l-drift-in`, and seek the inner span's animation along with the outer one.

The working method is: capture the base times, step `dt` in one-second
increments, walk the rendered boxes for intersections at each step, and record
the longest consecutive run per pair. That number — longest run, not count — is
the one that says whether the field drifts or stacks.

### One flat namespace, three stylesheets

`LANDING_CSS`, `JELLY_MARK_CSS` and `DRIFT_CSS` are concatenated into a single
`<style>` in that order, so a name defined twice resolves to whichever came
last — with no error, no warning, and no sign of it on the screen you are
working on. It has bitten twice while building screen three:

- **`.l-drift`** was already screen two's pair of slow water clouds. Taking the
  class cost them their z-index, and under `prefers-reduced-motion` turned them
  into a scrolling flex column.
- **`@keyframes l-rise`** was already the hero's entrance. Taking the name left
  the whole of screen one — title, countdown, both buttons — at `opacity: 0`.

Both times screen three looked perfect and the damage was one or two screens
away, which is why neither a review nor a screenshot of the new work caught it.
**Keyframe names share the namespace with class names, and are the easier half
to forget.**

Run this before naming anything, and after any rename:

```js
// node -e, from web/
const fs = require('fs');
const css = (f, v) => { const s = fs.readFileSync(f, 'utf8');
  return s.includes(v) ? s.split(v)[1].split('`').slice(0, -1).join('`') : ''; };
const kf = (c) => new Set([...c.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
const cl = (c) => new Set([...c.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]));
const L = css('components/Landing.tsx', 'const LANDING_CSS = `');
const J = css('components/JellyMark.tsx', 'export const JELLY_MARK_CSS = `');
const D = css('components/Drift.tsx', 'export const DRIFT_CSS = `');
const hit = (a, b) => [...a].filter((x) => b.has(x));
console.log('keyframes:', hit(kf(D), new Set([...kf(L), ...kf(J)])));
console.log('classes  :', hit(cl(D), new Set([...cl(L), ...cl(J)])));
```

A few class names *should* appear in both — `landing`, `is-in`, `l-down`,
`l-floor` are shared on purpose. Every keyframe collision is a bug.

### Testing the store without an Upstash account

The memory fallback is convenient and it is also a trap: it makes every test
green while the code that will actually run in production has never executed
once. The rate limiter in particular is disabled in memory mode, so it went from
written to verified without ever running.

**Stand up a fake Upstash instead.** Its REST API is small enough that the
handful of commands this store sends — `LPUSH` `LTRIM` `LRANGE` `LREM` `INCR`
`EXPIRE`, all through `POST /pipeline` — fit in about sixty lines of Python, and
pointing `UPSTASH_REDIS_REST_URL` at `http://127.0.0.1:<port>` in `.env.local`
is the whole setup. Make it count commands: that is the only way to check the
claim that a poll costs exactly one, which is the number the whole free-tier
budget rests on. It also lets you assert things a real store makes awkward —
that a rejected bot costs *zero* commands, that a 429'd request does not spend
the hourly budget, that the rate-limit key is a hash and not an address.

Killing the fake mid-run is also the only easy way to see the store-down path:
both routes should 502, the poll should quietly back off rather than clear the
water, and a failed send should hand the visitor their text back.

**Both ends fade inside the keyframe, not under a mask.** A mask forces the
whole viewport-sized subtree into one render surface and re-rasters it every
frame — the exact cost the glimmers were removed for. Four opacity stops cost
nothing. Two details in them: the middle stops fade *to* `var(--dim)` rather
than to 1, or the depth parallax would be erased; and the fade completes at 82%
of the travel rather than at 100%, well before the top. A message still lit when
it reaches the upper fifth crosses the title and then the nav, and a stranger's
sentence sliding through the album's own type reads as a bug rather than as
weather.

**"Fresh" is not "near the top of the list."** Only messages that arrive while
someone is watching swim in from the edge lit; the first poll's worth is
absorbed as history. The flag flips on the first *completed* poll rather than
the first one that brings something — an empty wall answers the first poll with
nothing, and the very first message anyone ever leaves has to be the one that
glows.

**Unmoderated is a decision about review, not about defence.** Nothing is held
for approval — that is what makes it feel like a room — and
[app/api/guestbook/route.ts](app/api/guestbook/route.ts) is entirely defence
instead: a honeypot and a dwell timer (both answering 200 with a decoy, because
a bot told it failed learns to pass), 5/min and 40/hour per hashed IP, a 140
character cap, and control/bidi characters stripped. Deliberately **no CAPTCHA**
— it taxes every honest visitor against an attack nobody has made. If the wall
is ever actually hit, Turnstile in front of the POST is one env var and ~10
lines, and it belongs *then*.

The undo Qi keeps is `DELETE /api/guestbook?id=…` with `GUESTBOOK_ADMIN_TOKEN`
in a header. With the token unset the route 404s: an unconfigured admin door
should not announce itself.

**A delete has to reach pages that are already open, and that needs a second
kind of poll.** An incremental poll can only ever ADD — it asks for what is
newer than its cursor — so a message taken down stays on the screen of everyone
who had the page open, for as long as they leave the tab open. On a site whose
only moderation is "delete it afterwards", that is most of the moderation
failing. So once a minute the poll asks for the *whole* wall instead and drops
anything that is no longer in it.

Two things make that cheap and correct:

- It costs the same **one** Redis command. `read()` does a single `LRANGE` of
  the whole list either way and filters by timestamp in JS, so only the size of
  the JSON differs.
- It is timed in **milliseconds, not in a count of polls** — found by testing,
  not by thinking. The poll backs off to 15s and then 30s when the water is
  quiet, so "every tenth poll" stretched to several minutes exactly when the
  wall was empty, which is the state a wall is in right after someone deletes
  the only thing on it.

The sweep keeps anything whose id starts with `local-`, or an optimistic copy
posted in the gap between the request going out and its answer coming back
would be swept away a moment after being typed. (Verified: post, wait out a
sweep, still there.)

**Storage is Upstash Redis over its REST API, which is why there is no new
dependency.** Upstash speaks HTTP, so the store is a `fetch` — no client, no
pool, no cold-start handshake, nothing in the browser bundle. Its free tier is
500K commands a month, needs no card, and rate-limits rather than billing when
exceeded — so **the design constraint is command count, not money.** That is why
`read()` is exactly one `LRANGE`: it runs on every poll from every visitor on
this screen and is therefore essentially the entire monthly usage. An earlier
version also read a set of hidden ids alongside it, doubling the bill of the hot
path to serve a case that fires when Qi deletes spam; hiding does an `LREM`
now — two commands, rarely. **Anything added to the read path is multiplied by
every visitor-second on this screen; put it in the write path if there is any
choice.** Set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; with them unset the
store falls back to process memory so the screen is fully playable locally with
no account anywhere, and the UI says so on screen rather than pretending. That
fallback is **not** a production mode — every serverless instance would keep its
own wall.

**Two things this screen taught the rest of the page:**

- **`l-in` ends on `transform: none` with fill-mode `both`, so it owns the
  property forever.** The composer was centred with `translateX(-50%)` and
  jumped a half-width to the right the instant its entrance finished. Anything
  on this page that is both animated and positioned has to be positioned
  *without* transform — the composer is centred by `left:0;right:0;margin-inline:auto`.
  Same family of trap as `l-down`'s `backwards`-not-`both`.
- **Enter is handled explicitly.** A form with a submit button is supposed to
  submit on Enter, and implicit submission is the browser's behaviour rather
  than the form's — the first thing a wrapper or an automated key event fails to
  reproduce. On the one control on this site that is a chat box, that is not a
  quirk worth leaving to the platform. The handler checks `isComposing`, because
  an IME's Enter commits the candidate and swallowing it would send 拼音.

### The composer

Three were built and tried at `?say=1|2|3` — a hairline, a sentence, and a
riser — because the first one shipped was a blurred pill with a border floating
on an oil painting, which is the shape a chat input has on every product on the
internet and the shape nothing else on this site has. Qi picked **3, the riser**:
no form at all, set exactly like a message already in the water, and sending
lets go of it. **The other two have been deleted rather than left behind a
flag** — they never received the occlusion, the single caret or the left
alignment, and a stale alternative is more misleading than no alternative. They
are in the history, which is where cut work belongs.

Its two faults were named immediately and they are one fault: *you cannot tell
it is an input, and the risers go through it.* **Once messages travel upward,
the bottom of the screen is where messages are born**, so anything parked there
is guaranteed to be collided with by things that look exactly like it.

The first fix was to part the water — empty a band at the bottom and start
risers at the composer's own line. It worked and it was wrong: **the field
filling the whole screen is the effect**, and cutting a strip off the bottom
traded the thing people come for against a problem the control could solve
locally. Worth keeping as a note; if the composer ever moves somewhere with room
of its own, that version is waiting.

What it does instead, none of it furniture:

- **A tight halo on the glyphs.** A wide soft *dark* pool behind the whole
  composer was built and cut for exactly the reason the down-mark's was: at the
  radius that helped it was a patch of grey on an oil painting. Spread a halo
  and it stops being light and becomes a shadow. Hugging the letters does the
  same job and leaves no mark.
- **A dim light of its own** (Qi's call) — the water around it lit faintly,
  breathing on a slow cycle. Light is allowed here and objects are not; same
  rule the shafts are built on. The cycle is deliberately **not** the album's
  60bpm: the heartbeat belongs to the record, and a text field borrowing it
  would be claiming to be part of the work rather than the way in.
- **A caret**, 2px rather than the site's usual hairline, because a hairline is
  this page's language for *structure* and this is the one mark that has to be
  noticed — over grain, at half opacity for half of every second. It blinks at
  1s, which is both a real caret's rate and the album's beat.
- **Stillness.** It is the only thing on screen holding still. That reads, and
  it is also why every screenshot of this design looks worse than the design is.

The long fade-in does the rest: the composer sits inside the first tenth of the
travel, where a riser is under half its brightness. Nothing is hidden — the
bottom of the screen is full of messages, they are simply still coming out of
the dark down there, which is where they should be coming out of.

**This screen has no title, and that is the design rather than an omission.**

It carried one — a line in the poem's hand with a Chinese line under it — and
every candidate for it read as *writing*: an abstract noun and a soft verb, the
shape a sentence takes when it is reaching for significance instead of saying
something. (Qi's word for the first attempt, *Leave a light / 留一盏灯*, was
「太 ai 了」, and he was right: it would fit any product on earth.)

The reason none of them could work is one screen up. **The poem is the writing
on this site.** A second piece of verse set eighty pixels above a text input is
competing with ten lines it cannot beat, and losing that competition makes both
worse. So the whole of what this screen has to say is in the **placeholder** —
one line, in the box, at the moment someone is deciding whether to type — and
everything else on screen belongs to the visitors.

A hanging 深海留言 in the right margin, to match 水母之心, was built and cut
before that: the poem never reaches its own margin so nothing crosses it, but
every riser here crosses the full width, and the mark spent half its life with a
stranger's sentence running through it. Glitch, not ceremony.

**The consequence worth keeping: the site says nothing here in Chinese, and the
screen is bilingual anyway, because the people in the water are.** That is a
better version of the album's voice than a caption — it is not performed, it is
just what is there.

There is one line the screen does say — `no one has spoken yet`, because an
empty sea with an input in it reads as broken or as still loading — and it went
out in Chinese first, which was wrong for a reason worth writing down:

> **On this site, Chinese is ceremonial and never functional.** `QI · 琦` is a
> name; 水母之心 is the album's second name. Both are titles. Every piece of
> *working* copy is English — HEAR THE DEMOS, TRACKLIST, FOLLOW, *follow thy
> heart*, *receive a heartbeat at…*. A status line reporting an empty wall is
> working copy, and 还没有人说话 used the one register this site has never used
> Chinese in.

The line goes the moment there is anything to see.

**On a phone the riser gets most of the width, and its starting offset is
scaled to match.** 30vw of a phone is 112px, and a 140-character message in that
column comes out eight lines tall — a column, not a scrap. The block goes to
`min(30ch, 74vw)` there, and because the offset is an inline style the media
query *multiplies* it rather than replacing it, taking 0–68% down to 3–26% so
the wide block still lands on screen. The sway is halved for the same reason:
the swing that reads as drift on a desktop is a third of a phone's width, and a
block moving that far is being blown, not adrift.

**There is no mark at the foot of the poem inviting anyone down here.** One was
built — the shore's two chevrons, one screen lower — and Qi cut it. The poem is
the one place on this site allowed to end in nothing, and a mark set after
`sea risen.` is still something set after it.

Under `prefers-reduced-motion` the drift becomes what it always was underneath:
a still, centred, newest-first column. The motion is the presentation, not the
content, so nothing is lost. (The global `.landing *{animation:none}` would
otherwise strand every line at `translate3d(0)` — flush left, stacked on top of
each other, which is exactly what it looks like when that rule does not land.)


### Snap, and the one thing that can trap a reader

`scroll-snap-type: y mandatory` is the whole feeling of "two pages". It is also the
one thing here that can strand someone: a section taller than the window has no snap
position at its own bottom, so the scroller keeps pulling back and the tail of the
poem becomes unreachable.

So it gives way — **on a measurement, not on a breakpoint.** The scroll effect sets
`data-tall` when the three screens measure more than three screens, and that switches
the snap to `proximity`. What makes screen two overflow is how many of the ten lines
had to turn, which depends on the width, the height, which font finished loading and
whether the player is up; no media query knows all four. (The effect re-runs on
`barOn` for exactly this reason — the player changes screen two's padding.)

### The hero's primary action

*(Superseded 2026-08-26 — LISTEN NOW is back, qualified. See the end of this section.)*

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
arrow both scroll to screen two; `FOLLOW` opens the signup over whatever you were
looking at, and Escape closes it. The split is not layout convenience — a form is
not a place: it has no content to be read, it is answered and dismissed, and it must
not cost the visitor their position on the way back out. The poem is the opposite of
all three, which is why it stopped being a dialog you open and dismiss.

### The ask

`FOLLOW` is the site's one conversion, and it spent the first pass set as an 11.5px
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
comes up behind his outline while *PAINTING BY / SHO PENG* fades in on the sky in
front of his face; clicking opens the artist's site in a new tab. On touch,
where there is no hover to find it with, the caption is simply on at .6 — the
same answer the poem's track numbers give, for the same reason.

There is no outbound arrow after the name, and the omission is deliberate: a
mark that announces a link is UI, and that line is a signature on a painting.
The wording carries the whole job instead — *painting **by*** — which is also
what keeps a name set beside a man's head from reading as **his** name. **The
figure is not the painter, and not Qi**; if that line is ever reworded, the
`by` is the part that cannot go.

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
  falloff, not two effects — which is also why they share a `<g>`.

**One mask and one animated property, on that group.** Each stroke had its own
mask and its own animated opacity first, and both are a cost rather than a
style: a mask forces its subtree into its own render surface, so that was two
surfaces to rasterise where one does, and two properties to animate where one
does. The strokes now carry their relative strengths as static opacities (`.78`
and `.62` — the mix between them, and nothing else) and `.l-art-light` carries
the fade, so turning the light up and down is a single alpha on a single
already-rasterised surface, on hover and during the breath alike. At rest that
alpha is 0 and a fully transparent subtree is not painted, so the two blurs cost
nothing for the whole time nobody is looking at him. **On this page the price of
an effect is how many render surfaces it makes, not how many shapes are in it** —
same lesson as the mask that was taken back off the star field.

`opacity` alone does not un-link a link: at `--s` 1 the anchor was invisible and
still catching clicks over the poem. It fades out by s = .294 and
`.landing[data-two]` then hides it with `visibility`, which is the one property
that takes it out of the paint, the tab order and the a11y tree together. Those
two numbers are paired — move one and move the other.

**The outline** is 110 points, ~1 kB, traced off `hero.webp` itself by
[scripts/trace-figure.py](scripts/trace-figure.py) — colour segmentation the
painting happens to make easy (sky is the only thing here with more blue than
red; sand the only thing both warm and not skin, *and only below the horizon* —
applied to the whole frame that rule also ate the shadow under his brow), then a
Moore-neighbour boundary walk and Douglas-Peucker.

**Every rule in it needed a second axis, and both times the missing one was
brightness.** Colour alone put a tab of sand on the back of his heel and shaved
the point off his fringe, and neither showed until the glow traced them:

- **Sand is warm *and* not skin**, but only below the horizon — applied to the
  whole frame that rule also ate the shadow under his brow. Its warmth floor is
  `R-B > 30`, not the 45 it started at: plain sand is 50–75 and his clothes
  17–22, so 45 looked like slack in a wide gap, but the shadow *he casts* is
  still sand at 43 with a floor of 32. Too cool to be ground, too warm to be
  sky, and so by elimination him. **The gap that decides it is clothes-to-
  shaded-sand, 22 to 32 — not clothes-to-sand.**
- **Sky is cool *and* bright.** `R-B < -35` is right about ordinary sky and
  wrong about the tip of his fringe, which is painted a blue-black: R-B −13 to
  −70, indistinguishable from sky on colour and nothing like it on value. The
  floor at `V > 140` costs nothing — across 32,292 pixels of open sky in this
  frame not one is darker than 140, and the fringe tip runs 53–120.

**And the opening is a vertical line, not a square** (`open_v`). What it has to
remove is the horizon seam — rows 580–585, a six-row band of sky-to-sand blend
that is neither and so comes out as figure right across the frame; a vertical
erosion of radius 3 deletes any horizontal band six rows or thinner and a body
700 rows tall does not notice. A *square* opening of the same radius also
deletes anything narrower than the kernel in **either** direction, and the
fringe comes to a point: 38 pixels, gone, and with them the only thing telling
the glow where the hair ended. It read on the page as a band of light cutting
straight through his hair. A cut-out PNG would have cost
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

### The two doors, described the same way

*(2026-08-26)* The hero's two actions are one grammar — an invitation, and in
parentheses what is behind it:

```
LISTEN NOW (teasers)        TRACKLIST (full demos)
```

`LISTEN NOW` was dropped once for claiming a release this album has not had. It is
back because the claim now arrives qualified in the same breath, and the parenthesis
is what makes it honest. Describing both doors identically is the point: the choice
between them is legible at a glance instead of inferred from two differently-shaped
phrases.

Each gloss is its own span, outside the per-letter sweep. That lets it be set below
the label it qualifies (9.9px against 13.8px, .62 opacity) — a parenthesis at the
same weight as its label is just a longer label — and lets it be positioned
independently. Both glosses survive on a phone, where the actions stack and each has
its own line: neither LISTEN NOW nor TRACKLIST says which one is whole, so on a small
screen the glosses are the entire distinction.

Gotcha found here: every letter of the play label is an inline-block, so the line
could break between any two of them. No label had been long enough to try it until a
twenty-character one arrived and came out as `ALL TEN I / N 7 MINUT / ES`. Both labels
are `nowrap`.

### The seek bar is a real waveform

`public/waveforms.json` holds 400 normalised peaks per **whole song**, ~14 kB for all
ten, generated by [scripts/waveform.mjs](scripts/waveform.mjs):

```sh
npm run waveform     # after re-making the medley or replacing an mp3
```

Whole song, not whole file: the bar draws the entire track and lights only the part
the medley holds, so the peaks have to describe the song end to end. The script reads
the full-length demos from `../audio-originals/full-demos/` — deliberately outside the
repo — and errors loudly if that folder is missing rather than quietly drawing an
excerpt as if it were a complete track.

It is precomputed because the alternative is decoding a 5 MB mp3 in the browser to
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

**Two sources, one shape.** *(last updated 2026-08-26)* Every song can be heard two ways
and the player does not branch on which: a source is `{url, base, windows, full}`, and a
whole song is just the degenerate case — one window covering everything, at offset zero.
The bar, the progress, the seeking and the poem fill are written once against `windows`.

- `medley.mp3` — one passage per song, in order, 1.2s of silence between. 7:16, 8.3 MB.
  What the hero press plays. Chapters in [components/medley.ts](components/medley.ts),
  generated by `../audio-clipper/` along with the audio, because a chapter table written
  by hand drifts from the file it describes.
- `NN-<slug>.mp3` — the whole song. What a poem line plays, and what the dim half of the
  bar fetches when pressed.

There is no button for that second thing any more. The dim stretch brightens under the
pointer and that is the whole of the invitation — which means on a touch screen the press
works but is undiscoverable, and the poem's lines are the path that isn't. A deliberate
trade: the bar is four items wide on a phone and the button was the fifth.

Everything is released in full four months before the record, which only works if nobody
mistakes a rough bounce for the finished thing — hence `DEMO_NOTE`, which is a **dateline**
and not a disclaimer: `demos · august 2026`.

Two revisions got it there and both are worth keeping. It began as a boxed tag set in Jost
between the poem's head and its first line, which cut the poem's breath in half — saying
what these are is housekeeping, not part of the work, so it moved to the foot and into the
poem's own italic, smaller and dimmer than the verse. Then the sentence itself went:
"unmixed, unmastered, and still changing" is three adjectives doing one job, and a sentence
that long reads as getting your excuses in first. A date on a draft does the same work and
defends nothing — nobody reads a dateline as an apology. Bump the month when the bounces
change; that is the whole maintenance.

It is also **hidden until hovered**. At rest the panel is a poem and nothing else; the note
holds its place in the layout at `opacity:0` (not `display:none`, so the poem does not move
to make room for it) and comes up over 0.7s whenever a cursor is anywhere in `.l-poem`.
Under `@media (hover:none)` it simply stays, dimmer — a touch screen has no cursor to ask
with, and this is the only place the page says these recordings are unfinished.

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
The nav's ask said `PRE-SAVE` until 2026-08-23 and now says `FOLLOW`, because
pre-save is a DSP mechanic and there is no DSP link — the button opened an email
form. `FOLLOW` is what it does, and it is the panel's own first word
(*follow thy heart*), so the button and the thing it opens say the same word.
Not `FOLLOW ME`: the left of the nav is already `QI · 琦`.

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
