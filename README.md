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

### Environment

Everything runs without any of these; each one turns on a feature that is
otherwise off, and off is always the honest state rather than a silent failure.

| Variable | What it turns on |
|---|---|
| `MAILERLITE_API_KEY` | The mailing list. Unset, `/api/subscribe` 503s and the form says so |
| `MAILERLITE_GROUP_ID` | Tags new subscribers into a group, so the list can be split later |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | The guestbook's store. Unset, it falls back to process memory — fine on a laptop, **not** a production mode, and screen three says so on screen |
| `GUESTBOOK_ADMIN_TOKEN` | `DELETE /api/guestbook?id=…` (send it as `x-guestbook-token`). Unset, that route 404s |
| `GUESTBOOK_SALT` | Salts the hashed IP used for guestbook rate limiting |

Upstash is reached over its REST API, so there is **no client library** — the
free tier's URL and token are the whole setup, and nothing lands in the browser
bundle.

## Routes

| URL | What it shows |
|---|---|
| `/` | **The public site.** Three screens: the shore painting with the album over it, the tracklist as a poem under water, and the floor where visitors' messages drift. The mailing list opens as a panel over any of them |
| `/descent` | The R3F 3D descent (real water, real GLB jellyfish, shipwreck). Was `/` until the 2026-07-27 launch |
| `/descent?tweak=1` | Same, with Leva sliders top-right for live sunset / sky / water / lights tuning |
| `/descent?focus=heart` | Locks depth at frame VI (the jellyfish heart). No poem overlay |
| `/descent?focus=abyss` | Locks depth at frame X (the deep). No poem overlay |
| `/preview-jelly` | Standalone GLB inspector for the Chrysaora — animations, material override, lighting test |

`/` is deliberately the light one: 141 kB First Load JS against `/descent`'s 425 kB, and it
needs no model downloads, so it holds up on a phone. (102 kB of that 141 is the React/Next
runtime every route pays; the page's own code is ~38 kB.) The 3D work isn't abandoned — it
just isn't the front door yet. See `CLAUDE.md` for how the single screen is put together.
*(Measured 2026-08-23. The old 108 kB / 5.7 kB figures here predated the two-screen rebuild
and had been stale for a while; ~2 kB of the current number is PostHog, the rest is the page.)*

### Analytics

PostHog, behind a first-party `/ingest` proxy and loaded on an idle callback so
First Load JS is unchanged. Unset `NEXT_PUBLIC_POSTHOG_KEY` and the site behaves
as if none of it were there. The event taxonomy — what is recorded, and the two
questions it exists to answer — is [ANALYTICS.md](ANALYTICS.md); see
[.env.example](.env.example) for the variables.

### Artwork

`public/images/hero.webp` is the shore painting, and swapping that file is the only step to
change it. The PNG master is in `artwork/` — versioned, but outside `public/` so it never
ships.

### Demo audio

Two ways to hear the same ten songs, and the page ships both. *(last updated 2026-08-26)*

- `public/audio/medley.mp3` — **the front door.** One chosen passage from each song, in
  sleeve order, with 1.2s of silence between them: 7:16, 8.3 MB. What HEAR THE DEMOS
  plays. Cut in `../audio-clipper/`; the chapter table lives in
  [components/medley.ts](components/medley.ts) and is generated, not hand-written.
- `public/audio/NN-<slug>.mp3` — **all ten in full**, 160 kbps, ~49 MB. What a line of the
  poem plays, and where the dim half of the seek bar leads.

The bar always draws the *whole* song and lights only the part currently loaded, so an
excerpt cannot pass itself off as a short song. Pressing the dim part fetches the full
file and continues from that exact moment — see `seekToSongFraction`.

To re-cut: `curl -X POST localhost:4611/api/medley`, copy `out/medley.mp3` and
`out/medley.ts` across, then `npm run waveform`.

`AVAILABLE_DEMOS` in [components/Landing.tsx](components/Landing.tsx) says which lines are
offered; drop a number to pull one back to "demo 待上传". Note it no longer removes the
audio — that song is still inside the medley, so genuinely withholding one means dropping
it from `clips.json` and re-bouncing.

**Loudness standard: -12 LUFS integrated, true peak <= -1 dBTP.** *(last updated 2026-08-22)*

The ten tracks came from different mix/export sessions and arrived spanning -11.4 to
-27.6 LUFS — a 16 LU spread, so the player jumped from painfully loud to inaudible
between tracks. They are now all within 0.1 LU of -12.

Why -12 and not the streaming number:

- **The site's `<audio>` player does no loudness normalization**, so the file level IS the
  playback level. Streaming services flatten everything to their own target (Spotify,
  YouTube, Tidal ≈ -14 LUFS; Apple Music Sound Check ≈ -16), which means **what you upload
  to Spotify does not change how loud it plays there** — Spotify turns a hot master back
  down. The only place a louder file actually plays louder is this site. Qi wants the site
  to sit a touch above Spotify, so -12 it is: 2 dB hotter than what a visitor's ear is
  calibrated to from their last tab.
- **-12 is where this album's own mixes already live.** 03 arrived at -11.4 and 10 at -12.3
  straight out of their sessions, so at -12 the limiter barely touches them (0.7 and 1.3 dB
  of peak clamping, LRA untouched). That makes -12 a property of the material, not a number
  imposed on it.
- **-11 is the wall.** Measured across all four candidate targets, 06 falls off a cliff past
  -12: LRA 15.3 -> 12.3 at -12, but -> 11.4 at -11, with 14.5 dB of peak clamping. Don't go hotter.

How to normalize (matters if you re-export a track):

- **Linear gain + an oversampled true-peak limiter, NOT `loudnorm`'s dynamic mode.** ffmpeg's
  `loudnorm` two-pass compresses toward its LRA target and squashed 06 from LRA 15.3 to 10.7
  for no reason. A flat `volume=NdB` into `aresample=176400,alimiter=limit=0.841,aresample=44100`
  clamps only the peaks. Iterate the gain 2-3 times, since limiting drags the integrated
  reading back down.
- **Oversample the limiter on every track at this target.** At -12 most tracks need 5-13 dB of
  peak clamping; a sample-domain limiter at -1 dBFS still overshoots to positive dBTP once MP3
  encoding adds intersample peaks. 01 is the worst case — its source is already clipped at
  +1.7 dBTP.
- **Match the target per track; don't re-normalize the set.** A new export at a different level
  will stick out again. Bring it to -12 before dropping it in.
- **Sources live outside this repo**, at `/Users/qliu/Qi Land/audio-originals/`:
  `web-demos-pre-loudness-2026-08-22/` holds the ten as they arrived, and
  `track-10-replacements/` holds later drop-ins. **Always normalize from those, never from the
  files in `public/audio/`** — relimiting already-limited audio compounds the damage.
  (A duplicate set used to sit at `public/audio/_original_backup/`, which meant Vercel served
  38 MB of unused audio publicly on every deploy. Removed 2026-08-22; still recoverable with
  `git show 171a039:public/audio/_original_backup/<file>` if the outside copies are ever lost.)

These are 128 kbps web demos re-encoded to 160 kbps, not masters. At -12 the limiter is working
hard on lossy source material, which is the real argument for redoing this from WAV/AIFF masters
if they ever surface.

## Where this repo sits

This is one project inside the **Qi Land workspace** at `/Users/qliu/Qi Land/`. The workspace contains other things (DNS notes, future recording sessions, lyrics docs) that are intentionally **NOT** in this repo. See `/Users/qliu/Qi Land/CLAUDE.md` for workspace-level context. See `CLAUDE.md` in this folder for in-repo Claude session context.

## Deploy

```
git push origin main → GitHub heartofjellyfish/The-Heart-of-the-Jellyfish → Vercel auto-build → live
```

Default branch is `main`. No PR workflow — push directly.

## The jellyfish mark

`components/JellyMark.tsx` is the jellyfish off the hero painting, redrawn as vector and animated
to swim. It is self-contained and reusable — import the component, give the wrapper a width and a
height, and append `JELLY_MARK_CSS` to the route's own style block:

```tsx
<JellyMark className="l-sub-wink" />                                  /* .l-sub-wink{width;height} */
<style dangerouslySetInnerHTML={{ __html: ROUTE_CSS + JELLY_MARK_CSS }} />
```

It is drawn rather than typed because 🪼 is Emoji 14 (2021) and falls to a tofu box on older
fonts. The file's comments carry the two findings that cost the most to arrive at: why the bell
has to be a single path (two translucent shapes sharing an edge always show the join, and
overlapping them stacks the alpha instead), and why the two largest motions sit on the HTML box
rather than on groups inside the SVG (transforms on SVG children are not composited).

## Adding 3D assets

Drop the GLB at `public/models/<name>/model.glb`. For anything > 5 MB, gate loading on the depth ref so first paint stays fast — see `WreckGate` pattern in `components/OceanScene.tsx`. Add the credit line to `CREDITS.md` if the source requires it.

## Credits

- Music, lyrics, art direction — **Qi · 琦**
- Three.js Water shader — three.js examples (MIT)
- Sky atmospheric scattering — Preetham model via drei
- Chrysaora jellyfish model — Pacific Sea Nettle by NestaEric on Sketchfab
- Other asset credits in [CREDITS.md](CREDITS.md)
