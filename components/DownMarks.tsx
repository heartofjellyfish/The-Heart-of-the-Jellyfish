'use client';

/**
 * Five candidate "scroll down" marks for screen one, plus the one that ships,
 * so they can be judged against each other in place.
 *
 * TEMPORARY. Behind `/?down=1`, renders for nobody else, and the whole file
 * goes once Qi picks — the winner moves into Landing.tsx and LANDING_CSS.
 *
 * The brief was that a lone hairline chevron disappears against the bottom of
 * this painting, which is sea and foam. The brief was NOT that it should get
 * heavier: the page is 1px rules and letterspaced caps everywhere, and a solid
 * arrow would be the only fat thing on it. So every candidate below is still a
 * hairline, and each buys its visibility a different way —
 *
 *   1  a moving object on the line        (something falls down it)
 *   2  area, repeated                     (rings leave the centre)
 *   3  a closed shape                     (a ring, kin to the play button)
 *   4  an organic silhouette              (a tentacle, drifting)
 *   5  length                             (a rule most of the screen wide)
 *
 * Motion is doing most of the work in all five, which is why they cannot be
 * judged from a screenshot.
 */

import React from 'react';

export const DOWN_VARIANTS = [
  { key: '0', label: '0 · current' },
  { key: '1', label: '1 · sounding line' },
  { key: '2', label: '2 · ripple' },
  { key: '3', label: '3 · ring' },
  { key: '4', label: '4 · tentacle' },
  { key: '5', label: '5 · tide line' },
] as const;

export type DownVariant = (typeof DOWN_VARIANTS)[number]['key'];

/** The shared chevron. One shape, so the five differ in idea and not in drawing. */
function Chev({ w = 30 }: { w?: number }) {
  return (
    <svg
      className="dm-chev"
      width={w}
      height={(w / 30) * 12}
      viewBox="0 0 30 12"
      aria-hidden
    >
      <path
        d="M1 1l14 10 14-10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function DownMark({ v }: { v: DownVariant }) {
  /* 1 — THE SOUNDING LINE.
     A plumb falls down a hairline, over and over. The album's own instrument:
     a sounding line is how you measure how deep the water is, and this site
     already calls its seek bar one. The moving object is what you see; the
     line only tells it where to go. */
  if (v === '1') {
    return (
      <span className="dm1">
        <span className="dm1-rail" />
        <span className="dm1-weight" />
      </span>
    );
  }

  /* 2 — THE RIPPLE.
     Three rings leave the centre and fade, on a stagger, the way water answers
     something dropped into it. Visibility from area rather than from weight:
     nothing here is thicker than 1px, but at any instant something 80px wide
     is moving. */
  if (v === '2') {
    return (
      <span className="dm2">
        <i />
        <i />
        <i />
        <Chev w={22} />
      </span>
    );
  }

  /* 3 — THE RING.
     A small sibling of the LISTEN button, breathing. The one candidate that is
     a closed shape, which is the cheapest visibility there is — and the only
     one already in the page's vocabulary, so it reads as a system rather than
     as an ornament. Fills on hover exactly as its big brother does. */
  if (v === '3') {
    return (
      <span className="dm3">
        <Chev w={17} />
      </span>
    );
  }

  /* 4 — THE TENTACLE.
     The creature's own line, drifting. It sways from its anchor, and a short
     bright dash travels down the curve — a stroke-dashoffset animation, so the
     light follows the bend instead of falling past it. The album is named after
     the animal; this is the only candidate that says so. */
  if (v === '4') {
    return (
      <span className="dm4">
        <svg width="26" height="104" viewBox="0 0 26 104" aria-hidden>
          <path
            className="dm4-base"
            d="M13 0c-9 13 9 26 0 39s9 26 0 39 5 20 0 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <path
            className="dm4-lit"
            d="M13 0c-9 13 9 26 0 39s9 26 0 39 5 20 0 26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
        <span className="dm4-tip" />
      </span>
    );
  }

  /* 5 — THE TIDE LINE.
     A rule most of the screen wide, riding up and down a few pixels, with a
     swell travelling along it. Track 01 is "Sea rising"; this is that, as an
     invitation. Impossible to miss because it is 420px long — and it can be,
     precisely because it is 1px tall. */
  if (v === '5') {
    return (
      <span className="dm5">
        <span className="dm5-line">
          <span className="dm5-swell" />
        </span>
        <Chev w={26} />
      </span>
    );
  }

  /* 0 — what ships today. Here to be beaten. */
  return (
    <span className="dm0">
      <span className="dm0-rail">
        <span className="dm0-drop" />
      </span>
      <Chev w={30} />
    </span>
  );
}

export const DOWN_CSS = `
/* Neutralise the shipping mark's own box so each candidate can size itself. */
.landing .l-down[data-v]{gap:0;padding:12px 26px;animation:none}
.landing .l-down[data-v='0']{animation:l-down-in 1.2s cubic-bezier(.2,.7,.2,1) 1.15s backwards,
  l-down-bob 3.2s ease-in-out 2.35s infinite}
.dm-chev{display:block;filter:drop-shadow(0 1px 2px rgba(10,42,70,.55)) drop-shadow(0 0 10px rgba(10,42,70,.45))}

/* 0 — current */
.dm0{display:flex;flex-direction:column;align-items:center;gap:clamp(8px,1.2vh,13px)}
.dm0-rail{position:relative;display:block;width:1px;height:clamp(34px,6.4vh,66px);overflow:hidden;
  background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.55) 55%,rgba(255,255,255,.68));
  box-shadow:0 0 7px rgba(10,42,70,.55)}
.dm0-drop{position:absolute;left:0;top:0;width:1px;height:44%;
  background:linear-gradient(180deg,transparent,#fff,transparent);
  animation:l-down-drop 3.6s cubic-bezier(.45,0,.55,1) infinite}

/* 1 — sounding line */
.dm1{--h:clamp(70px,10vh,116px);position:relative;display:block;width:16px;height:var(--h)}
.dm1-rail{position:absolute;left:50%;top:0;bottom:0;width:1px;transform:translateX(-50%);
  background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.42) 30%,rgba(255,255,255,.55));
  box-shadow:0 0 7px rgba(10,42,70,.5)}
/* The plumb. A diamond, not a circle: a circle on a line is a slider handle and
   this is not a control you drag. */
.dm1-weight{position:absolute;left:50%;top:0;width:9px;height:9px;margin-left:-4.5px;
  background:#fff;border-radius:1.5px;
  box-shadow:0 0 11px rgba(10,42,70,.6);
  animation:dm1-drop 3.8s cubic-bezier(.5,0,.5,1) infinite}
@keyframes dm1-drop{
  0%{transform:translateY(-4px) rotate(45deg) scale(.4);opacity:0}
  12%{transform:translateY(2px) rotate(45deg) scale(1);opacity:1}
  70%{opacity:1}
  100%{transform:translateY(calc(var(--h) - 8px)) rotate(45deg) scale(.75);opacity:0}
}
.l-down:hover .dm1-rail{background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.6) 30%,rgba(255,255,255,.8))}

/* 2 — ripple */
.dm2{position:relative;display:flex;align-items:center;justify-content:center;
  width:96px;height:96px;color:#fff}
.dm2 i{position:absolute;left:50%;top:50%;width:92px;height:92px;margin:-46px 0 0 -46px;
  border:1px solid rgba(255,255,255,.85);border-radius:50%;opacity:0;
  animation:dm2-ring 3.9s cubic-bezier(.22,.6,.3,1) infinite}
.dm2 i:nth-child(2){animation-delay:1.3s}
.dm2 i:nth-child(3){animation-delay:2.6s}
@keyframes dm2-ring{
  0%{transform:scale(.16);opacity:0}
  14%{opacity:.8}
  100%{transform:scale(1);opacity:0}
}
.dm2 .dm-chev{position:relative;z-index:1}

/* 3 — ring */
.dm3{position:relative;display:flex;align-items:center;justify-content:center;
  width:clamp(44px,3.6vw,58px);height:clamp(44px,3.6vw,58px);border-radius:50%;
  border:1px solid rgba(255,255,255,.55);color:#fff;
  box-shadow:0 0 14px rgba(10,42,70,.35);
  animation:dm3-breathe 3.6s ease-in-out infinite;
  transition:background .4s cubic-bezier(.2,.8,.2,1),color .4s,border-color .4s}
@keyframes dm3-breathe{
  0%,100%{transform:scale(1);border-color:rgba(255,255,255,.48)}
  50%{transform:scale(1.075);border-color:rgba(255,255,255,.95)}
}
.dm3 .dm-chev{margin-top:1px}
.l-down:hover .dm3{background:#fff;border-color:#fff;color:#0d3550}
.l-down:hover .dm3 .dm-chev{filter:none}

/* 4 — tentacle */
.dm4{position:relative;display:block;width:26px;height:104px;color:#fff;
  transform-origin:50% 0;
  animation:dm4-sway 5.6s ease-in-out infinite alternate}
@keyframes dm4-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}
.dm4 svg{display:block;overflow:visible;
  filter:drop-shadow(0 1px 2px rgba(10,42,70,.5)) drop-shadow(0 0 9px rgba(10,42,70,.4))}
.dm4-base{opacity:.38}
/* A short bright dash running down the curve. The path is ~112 units long, so
   one dash and one very long gap put exactly one travelling segment on it. */
.dm4-lit{opacity:.95;stroke-dasharray:16 200;stroke-dashoffset:16;
  animation:dm4-run 3.4s cubic-bezier(.5,0,.55,1) infinite}
@keyframes dm4-run{
  0%{stroke-dashoffset:16;opacity:0}
  12%{opacity:.95}
  78%{opacity:.95}
  100%{stroke-dashoffset:-124;opacity:0}
}
.dm4-tip{position:absolute;left:50%;bottom:-3px;width:5px;height:5px;margin-left:-2.5px;
  border-radius:50%;background:#fff;box-shadow:0 0 10px rgba(10,42,70,.55);
  animation:dm4-tip 2.9s ease-in-out infinite alternate}
@keyframes dm4-tip{from{transform:translate(-1px,0) scale(.85)}to{transform:translate(1px,3px) scale(1)}}

/* 5 — tide line */
.dm5{display:flex;flex-direction:column;align-items:center;gap:13px;color:#fff;
  animation:dm5-tide 5.4s ease-in-out infinite alternate}
@keyframes dm5-tide{from{transform:translateY(3px)}to{transform:translateY(-3px)}}
.dm5-line{position:relative;display:block;height:1px;width:clamp(220px,34vw,440px);
  overflow:hidden;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.5) 22%,rgba(255,255,255,.5) 78%,transparent);
  box-shadow:0 0 8px rgba(10,42,70,.45)}
.dm5-swell{position:absolute;top:0;left:0;height:1px;width:34%;
  background:linear-gradient(90deg,transparent,#fff,transparent);
  animation:dm5-swell 4.6s cubic-bezier(.45,0,.55,1) infinite}
@keyframes dm5-swell{
  0%{transform:translateX(-110%);opacity:0}
  18%{opacity:1}
  82%{opacity:1}
  100%{transform:translateX(330%);opacity:0}
}
.l-down:hover .dm5-line{background:linear-gradient(90deg,transparent,rgba(255,255,255,.75) 22%,rgba(255,255,255,.75) 78%,transparent)}

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
