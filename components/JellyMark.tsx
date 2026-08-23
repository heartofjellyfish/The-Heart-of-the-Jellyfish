/**
 * The jellyfish off the hero painting (artwork/hero_oil.png), redrawn as vector:
 * a low translucent bell, the ochre spots, a few tentacles adrift.
 *
 * It exists because the line it sits in -- "follow thy heart" -- needs the wink
 * the ";)" used to give it, and a picture of THIS animal argues where a wink
 * only apologised: the heart in the line is the jellyfish's, not the greeting
 * card's. Drawn rather than typed because the emoji is Emoji 14 (2021) and
 * falls to a tofu box on anything older, and no font fallback fixes that
 * without shipping a colour-font subset; a vector we own has no font behind it
 * to be missing, so it is the same animal on every phone and every desktop.
 *
 * Usage -- give the wrapper a width and a height, and nothing else:
 *
 *     <JellyMark className="l-sub-wink" />        // .l-sub-wink{width;height}
 *     <style>{`${JELLY_MARK_CSS}`}</style>        // once per route
 *
 * It is decoration, so it is aria-hidden and carries no text alternative. If it
 * ever has to mean something, the meaning belongs in the copy beside it.
 *
 * See the CSS below for how it swims -- the timing is the whole trick.
 */
export function JellyMark({ className }: { className?: string }) {
  return (
    <span className={className ? 'l-jelly ' + className : 'l-jelly'} aria-hidden>
      <svg viewBox="0 0 64 74" aria-hidden focusable="false">
        <defs>
          <linearGradient id="l-jelly-bell-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".97" />
            <stop offset="55%" stopColor="#eaf3f9" stopOpacity=".9" />
            <stop offset="100%" stopColor="#c3dcec" stopOpacity=".72" />
          </linearGradient>
        </defs>
        {/* Behind the bell so the skirt hides the attachments. They do not sway
            together -- each swings from its own root, and --fan is signed by which
            side of the axis (x=32) that root is on, so the whole set closes and
            opens as one fan. The group around them adds a slow drift of its own,
            off the beat: trailing hair in moving water is never still, and it is
            what keeps the glide from reading as a freeze. */}
        <g className="l-jelly-trail">
          <g stroke="#e7f2f8" strokeLinecap="round" fill="none">
            <path className="l-jelly-t l-jelly-t1" d="M22 39 C19 50 25 56 21 68" strokeWidth="1.8" opacity=".55" />
            <path className="l-jelly-t l-jelly-t2" d="M33 40 C31 52 38 58 33 72" strokeWidth="2" opacity=".6" />
            <path className="l-jelly-t l-jelly-t3" d="M44 39 C43 50 48 55 44 66" strokeWidth="1.7" opacity=".5" />
            <path className="l-jelly-t l-jelly-t4" d="M27 39 C26 48 30 53 27 61" strokeWidth="1.2" opacity=".35" />
            <path className="l-jelly-t l-jelly-t5" d="M38 39 C38 47 41 51 39 58" strokeWidth="1.1" opacity=".32" />
          </g>
        </g>
        {/* One path, not a dome plus a separate skirt. Splitting it let the margin
            run late, but two translucent shapes meeting along a shared edge always
            show it: each side is antialiased to about half coverage and the two
            halves do not add back to one, so a hairline opens along the join --
            and overlapping them instead stacks the alpha into a dark band, so
            there is no version of the split that survives being looked at large.
            The wave down the bell is worth having, the seam is not, so it comes
            from the transform origin instead: scaling about a point up near the
            apex leaves the top nearly still and moves the margin furthest, which
            is the shape of the real contraction anyway. */}
        <g className="l-jelly-bell">
          <path
            d="M4 34 C4 8 60 8 60 34 C57 41 52 41 49 35 C46 41 41 41 38 35 C35 41 30 41 27 35 C24 41 19 41 16 35 C13 41 8 41 4 34Z"
            fill="url(#l-jelly-bell-fill)"
          />
          {/* The lit rim the oil painting gives it, kept inside the dome edge. */}
          <path d="M13 26 C14 20 21 17 30 17.5" stroke="#fff" strokeWidth="1.5"
            strokeLinecap="round" fill="none" opacity=".7" />
          <g fill="#dfa63e" opacity=".95">
            <circle cx="18" cy="25" r="2" />
            <circle cx="28" cy="20" r="2.2" />
            <circle cx="39" cy="23" r="1.9" />
            <circle cx="48" cy="27" r="1.8" />
            <circle cx="22" cy="32" r="1.7" />
            <circle cx="33" cy="30" r="2" />
            <circle cx="44" cy="32" r="1.6" />
            <circle cx="53" cy="30" r="1.3" />
          </g>
        </g>
      </svg>
    </span>
  );
}

/**
 * Route-scoped, like the rest of this site's CSS -- concatenate it into the
 * route's own style block. Hover and keyframe states cannot be inline, and
 * these rules have to reach inside the SVG anyway.
 */
export const JELLY_MARK_CSS = `
/* The caller gives .l-jelly a width and a height; everything else about the
   mark is in here. The box is sized rather than intrinsic because an SVG with
   no width collapses differently across browsers. */
.l-jelly{display:inline-block;transform-origin:50% 16%;
  animation:l-jelly-list 11s ease-in-out infinite}
.l-jelly > svg{display:block;width:100%;height:100%;overflow:visible;
  will-change:transform;animation:l-jelly-swim 2.4s infinite}
/* Percentages, not pixels: both resolve against the box, so the motion scales
   with the mark instead of swamping it on a phone. */
@keyframes l-jelly-swim{
  /* It rises because it just threw water downward -- locked to the squeeze --
     and then sinks for the whole rest of the cycle. That pair is the gait. */
  0%{transform:translateY(0);animation-timing-function:cubic-bezier(.12,.8,.3,1)}
  15%{transform:translateY(-8%);animation-timing-function:cubic-bezier(.36,.02,.62,.9)}
  100%{transform:translateY(0)}
}
/* The one thing not on the beat: the water it hangs in. 11s shares no factor
   with 2.4s, so no two pulses land in quite the same place. */
@keyframes l-jelly-list{
  0%,100%{transform:translateX(-3%) rotate(-2deg)}
  50%{transform:translateX(3%) rotate(2deg)}
}
/* A medusa does not breathe, it jets, and the character is in how lopsided one
   stroke is. Muscle contracts fast and squeezes the bell from flat to tall,
   firing the water out; then nothing pulls it back -- the mesoglea just springs,
   so the return is elastic decay, quick at first and slower and slower after,
   overshooting flat before it settles. Hence a timing function per segment
   rather than one for the whole animation.

   What is pulsed is the THRUST, though, not the shape. An earlier cut held the
   bell perfectly still for the last third of the cycle and it read as a stall
   and a jerk, not as a glide -- so the settle now runs almost to the end, and
   the tentacles carry a slow drift of their own that never stops at all. A
   swimming animal is never motionless; only its thrust comes in beats.

   The two largest motions -- the lurch and the slow list -- are on the HTML box
   and the svg element rather than on groups inside it, because transforms on
   SVG children are not composited: they repaint on the main thread every frame,
   inside a panel that is already carrying a backdrop blur. Up here they are
   plain composited transforms, and the promoted svg also isolates the small
   repaints the bell and tentacles still cost. */
.l-jelly-bell{transform-origin:32px 14px;animation:l-jelly-pulse 2.4s infinite}
@keyframes l-jelly-pulse{
  /* flat -> tall, fast, arriving rather than stopping */
  0%{transform:scale(1,1);animation-timing-function:cubic-bezier(.12,.8,.26,1)}
  11%{transform:scale(.86,1.17);animation-timing-function:cubic-bezier(.1,.6,.3,1)}
  /* the spring, overshooting past rest into flat, then a long even settle */
  40%{transform:scale(1.06,.93);animation-timing-function:cubic-bezier(.35,.05,.55,1)}
  88%,100%{transform:scale(1,1)}
}
/* --fan is the direction each root swings when the bell squeezes: roots left of
   the axis swing right, roots right of it swing left, so they gather instead of
   leaning. scaleY on top of it is the tip lagging the root, and the delays are
   the whip -- the tentacle is still coming in when the bell has finished. */
.l-jelly-t{animation:l-jelly-fan 2.4s infinite}
.l-jelly-t1{transform-origin:22px 39px;--fan:5;animation-delay:.07s}
.l-jelly-t2{transform-origin:33px 40px;--fan:.6;animation-delay:.13s}
.l-jelly-t3{transform-origin:44px 39px;--fan:-5;animation-delay:.08s}
.l-jelly-t4{transform-origin:27px 39px;--fan:3;animation-delay:.11s}
.l-jelly-t5{transform-origin:38px 39px;--fan:-3;animation-delay:.1s}
@keyframes l-jelly-fan{
  0%{transform:rotate(0deg) scaleY(1);animation-timing-function:cubic-bezier(.12,.8,.26,1)}
  12%{transform:rotate(calc(var(--fan) * 1deg)) scaleY(.88);
      animation-timing-function:cubic-bezier(.1,.6,.3,1)}
  44%{transform:rotate(calc(var(--fan) * -.5deg)) scaleY(1.08);
      animation-timing-function:cubic-bezier(.35,.05,.55,1)}
  92%,100%{transform:rotate(0deg) scaleY(1)}
}
/* Off the beat and always running, so the animal keeps moving through the part
   of the cycle where the bell has nothing left to do. */
.l-jelly-trail{transform-origin:32px 39px;animation:l-jelly-trail 6.5s ease-in-out infinite}
@keyframes l-jelly-trail{
  0%,100%{transform:rotate(-2.6deg)}
  50%{transform:rotate(2.6deg)}
}
@media (prefers-reduced-motion:reduce){
  .l-jelly,.l-jelly > svg,
  .l-jelly-bell,.l-jelly-t,.l-jelly-trail{animation:none}
}
`;
