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
| `/` | **The public site.** One screen: the shore painting, the album, the demo player, and panels for the poem and the mailing list. No scroll |
| `/descent` | The R3F 3D descent (real water, real GLB jellyfish, shipwreck). Was `/` until the 2026-07-27 launch |
| `/descent?tweak=1` | Same, with Leva sliders top-right for live sunset / sky / water / lights tuning |
| `/descent?focus=heart` | Locks depth at frame VI (the jellyfish heart). No poem overlay |
| `/descent?focus=abyss` | Locks depth at frame X (the deep). No poem overlay |
| `/preview-jelly` | Standalone GLB inspector for the Chrysaora — animations, material override, lighting test |

`/` is deliberately the light one: 108 kB First Load JS against `/descent`'s 425 kB, and it
needs no model downloads, so it holds up on a phone. (102 kB of that 108 is the React/Next
runtime every route pays; the page's own code is 5.7 kB.) The 3D work isn't abandoned — it just isn't the
front door yet. See `CLAUDE.md` for how the single screen is put together.

### Artwork

`public/images/hero.webp` is the shore painting, and swapping that file is the only step to
change it. The PNG master is in `artwork/` — versioned, but outside `public/` so it never
ships.

### Demo audio

`public/audio/NN-<slug>.mp3` — all ten tracks, 160 kbps, ~49 MB total. `AVAILABLE_DEMOS`
in [components/Landing.tsx](components/Landing.tsx) says which are playable; drop a number
to pull one back to "demo 待上传".

**Loudness standard: -16 LUFS integrated, true peak ≤ -1 dBTP.** *(last updated 2026-08-22)*

The ten tracks came from different mix/export sessions and arrived spanning -11.4 to
-27.6 LUFS — a 16 LU spread, so the player jumped from painfully loud to inaudible
between tracks. They are now all within 0.3 LU of -16.

Why these numbers, and why it matters if you re-export a track:

- **-16 LUFS**, not streaming's -14, because this album's dynamic tracks (06 at LRA 15,
  10 at LRA 13) need the extra headroom. Pushing to -14 forces real compression on them.
- **Match the target per track, don't re-normalize the set.** A new export at a different
  level will stick out again; bring it to -16 before dropping it in.
- **Normalize with linear gain + a true-peak limiter, NOT `loudnorm`'s dynamic mode.**
  ffmpeg's `loudnorm` two-pass squashed 06 from LRA 15.3 to 10.7 — it compresses toward
  its LRA target. Applying a flat `volume=NdB` and letting an oversampled `alimiter` catch
  only the peaks preserved LRA exactly on nine of ten tracks (06 lost 0.7 LU).
- **01 needs an oversampled limiter.** Its source is already clipped (+1.7 dBTP), so a
  sample-domain limiter at -1 dBFS still lands at +0.1 dBTP after MP3 encoding. Limit at
  4× oversampling with a -1.5 dBFS ceiling.
- Pre-normalization copies live at `public/audio/_original_backup/` (in this repo, so
  they ship to Vercel too — 38 MB of dead weight worth deleting once the new mixes settle)
  and outside the repo at `/Users/qliu/Qi Land/audio-originals/`.

These are 128 kbps web demos re-encoded to 160 kbps, not masters. If real WAV/AIFF masters
show up, normalize from those instead — one less generation of MP3 loss.

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
