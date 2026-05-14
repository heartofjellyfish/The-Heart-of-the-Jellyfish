# The Heart of the Jellyfish

Site for the debut album by **Qi · 琦** — *The Heart of the Jellyfish* (releasing **2026.12.20**). Ten songs that, read in order, form a poem.

The site is a single scroll-driven 3D descent: you start above the sea, fall through the surface, drift down past the jellyfish at the center, and sink into the abyss.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **React Three Fiber** + **drei** + **three.js**
  - `three/examples/jsm/objects/Water.js` for the real-time water surface (waves + reflection + sun specular)
  - `<Sky>` from drei for the atmospheric scattering sky
  - Custom GLSL for god rays, marine snow, jellyfish tentacles
- **Tailwind CSS** for the typographic overlay
- Deployed on **Vercel**

## Local dev

```bash
npm install
npm run dev
```

Opens at http://localhost:3000.

Useful URLs:
- `/` — full scroll-driven descent
- `/?focus=heart` — locks depth at frame VI (the heart of the jellyfish)
- `/?focus=abyss` — locks depth at frame X (the abyss)

## Status

Early prototype. The jellyfish is currently procedural and will be swapped for a real GLB model. The poem layout, water surface, sky, and scroll-driven camera descent are wired up.

## Credits

- Music, lyrics, art direction: Qi · 琦
- Three.js Water shader: Jérôme Etienne / three.js examples
- Sky atmospheric scattering: based on Preetham model via drei
