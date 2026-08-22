# qi.land web — context for Claude

The site for Qi · 琦's debut album *The Heart of the Jellyfish* (release: 2026-12-20).
Two things live here. `/` is the public front page: one screen, no scroll, the shore
painting with the album over it. `/descent` is the R3F telling of the same story — above
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
- `/` — the one-screen front page (see below); shares no code with the above

## The front page (`/`) — one screen

`/` is a single screen. No scroll: `html, body { overflow: hidden }` and the root
is `position: fixed`. Everything the visitor can reach is either on that screen or
in a panel that opens over it.

[components/Landing.tsx](components/Landing.tsx) is the whole thing — markup plus a
`LANDING_CSS` string at the bottom. Layers, back to front: the painting (twice — see
below), a scrim, the nav, the hero block, the bottom bar, and the panel.

**The bottom bar has two states and one slot.** Idle it's the ten titles, no
numbers, each in its own slot spread across the bar; playing, it becomes the player
in place. That matters on a one-screen layout — a separate fixed player bar would
have covered the tracklist it was launched from.

`barView` is separate state from `cur` on purpose: **leaving the player must not
stop the music, and stopping the music must not strand you on a dead player.** The
`←` returns to the list with playback running, the sounding line is lit rather than
badged (the bar gains no chrome), and clicking that lit line goes back into the
player instead of pausing. `✕` is the one that stops.

Items are `flex:0 1 auto`, never `1 1 0` — equal thirds hand "Wake up!" the same
width as "what belongs to the sea will always return to the sea." and truncate the
long ones to nothing. Below 1180px the same markup becomes one scrolling sentence:
`display:block` turns the buttons inline and the whitespace between them, ignored
while it was a flex container, starts working as word space. Whether it overflows
is measured by a `ResizeObserver` (plus `document.fonts.ready`, since a late webfont
reflows text without resizing anything), not guessed at a breakpoint.

It's a gradient scrim, not a solid bar. A solid one cut ~70px off the bottom of the
painting, which on this canvas is the sand and the near water. 

**The poem and the mailing list are panels, not sections.** `ALBUM` / `ALL TEN` opens
the poem; `PRE-SAVE` opens the signup. Escape closes. This is what keeps the page one
screen while still having somewhere to put the poem.

### The painting

`public/images/hero.webp`, from the PNG master in `artwork/`. It is **1672×941**, which
is the current weak point: on a 1440-wide retina screen the browser paints it at 2880
device pixels, a 1.7× upscale, and it reads soft. Quality isn't the lever — it's encoded
at q92 — resolution is. A replacement wants to be ~3840×2160 for the same crop.

#### One layer, cover everywhere — only the crop moves

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

### The poem is canon### The poem is canon

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
not the work.

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

The poem's title is in the poem's own hand, at Qi's call after two rounds of my
arguing otherwise. The risk it accepts is real: "The heart of the jellyfish." is
also line 06, so title and line are nearly the same string in the same face. What
separates them is the ranking, not the typeface — the title runs ~1.6x the line
size with ~90px of air beneath it, and it is the only thing in the panel that is
not a button. If it ever starts reading as the poem's first line, that ratio is the
knob to turn.

**`/?tune=1` opens a live tuner** (top right): vignette strength and spread, poem face
and size. Dev affordance, renders for nobody else. `?type=1` still works.

### The countdown and the vignette

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

### Two traps worth remembering

**Specificity.** `.landing button{font:inherit}` normalises the UA button font at
(0,1,1), which beats any bare `.l-foo` class — so every button rule that sets a font
must be `.landing .l-foo`. That prefixing then bites back inside media queries: a
`@media` block containing bare `.l-strip-items` loses to a base `.landing
.l-strip-items` no matter that it comes later, because specificity outranks source
order. Both bugs looked identical from outside: a rule that reads correctly and
computes to something else. **If a base rule is `.landing`-qualified, its media
query override has to be too.**

**Hydration.** The page is statically prerendered, so anything derived from the
clock is baked at build time and wrong on arrival. React does not merely warn about
mismatched text — it discards hydration and re-renders the tree. `suppressHydration
Warning` does not save you either: it covers an element's own text, not its
descendants, and the countdown's digits are three levels down. The fix is to render
the *same placeholder on both passes* and fill in from `useEffect` — remove the
mismatch rather than silence it.

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
