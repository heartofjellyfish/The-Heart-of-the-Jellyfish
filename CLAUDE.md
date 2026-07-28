# qi.land web — context for Claude

The site for Qi · 琦's debut album *The Heart of the Jellyfish* (release: 2026-12-20).
A single scroll-driven 3D descent: above water → past the jellyfish → into the abyss.

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

- `/` — full descent
- `/?focus=heart` — locks at d=0.55
- `/?focus=abyss` — locks at d=0.92
- `?tweak=1` — shows leva panel
- `/medusa` — the shader-only alternate treatment (see below); shares no code with the above

## The `/medusa` route — the shader-only alternate

`/` and `/medusa` are two treatments of the same 11-frame arc, kept side by side so
they can be compared before one wins. They share nothing but the storyboard.

| | `/` (Descent) | `/medusa` |
|---|---|---|
| engine | R3F + three.js + real GLBs | one full-screen WebGL triangle, no three.js |
| the jellyfish | Chrysaora model, lit and animated | drawn analytically in the fragment shader |
| scroll input | `depthRef` (a ref, read in `useFrame`) | `uD` uniform, sampled each rAF from `scrollY` |
| first load JS | ~425 kB | ~111 kB |

Why it's built the way it is:

- **Ported from a Claude Design file** (`Medusa.dc.html`, project `1d97dab2-…`). That design
  is the source of truth for the look — if the palette or the jelly silhouette needs to
  change, change it there too, or the two drift apart. The GLSL in
  [components/medusaShader.ts](components/medusaShader.ts) is copied verbatim for that reason;
  resist "tidying" it.
- **Inline styles, not Tailwind.** The design is inline-styled and the port keeps that
  1:1 so a diff against the design stays readable. The one exception is
  [`MEDUSA_CSS`](components/Medusa.tsx) at the bottom of the component: anything with a
  `:hover` state has to keep its resting value in a class, because inline styles outrank
  stylesheet rules and the hover would never apply.
- **The route owns its own fonts.** Medusa names families literally (`'Cormorant Garamond'`,
  `'Jost'`); the root layout only exposes Cormorant through next/font's hashed
  `--font-cormorant`, so [app/medusa/page.tsx](app/medusa/page.tsx) renders its own Google
  Fonts `<link>`.
- **`scroll-behavior: smooth`** is set on `<html>` by an effect and torn down on unmount —
  it's needed for the poem's anchor links, but it must not leak onto `/`, whose descent
  is scroll-driven.

Two deliberate departures from the design file, both fixing runtime bugs in it:

- Track 03's `rotate(-2deg)` survives the reveal. The design's reveal wrote
  `transform: translateY(...)` straight onto the element and silently killed the tilt.
- The `▷ DEMO` controls are real `<button>`s, so they're keyboard-reachable.

**Not done yet:** `public/audio/NN-*.mp3` don't exist, so every demo click opens the player
bar labelled `demo 待上传` — that's the intended placeholder, not a failure. The email
signup is local-only (`setSent(true)`); it posts nowhere.

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

7. **Verify in the browser, don't just claim it works.** A preview server typically runs during sessions. Use it. For something at depth d=X, navigate to `/?focus=heart` or scroll programmatically, screenshot, and confirm the prop actually renders (camera framing, fog, lighting all read right).

## Asset budget

- First paint: keep `<5MB` of model data preloaded (currently: chrysaora ~1.6MB).
- Gated assets: target `<50MB` each; texture-resize before going higher.
- Texture rule of thumb: 1k for distant/abyss props, 4k for hero/close props, never 8k on the web.

## Don't

- Don't introduce a state library — the `depthRef` pattern is intentional and stays.
- Don't `useGLTF.preload` heavy assets at module scope (breaks first-paint budget).
- Don't add a prop without picking its depth window — "always visible" props clutter the descent.
- Don't ship without verifying in the browser preview.
- Don't pair `<Bloom>` with any `MeshPhysicalMaterial` that has `transmission > 0` (the jelly bell). The transmission backdrop produces NaN/Inf at animated mesh edges, and **no `luminanceThreshold` filters them out** — NaN comparisons always fail. The visible symptom is flashing black squares over the hero. If glow is wanted later, use the `<Selection>` + `<Select>` + `selectionLayer` pattern so only specific non-transmissive meshes feed the bloom input.
- Don't set `transparent: true` on a material that already uses `transmission`. Transmission handles its own alpha through a separate pass; doubling up with `transparent + DoubleSide` causes depth-sort flicker on animated skinned meshes.
