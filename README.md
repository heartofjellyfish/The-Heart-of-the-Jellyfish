# The Heart of the Jellyfish

Site for the debut album by **Qi · 琦** — *The Heart of the Jellyfish* (releasing **2026.12.20**).

A single scroll-driven 3D descent: from a sunset above the sea, through the water surface, past the jellyfish at the center, into the abyss.

→ Live: [the-heart-of-the-jellyfish.vercel.app](https://the-heart-of-the-jellyfish.vercel.app)

## Stack

- **Next.js 15** App Router + TypeScript + Tailwind
- **React Three Fiber** + **drei** + **three.js**
  - `three/examples/jsm/objects/Water.js` — real-time water (waves + reflection + sun specular)
  - drei `<Sky>` — Preetham atmospheric scattering for the sunset
  - Real GLB models (currently: Chrysaora jellyfish at frame VI)
  - Volumetric Tyndall light shafts (custom GLSL on billboarded planes)
- **`@react-three/postprocessing`** — bloom on the jellyfish heart-pulse and sun specular
- **leva** — in-browser tweak panel, gated by `?tweak=1`
- Deployed on **Vercel** (auto-deploys from `main`)

## Local dev

```bash
npm install
npm run dev          # http://localhost:3000
```

## Routes

| URL | What it shows |
|---|---|
| `/` | Full scroll-driven descent + Poem typography overlay |
| `/?tweak=1` | Same, with Leva sliders top-right for live sunset / sky / water / lights tuning |
| `/?focus=heart` | Locks depth at frame VI (the jellyfish heart). No poem overlay |
| `/?focus=abyss` | Locks depth at frame X (the deep). No poem overlay |
| `/preview-jelly` | Standalone GLB inspector for the Chrysaora — animations, material override, lighting test |

## Where this repo sits

This is one project inside the **Qi Land workspace** at `/Users/qliu/Qi Land/`. The workspace contains other things (DNS notes, future recording sessions, lyrics docs) that are intentionally **NOT** in this repo. See `/Users/qliu/Qi Land/CLAUDE.md` for workspace-level context. See `CLAUDE.md` in this folder for in-repo Claude session context.

## Deploy

```
git push origin main → GitHub heartofjellyfish/The-Heart-of-the-Jellyfish → Vercel auto-build → live
```

Default branch is `main`. No PR workflow — push directly.

## Adding 3D assets

Drop the GLB at `public/models/<name>/model.glb`. For anything > 5 MB, gate loading on the depth ref so first paint stays fast — see `WreckGate` pattern in `components/OceanScene.tsx`. Add the credit line to `CREDITS.md` if the source requires it.

## Credits

- Music, lyrics, art direction — **Qi · 琦**
- Three.js Water shader — three.js examples (MIT)
- Sky atmospheric scattering — Preetham model via drei
- Chrysaora jellyfish model — Pacific Sea Nettle by NestaEric on Sketchfab
- Other asset credits in [CREDITS.md](CREDITS.md)
