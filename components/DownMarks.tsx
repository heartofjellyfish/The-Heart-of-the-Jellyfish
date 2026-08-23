'use client';

/**
 * Five candidate "scroll down" marks for screen one, plus the one that ships.
 *
 * TEMPORARY. Behind `/?down=1`, renders for nobody else, and the whole file
 * goes once Qi picks — the winner moves into Landing.tsx and LANDING_CSS.
 *
 * Three rounds, and the two wrong turns are the useful part:
 *
 *   1. Five hairlines. Too thin to see — twice. The page IS 1px rules
 *      everywhere, but a rule you are meant to notice and a rule that is
 *      structure are not the same job.
 *   2. Five in ink, on the reasoning that white cannot win on a light ground.
 *      True as physics and wrong as design: 抢眼. A dark mark is the darkest
 *      thing in the lower half of a painting whose whole lower half is light,
 *      so it stops being an invitation and becomes an object.
 *
 * What survives from both: the SIZE and WEIGHT of round two, in the WHITE of
 * round one. Nothing here is under 2.2px or under 44px, and everything is the
 * page's own colour. Visibility now comes from mass and from motion instead of
 * from contrast — plus the same tight dark halo every other white mark on this
 * painting already carries, which is the thing a 1px rule was too small to hold.
 *
 * The tone toggle stays in the picker so the ink version is one click away
 * rather than one argument away.
 *
 *   1  ring            outlined circle, 2px, breathing — LISTEN's geometry
 *   2  disc            the same circle, filled — the loudest of the five
 *   3  arrow           shaft and head, 2.6px — the thing asked for at the start
 *   4  double chevron  no container at all, light running from one to the other
 *   5  pill            gives up on being a symbol and says DESCEND
 */

import React from 'react';

export const DOWN_VARIANTS = [
  { key: '0', label: '0 · current' },
  { key: '1', label: '1 · ring' },
  { key: '2', label: '2 · disc' },
  { key: '3', label: '3 · arrow' },
  { key: '4', label: '4 · double chevron' },
  { key: '5', label: '5 · pill' },
] as const;

export const DOWN_TONES = [
  { key: 'white', label: 'WHITE' },
  { key: 'ink', label: 'INK' },
] as const;

export type DownVariant = (typeof DOWN_VARIANTS)[number]['key'];
export type DownTone = (typeof DOWN_TONES)[number]['key'];

/** The chevron the containers hold. Weight is a prop: a chevron inside a 54px
 *  ring and a chevron standing on its own do not want the same stroke. */
function Chev({ w = 22, sw = 2.2 }: { w?: number; sw?: number }) {
  return (
    <svg className="dm-chev" width={w} height={(w / 30) * 13} viewBox="0 0 30 13" aria-hidden>
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
  /* 1 — RING.
     The same geometry as the LISTEN button one line above, at half its size, so
     it reads as the page's own vocabulary rather than as a new object. 2px
     rather than 1: a 1px ring at 54px is 0.4% of its own area in ink, which is
     the arithmetic that made round one invisible. Breathes, and inverts on
     hover exactly as its big brother does. */
  if (v === '1') {
    return (
      <span className="dm1">
        <Chev w={21} sw={2.3} />
      </span>
    );
  }

  /* 2 — DISC.
     The same circle, filled. The loudest candidate by a distance — it is the
     only solid white shape in the lower half of the frame — which is either
     exactly the confidence the invitation needs or one step too far. It is here
     to mark that edge. */
  if (v === '2') {
    return (
      <span className="dm2">
        <Chev w={21} sw={2.3} />
      </span>
    );
  }

  /* 3 — ARROW.
     Not a chevron: a shaft with a head, which is the thing actually asked for
     at the start. The shaft is what the round-one rail was, thickened until it
     stops being structure and starts being a mark. */
  if (v === '3') {
    return (
      <span className="dm3">
        <svg width="30" height="72" viewBox="0 0 30 72" aria-hidden>
          <path d="M15 3v52" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
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
     No container at all — two marks and nothing else, which is the least
     furniture of the five. The brightness runs from the upper to the lower and
     starts again, so the pair points by moving rather than by being drawn
     pointing. The one candidate whose visibility is almost entirely motion. */
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

  /* 5 — PILL.
     Gives up on being a symbol and says the word. Outlined at 1px like PRE-SAVE
     rather than filled, so the two calls to action on screen one are built the
     same way. The word is the album's own — the R3F telling of this story lives
     at /descent. Cannot be missed or misread; the cost is that it is the most
     UI-looking object on the page. */
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
/* One place the tone is decided, so the five candidates are about FORM and the
   white-versus-ink question is answered once for all of them. White is the
   page's colour and the default; ink stays reachable because it is a real
   option on a light ground, just a loud one. */
.landing .l-down[data-v]{
  --dm-mark:#fff;
  --dm-fill:rgba(255,255,255,.94);
  --dm-on-fill:#0c2b45;
  --dm-line:rgba(255,255,255,.72);
  /* The halo every white mark on this painting already carries. Tight, or it
     stops being light and becomes the patch of grey we took out from behind
     the arrow. */
  --dm-halo:drop-shadow(0 1px 2px rgba(10,42,70,.55)) drop-shadow(0 0 10px rgba(10,42,70,.45));
  --dm-solid-shadow:0 8px 26px rgba(6,26,44,.3);
  gap:0;padding:12px 26px;
  animation:l-down-in 1.2s cubic-bezier(.2,.7,.2,1) 1.15s backwards,
            l-down-bob 3.4s ease-in-out 2.35s infinite}
/* Ink flips the halo as well as the mark: light around a dark mark is the
   inverse of every other shadow on this page, and the only version that works. */
.landing .l-down[data-tone='ink']{
  --dm-mark:#0c2b45;
  --dm-fill:rgba(12,43,69,.88);
  --dm-on-fill:#fff;
  --dm-line:rgba(12,43,69,.8);
  --dm-halo:drop-shadow(0 0 5px rgba(255,255,255,.7)) drop-shadow(0 0 14px rgba(255,255,255,.45));
  --dm-solid-shadow:0 0 0 1px rgba(255,255,255,.26),0 10px 30px rgba(6,26,44,.34)}
.dm-chev{display:block}

/* 0 — current */
.dm0{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.2vh,13px);color:#fff}
.dm0 .dm-chev{filter:var(--dm-halo)}
.dm0-rail{position:relative;display:block;width:1px;height:clamp(34px,6.4vh,66px);overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.55) 55%,rgba(255,255,255,.68));
  box-shadow:0 0 7px rgba(10,42,70,.55)}
.dm0-drop{position:absolute;left:0;top:0;width:1px;height:44%;
  background:linear-gradient(180deg,transparent,#fff,transparent);
  animation:l-down-drop 3.6s cubic-bezier(.45,0,.55,1) infinite}

/* 1 — ring */
.dm1{display:flex;align-items:center;justify-content:center;
  width:clamp(48px,3.8vw,58px);height:clamp(48px,3.8vw,58px);border-radius:50%;
  border:2px solid var(--dm-line);color:var(--dm-mark);
  filter:var(--dm-halo);
  animation:dm1-breathe 3.6s ease-in-out infinite;
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,border-color .4s}
@keyframes dm1-breathe{
  0%,100%{transform:scale(1);opacity:.86}
  50%{transform:scale(1.06);opacity:1}
}
.dm1 .dm-chev{margin-top:2px}
.l-down:hover .dm1{background:var(--dm-mark);color:var(--dm-on-fill);border-color:var(--dm-mark)}

/* 2 — disc */
.dm2{display:flex;align-items:center;justify-content:center;
  width:clamp(48px,3.8vw,58px);height:clamp(48px,3.8vw,58px);border-radius:50%;
  background:var(--dm-fill);color:var(--dm-on-fill);
  box-shadow:var(--dm-solid-shadow);
  transition:transform .4s cubic-bezier(.2,.8,.2,1),box-shadow .4s}
.dm2 .dm-chev{margin-top:2px}
.l-down:hover .dm2{transform:scale(1.06);box-shadow:0 12px 32px rgba(6,26,44,.42)}

/* 3 — arrow */
.dm3{display:block;color:var(--dm-mark)}
.dm3 svg{display:block;filter:var(--dm-halo)}

/* 4 — double chevron */
.dm4{display:flex;flex-direction:column;align-items:center;gap:9px;color:var(--dm-mark)}
.dm4 svg{filter:var(--dm-halo)}
/* Offset rather than delayed, so the two are never both bright and never both
   dim — the pair reads as one mark travelling, not two marks blinking. */
.dm4-a{animation:dm4-lead 2.6s ease-in-out infinite}
.dm4-b{animation:dm4-lead 2.6s ease-in-out infinite;animation-delay:.42s}
@keyframes dm4-lead{
  0%,100%{opacity:.34;transform:translateY(0)}
  30%{opacity:1;transform:translateY(2px)}
  60%{opacity:.34;transform:translateY(0)}
}

/* 5 — pill */
.dm5{display:flex;align-items:center;gap:11px;
  padding:12px 22px;border-radius:999px;
  border:1px solid var(--dm-line);color:var(--dm-mark);
  text-shadow:0 1px 2px rgba(10,42,70,.55),0 0 10px rgba(10,42,70,.4);
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,border-color .4s}
.dm5-word{font-family:'Jost',sans-serif;font-weight:400;font-size:11px;letter-spacing:.34em}
.dm5 .dm-chev{margin-top:1px}
.l-down:hover .dm5{background:var(--dm-mark);color:var(--dm-on-fill);border-color:var(--dm-mark);
  text-shadow:none}

/* The picker. Dev chrome, same key as the tuner's. */
.dm-pick{position:fixed;right:18px;bottom:18px;z-index:40;
  display:flex;flex-direction:column;gap:6px;align-items:stretch;
  padding:12px 14px;border-radius:4px;
  background:rgba(6,26,44,.9);backdrop-filter:blur(8px);
  font-family:'Jost',sans-serif;font-weight:300;font-size:11px;letter-spacing:.1em}
.dm-pick-head{font-size:9px;letter-spacing:.3em;opacity:.45;margin-bottom:2px}
.dm-pick-row{display:flex;gap:6px}
.dm-pick-row button{flex:1}
.landing .dm-pick button{background:none;border:1px solid rgba(255,255,255,.24);
  color:#dfeaf1;padding:7px 12px;border-radius:3px;cursor:pointer;text-align:left;
  font-size:11px;letter-spacing:.08em;white-space:nowrap;transition:background .2s}
.landing .dm-pick-row button{text-align:center;letter-spacing:.16em;font-size:10px}
.landing .dm-pick button:hover{background:rgba(255,255,255,.08)}
.landing .dm-pick .dm-on{background:var(--lit-dim);border-color:var(--lit);color:#fff}
`;
