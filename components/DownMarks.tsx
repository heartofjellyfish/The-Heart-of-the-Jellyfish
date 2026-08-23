'use client';

/**
 * Five candidate "scroll down" marks for screen one, plus the one that ships.
 *
 * TEMPORARY. Behind `/?down=1`, renders for nobody else, and the whole file
 * goes once Qi picks — the winner moves into Landing.tsx and LANDING_CSS.
 *
 * ROUND TWO. The first five were all hairlines, on the argument that the page
 * is 1px rules everywhere and a heavy arrow would be the only fat thing on it.
 * Qi: 都太细了，看不清楚 — twice now, which means the argument was wrong.
 *
 * And it was wrong for a reason worth keeping: **the problem was never weight,
 * it was value.** The bottom of this painting is sky-blue water and pale foam —
 * one of the lightest grounds in the whole frame — and every mark I made was
 * white. No amount of thickening fixes white on light; it just makes a bigger
 * invisible thing. The painting itself already answers it: the only marks that
 * read down there are the jellyfish's tentacles, and they are dark.
 *
 * So four of these five are INK, and they carry a soft white halo rather than a
 * dark one — light around a dark mark is what sets it on the surface instead of
 * pasting it over. The fifth is the same idea inverted (solid white, dark
 * chevron), because a solid white disc reads on that water too and matches the
 * page's white type. Nothing here is under 2.2px or under 44px.
 *
 *   1  ink disc        solid dark circle, white chevron
 *   2  white disc      the same, inverted
 *   3  ink arrow       an actual arrow — shaft and head — in dark ink
 *   4  double chevron  two heavy chevrons, no container, light running down
 *   5  ink pill        a dark capsule with a word in it
 */

import React from 'react';

export const DOWN_VARIANTS = [
  { key: '0', label: '0 · current' },
  { key: '1', label: '1 · ink disc' },
  { key: '2', label: '2 · white disc' },
  { key: '3', label: '3 · ink arrow' },
  { key: '4', label: '4 · double chevron' },
  { key: '5', label: '5 · ink pill' },
] as const;

export type DownVariant = (typeof DOWN_VARIANTS)[number]['key'];

/** The chevron the containers hold. Weight is a prop because a chevron inside a
 *  54px disc and a chevron standing on its own do not want the same stroke. */
function Chev({ w = 22, sw = 2.2 }: { w?: number; sw?: number }) {
  return (
    <svg
      className="dm-chev"
      width={w}
      height={(w / 30) * 13}
      viewBox="0 0 30 13"
      aria-hidden
    >
      <path
        d="M1.6 1.6L15 11.4 28.4 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownMark({ v }: { v: DownVariant }) {
  /* 1 — INK DISC.
     Solid, dark, and the same geometry as the LISTEN button one line above, so
     it reads as the page's own vocabulary rather than as a new object. Filled
     rather than outlined because a 1px ring on this water is the problem we are
     leaving behind. Inverts on hover, exactly as its big brother does. */
  if (v === '1') {
    return (
      <span className="dm1">
        <Chev w={21} sw={2.3} />
      </span>
    );
  }

  /* 2 — WHITE DISC.
     The same idea with the values swapped. Solid white reads on this water too,
     and it agrees with the type, which is all white — the cost is that it is the
     brightest thing in the lower half of the frame, where the ink disc is the
     darkest. Worth seeing both before deciding which the painting can carry. */
  if (v === '2') {
    return (
      <span className="dm2">
        <Chev w={21} sw={2.3} />
      </span>
    );
  }

  /* 3 — INK ARROW.
     Not a chevron: a shaft with a head, which is the thing that was actually
     asked for at the start. In ink, at 2.6px, with a white glow around it —
     light around a dark mark, which is the inverse of every shadow on this page
     and the only version that works on a light ground. */
  if (v === '3') {
    return (
      <span className="dm3">
        <svg width="30" height="72" viewBox="0 0 30 72" aria-hidden>
          <path
            d="M15 3v52"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M4.5 46.5L15 57.5 25.5 46.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }

  /* 4 — DOUBLE CHEVRON.
     No container at all — just two heavy marks, which is the least furniture of
     the five. The brightness runs from the top one to the bottom one and back,
     so the pair points by moving rather than by being drawn pointing. */
  if (v === '4') {
    return (
      <span className="dm4">
        <span className="dm4-a">
          <Chev w={46} sw={3} />
        </span>
        <span className="dm4-b">
          <Chev w={46} sw={3} />
        </span>
      </span>
    );
  }

  /* 5 — INK PILL.
     The one that gives up on being purely a symbol and says the word. Nothing
     here can be missed or misread, and the word is the album's own — the R3F
     telling of this story lives at /descent. The cost is that it is the most
     UI-looking object on the page; the gain is that it is the only candidate a
     visitor cannot fail to understand. */
  if (v === '5') {
    return (
      <span className="dm5">
        <span className="dm5-word">DESCEND</span>
        <Chev w={16} sw={2.4} />
      </span>
    );
  }

  /* 0 — what ships today. Here to be beaten. */
  return (
    <span className="dm0">
      <span className="dm0-rail">
        <span className="dm0-drop" />
      </span>
      <Chev w={30} sw={1.25} />
    </span>
  );
}

export const DOWN_CSS = `
/* Neutralise the shipping mark's own box so each candidate can size itself.
   The bob stays on all of them: motion is still the cheapest visibility there
   is, and now it is carrying a mark you can already see rather than making up
   for one you cannot. */
.landing .l-down[data-v]{gap:0;padding:12px 26px;
  animation:l-down-in 1.2s cubic-bezier(.2,.7,.2,1) 1.15s backwards,
            l-down-bob 3.4s ease-in-out 2.35s infinite}
.dm-chev{display:block}

/* --- the ink, and the light that sets it on the surface ---
   #0c2b45 is the painting's own dark, off the tentacles. The halo is WHITE and
   tight: a dark mark on a light ground needs light around it for exactly the
   reason a white mark needs dark, and this page's every other shadow is the
   other way round. Wide and it becomes fog; tight and it becomes an edge. */
.dm-ink{color:#0c2b45}

/* 0 — current */
.dm0{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.2vh,13px);color:#fff}
.dm0 .dm-chev{filter:drop-shadow(0 1px 2px rgba(10,42,70,.55)) drop-shadow(0 0 10px rgba(10,42,70,.45))}
.dm0-rail{position:relative;display:block;width:1px;height:clamp(34px,6.4vh,66px);overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.55) 55%,rgba(255,255,255,.68));
  box-shadow:0 0 7px rgba(10,42,70,.55)}
.dm0-drop{position:absolute;left:0;top:0;width:1px;height:44%;
  background:linear-gradient(180deg,transparent,#fff,transparent);
  animation:l-down-drop 3.6s cubic-bezier(.45,0,.55,1) infinite}

/* 1 — ink disc */
.dm1{display:flex;align-items:center;justify-content:center;
  width:clamp(50px,4vw,60px);height:clamp(50px,4vw,60px);border-radius:50%;
  background:rgba(12,43,69,.88);color:#fff;
  box-shadow:0 0 0 1px rgba(255,255,255,.26),0 10px 30px rgba(6,26,44,.34);
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,box-shadow .4s}
.dm1 .dm-chev{margin-top:2px}
.l-down:hover .dm1{background:#fff;color:#0c2b45;
  box-shadow:0 0 0 1px rgba(12,43,69,.3),0 12px 34px rgba(6,26,44,.4)}

/* 2 — white disc */
.dm2{display:flex;align-items:center;justify-content:center;
  width:clamp(50px,4vw,60px);height:clamp(50px,4vw,60px);border-radius:50%;
  background:rgba(255,255,255,.93);color:#0c2b45;
  box-shadow:0 8px 26px rgba(6,26,44,.3);
  transition:background .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s}
.dm2 .dm-chev{margin-top:2px}
.l-down:hover .dm2{background:#fff;box-shadow:0 12px 32px rgba(6,26,44,.42)}

/* 3 — ink arrow */
.dm3{display:block;color:#0c2b45}
.dm3 svg{display:block;
  filter:drop-shadow(0 0 5px rgba(255,255,255,.7)) drop-shadow(0 0 14px rgba(255,255,255,.45))}
.l-down:hover .dm3{color:#06203a}

/* 4 — double chevron */
.dm4{display:flex;flex-direction:column;align-items:center;gap:9px;color:#0c2b45}
.dm4 svg{filter:drop-shadow(0 0 5px rgba(255,255,255,.7)) drop-shadow(0 0 14px rgba(255,255,255,.4))}
/* The light runs top to bottom and starts again — the pair points by moving.
   Offset by half the cycle rather than by a delay, so the two are never both
   bright and never both dim. */
.dm4-a{animation:dm4-lead 2.6s ease-in-out infinite}
.dm4-b{animation:dm4-lead 2.6s ease-in-out infinite;animation-delay:.42s}
@keyframes dm4-lead{
  0%,100%{opacity:.38;transform:translateY(0)}
  30%{opacity:1;transform:translateY(2px)}
  60%{opacity:.38;transform:translateY(0)}
}

/* 5 — ink pill */
.dm5{display:flex;align-items:center;gap:11px;
  padding:12px 22px;border-radius:999px;
  background:rgba(12,43,69,.88);color:#fff;
  box-shadow:0 0 0 1px rgba(255,255,255,.24),0 10px 30px rgba(6,26,44,.34);
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s}
.dm5-word{font-family:'Jost',sans-serif;font-weight:400;font-size:11px;letter-spacing:.34em}
.dm5 .dm-chev{margin-top:1px}
.l-down:hover .dm5{background:#fff;color:#0c2b45}

/* The picker. Dev chrome, same key as the tuner's. */
.dm-pick{position:fixed;right:18px;bottom:18px;z-index:40;
  display:flex;flex-direction:column;gap:6px;align-items:stretch;
  padding:12px 14px;border-radius:4px;
  background:rgba(6,26,44,.9);backdrop-filter:blur(8px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11px;letter-spacing:.1em}
.dm-pick-head{font-size:9px;letter-spacing:.3em;opacity:.45;margin-bottom:2px}
.landing .dm-pick button{background:none;border:1px solid rgba(255,255,255,.24);
  color:#dfeaf1;padding:7px 12px;border-radius:3px;cursor:pointer;text-align:left;
  font-size:11px;letter-spacing:.08em;white-space:nowrap;transition:background .2s}
.landing .dm-pick button:hover{background:rgba(255,255,255,.08)}
.landing .dm-pick .dm-on{background:var(--lit-dim);border-color:var(--lit);color:#fff}
`;
