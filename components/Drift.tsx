'use client';

/**
 * Screen three — the drift.
 *
 * Screen one is the shore, screen two is the poem under water, and this is the
 * floor: whatever visitors say, drifting past in the current as points of light.
 * It is a guestbook, but it is not a list of entries with dates on it. A list
 * would be a comments section wearing the album's colours, and the album's last
 * frame is a world without us — a wall of small lights still moving in the dark
 * is the same idea, and it is the only form this could take on this page.
 *
 * Three decisions worth knowing, because each one has an obvious alternative
 * that is worse here:
 *
 * 1. **Polling, not a socket.** Every message is already drifting for ~35
 *    seconds; a 4-second poll lands inside the time it takes one line to cross
 *    a third of the screen, so nobody can perceive the difference between this
 *    and a WebSocket. What they would perceive is the cost: a socket means
 *    either a long-lived serverless function (billed by the second, capped by
 *    Vercel's max duration) or a second vendor with an SDK in the bundle. The
 *    poll sleeps when the tab is hidden and when you are not on this screen,
 *    and backs off when the sea is quiet, so an idle visitor costs nothing.
 *
 * 2. **Everything is one CSS animation.** Each message is an absolutely
 *    positioned line running a `translate3d` keyframe on the compositor —
 *    no rAF loop, no canvas, no per-frame React. Sixty of them cost about what
 *    one costs. History arrives mid-flight via a NEGATIVE animation-delay,
 *    which is the whole trick: without it the sea is empty for thirty seconds
 *    after load and then everything appears at the right edge in a clump.
 *
 * 3. **No component state per message.** Lane, speed, brightness and starting
 *    phase are all derived from a hash of the id, so a message looks the same
 *    on every render and on every visitor's screen, and React never has to
 *    remember anything about it.
 *
 * Nothing here is moderated before it appears — see app/api/guestbook/route.ts
 * for what defends the wall instead, and for the delete handle Qi keeps.
 *
 * last updated 2026-08-23
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type DriftMessage = { id: string; name: string; text: string; at: number };

/** How many lines can be in the water at once. Beyond this the oldest stop being drawn. */
const IN_WATER = 60;
/**
 * Columns the risers start in.
 *
 * Coarse on purpose: the horizontal position is a column plus a per-message
 * offset plus a slow sway, and three sloppy sources beat one precise one at
 * looking unplanned. A pure `hash % 100` reads *more* regular than this, because
 * a uniform scatter has no clumps and real water does.
 */
const COLUMNS = 7;
const MAX_TEXT = 140;
const MAX_NAME = 24;

/* ---- the poll --------------------------------------------------------- */

/* 6s, not 4. A line takes the better part of a minute to cross the screen, so
   the poll is still far inside the time anything is visible — and this is the
   single biggest lever on how much of the store's free monthly budget a visitor
   sitting on this screen burns. Halving the rate halves the bill for a delay
   nobody can perceive. */
const POLL_FAST = 6000;
const POLL_SLOW = 15000;
const POLL_IDLE = 30000;
/** Empty polls before the sea is declared quiet. ~20s and ~2min of nothing. */
const QUIET = 5;
const ASLEEP = 30;

/**
 * The wall, kept live.
 *
 * `active` is "the visitor is actually looking at screen three". Everything
 * about this hook is gated on it: a poll running behind the poem is a request
 * per visitor per four seconds buying a screen nobody is on.
 */
function useDrift(active: boolean) {
  const [messages, setMessages] = useState<DriftMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  /** False when the server has no store configured — the UI says so rather than lying. */
  const [persistent, setPersistent] = useState(true);

  /** Newest `at` we hold. The poll cursor, and the dedupe line. */
  const cursor = useRef(0);
  /**
   * Ids that arrived while someone was watching.
   *
   * "Fresh" cannot be "near the top of the list" — on first load the three
   * newest messages would then swim in from the right edge together, lit, as if
   * three strangers had spoken in the last second. They did not; they are
   * history, and history has to arrive already scattered across the water. So
   * the first batch is silently absorbed and only what comes after it is new.
   *
   * A ref rather than state because it is only ever read during a render that
   * a setMessages in the same call has already scheduled.
   *
   * "The first batch" is the first poll that COMPLETES, not the first one that
   * happens to bring something: an empty wall answers the first poll with
   * nothing, and if the flag waited for content then the very first message
   * anyone ever left would be absorbed as history and never light up — on the
   * one screen where it is the only thing happening.
   */
  const fresh = useRef<Set<string>>(new Set());
  const first = useRef(true);
  /** Consecutive polls that brought nothing. Drives the backoff. */
  const empty = useRef(0);

  /**
   * Merge, newest first, id-deduped.
   *
   * Dedupe by id and not by cursor alone, because the optimistic copy of your
   * own message is in the list before the server has ever heard of it: the POST
   * answers with the real row and this call replaces it, and then the next poll
   * must not put a third copy in the water.
   */
  const merge = useCallback((incoming: DriftMessage[], absorb: boolean) => {
    if (!incoming.length) return;
    if (!absorb) incoming.forEach((m) => fresh.current.add(m.id));
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      return [...fresh, ...prev].sort((a, b) => b.at - a.at).slice(0, IN_WATER);
    });
    cursor.current = Math.max(cursor.current, ...incoming.map((m) => m.at));
  }, []);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    const wait = () =>
      empty.current >= ASLEEP ? POLL_IDLE : empty.current >= QUIET ? POLL_SLOW : POLL_FAST;

    const tick = async () => {
      // A hidden tab keeps its timers (throttled) but has no reason to ask. Skip
      // the request and reschedule; the visibility listener wakes it properly.
      if (document.hidden) {
        timer = setTimeout(tick, POLL_SLOW);
        return;
      }
      try {
        const res = await fetch(`/api/guestbook?since=${cursor.current}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { messages?: DriftMessage[]; persistent?: boolean };
          const list = Array.isArray(data.messages) ? data.messages : [];
          if (typeof data.persistent === 'boolean') setPersistent(data.persistent);
          if (list.length) {
            empty.current = 0;
            merge(list, first.current);
          } else {
            empty.current += 1;
          }
          first.current = false;
        }
      } catch {
        // Offline, or a 502 from the store. Back off like a quiet sea rather
        // than hammering, and say nothing: the water on screen is still true,
        // it is just not growing.
        empty.current += 1;
      } finally {
        setLoaded(true);
        if (!stop) timer = setTimeout(tick, wait());
      }
    };

    const wake = () => {
      if (document.hidden || stop) return;
      // Back from another tab. Ask immediately — the sea should be current by
      // the time the eye has refocused — and treat it as a busy sea again.
      empty.current = 0;
      clearTimeout(timer);
      tick();
    };

    tick();
    document.addEventListener('visibilitychange', wake);
    return () => {
      stop = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [active, merge]);

  /**
   * Send one.
   *
   * The line appears in the water before the request is made. This is the one
   * place optimism is unambiguously right: the alternative is typing into the
   * sea and watching nothing happen for 300ms, on a screen whose entire subject
   * is that words go in and drift. If the write fails the line is pulled back
   * out and the form says so.
   */
  const say = useCallback(
    async (name: string, text: string, dwell: number): Promise<'ok' | 'fast' | 'fail'> => {
      const temp: DriftMessage = { id: `local-${Date.now()}`, name, text, at: Date.now() };
      fresh.current.add(temp.id);
      first.current = false;
      setMessages((prev) => [temp, ...prev].slice(0, IN_WATER));
      try {
        const res = await fetch('/api/guestbook', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, text, dwell, hp: '' }),
        });
        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== temp.id));
          return res.status === 429 ? 'fast' : 'fail';
        }
        const { message } = (await res.json()) as { message?: DriftMessage };
        if (message?.id) {
          fresh.current.add(message.id);
          setMessages((prev) => prev.map((m) => (m.id === temp.id ? message : m)));
          cursor.current = Math.max(cursor.current, message.at);
        }
        empty.current = 0; // Someone is here. Go back to the fast poll.
        return 'ok';
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== temp.id));
        return 'fail';
      }
    },
    [],
  );

  return { messages, loaded, persistent, say, fresh };
}

/* ---- how a message looks --------------------------------------------- */

/** FNV-1a. Any stable 32-bit hash would do; this one is four lines. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Everything about one line's motion, derived from its id.
 *
 * `depth` is the whole parallax: a line "further away" is slower, smaller and
 * dimmer, all three together, which is what makes a flat layer read as water
 * with volume instead of a list on a conveyor.
 */
function look(m: DriftMessage, isFresh: boolean) {
  const h = hash(m.id);
  const depth = ((h >>> 8) % 100) / 100; // 0 = near, 1 = far
  const dur = 42 + depth * 34;
  return {
    /* Column plus offset. The column keeps the field spread across the width;
       the offset is what stops seven columns from reading as seven columns. */
    x: (h % COLUMNS) * (60 / (COLUMNS - 1)) + (((h >>> 16) % 100) / 100) * 8,
    dur,
    /* The sway is the difference between rising and being winched.
       Its period is deliberately NOT a fraction of the rise: near-primes, the
       same trick the light shafts use, so a message never repeats the same
       path twice on its way up and the layer as a whole never finds a beat. */
    sway: 11 + ((h >>> 12) % 9) + ((h >>> 20) % 7) * 1.3,
    swayPx: 8 + depth * 16,
    scale: 1.06 - depth * 0.34,
    dim: 0.94 - depth * 0.36,
    /* Phase. History is scattered across its own cycle so the water is already
       full at first paint; anything that arrives while you are watching starts
       at the floor, because seeing it rise is the point. */
    phase: isFresh ? 0 : (((h >>> 4) % 1000) / 1000) * dur,
    swayPhase: (((h >>> 24) % 100) / 100) * 24,
  };
}

/* ---- the screen ------------------------------------------------------- */

/**
 * Which composer is on screen.
 *
 * Three, because the box was the last thing here still shaped like a website: a
 * blurred pill with a border, floating on an oil painting. Nothing else on this
 * site is a pill — the nav's ask is a rectangle with a hairline, the poem is
 * hairlines, and the mailing list is a *sentence* with the answer underlined
 * inside it. Try them at /?say=1 | 2 | 3. Once one is settled the other two go,
 * the same way the poem's candidate faces did.
 *
 *   1 'rule'      a single hairline, and nothing else. The down-mark's lesson —
 *                 no rail, no ring, no container — applied to a form.
 *   2 'sentence'  the mailing-list panel's own device: the copy IS the form, and
 *                 the submit is the last word of it.
 *   3 'riser'     no form at all. It looks exactly like a message already in the
 *                 water, held still, and sending lets go of it.
 */
type Say = 'rule' | 'sentence' | 'riser';
const SAY_DEFAULT: Say = 'rule';
const SAY_BY_PARAM: Record<string, Say> = { '1': 'rule', '2': 'sentence', '3': 'riser' };

export function Drift({ active }: { active: boolean }) {
  const { messages, loaded, persistent, say, fresh } = useDrift(active);

  /* Read after mount, not during render: the page is statically prerendered and
     the query string does not exist on the server. Same reason the tuner does. */
  const [design, setDesign] = useState<Say>(SAY_DEFAULT);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('say');
    if (q && SAY_BY_PARAM[q]) setDesign(SAY_BY_PARAM[q]);
  }, []);

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'fast' | 'fail'>('idle');
  /** When the composer was first rendered. The server's proof that a human typed. */
  const born = useRef(0);
  if (born.current === 0 && typeof window !== 'undefined') born.current = Date.now();

  /** The visitor's name, remembered locally so returning does not mean retyping it. */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('qi.drift.name');
      if (saved) setName(saved.slice(0, MAX_NAME));
    } catch {
      /* Private mode. The field just starts empty. */
    }
  }, []);

  const send = useCallback(
    async () => {
      const t = text.trim();
      if (!t || state === 'sending') return;
      setState('sending');
      const n = name.trim().slice(0, MAX_NAME);
      const r = await say(n, t.slice(0, MAX_TEXT), Date.now() - born.current);
      if (r === 'ok') {
        setText('');
        setState('idle');
        try {
          if (n) localStorage.setItem('qi.drift.name', n);
        } catch {
          /* ignore */
        }
      } else {
        setState(r);
      }
    },
    [name, text, state, say, born],
  );

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      void send();
    },
    [send],
  );

  /**
   * Enter sends.
   *
   * A form with a submit button is supposed to do this on its own, and here it
   * does not — implicit submission is the browser's, not the form's, and it is
   * one of the first things a wrapper or an automated key event fails to
   * reproduce. On the one control on this site that is a chat box, "I pressed
   * Enter and nothing happened" is not a quirk to leave to the platform.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
      e.preventDefault();
      void send();
    },
    [send],
  );

  const left = MAX_TEXT - text.length;

  /* Recomputed only when the list changes, not on every keystroke in the
     composer — otherwise typing would restyle sixty animated nodes per letter. */
  const drawn = useMemo(
    () =>
      messages.map((m) => {
        const isFresh = fresh.current.has(m.id);
        return { m, s: look(m, isFresh), isFresh };
      }),
    [messages, fresh],
  );

  return (
    <section
      className={'l-screen l-three' + (active ? ' is-in' : '')}
      data-say={design}
      aria-label="Messages in the deep"
    >
      {/*
        No title, and that is the design rather than an omission.

        This screen carried one — a line in the poem's hand with a Chinese line
        under it — and every candidate for it read as writing: an abstract noun
        and a soft verb, the shape a sentence takes when it is reaching for
        significance rather than saying something. The reason none of them could
        work is one screen up. **The poem is the writing on this site**, and a
        second piece of verse set eighty pixels above a text input is competing
        with ten lines it cannot beat.

        So the whole of what this screen has to say is in the placeholder, which
        is one line, in the box, at the moment someone is deciding whether to
        type. Everything else on screen belongs to the visitors.

        It also means the site says nothing here in Chinese — and the screen is
        still bilingual, because the people in the water are. That is a better
        version of the album's voice than a caption would have been: it is not
        performed, it is just what is there.
      */}
      {/*
        The water. `aria-live` is off on purpose: a region that announces every
        arriving message would read a stranger's sentence over whatever the
        visitor is doing, several times a minute. It is a list, and a screen
        reader can walk it — and under prefers-reduced-motion the CSS turns it
        into exactly that, a still column that can be read at all.
      */}
      {loaded && messages.length === 0 && (
        /* An empty sea with an input in it reads as broken, or as still
           loading. One line, and it is the only place the site speaks here. */
        <p className="l-drift-none">还没有人说话</p>
      )}

      <ul className="l-drift" aria-live="off">
        {drawn.map(({ m, s, isFresh }) => (
          <li
            key={m.id}
            className={'l-drift-msg' + (isFresh ? ' is-fresh' : '')}
            style={
              {
                ['--x' as string]: s.x.toFixed(2) + '%',
                ['--dur' as string]: s.dur.toFixed(1) + 's',
                ['--delay' as string]: (-s.phase).toFixed(1) + 's',
                ['--sway' as string]: s.sway.toFixed(1) + 's',
                ['--sway-delay' as string]: (-s.swayPhase).toFixed(1) + 's',
                ['--sway-px' as string]: s.swayPx.toFixed(0) + 'px',
                ['--dim' as string]: s.dim.toFixed(2),
                ['--scale' as string]: s.scale.toFixed(2),
              } as React.CSSProperties
            }
          >
            {/* The rise is on the <li> and the sway is on the <span>: two
                transforms that have to compose, and one element can only run
                one. Nesting them is cheaper than a single keyframe that would
                have to hard-code every combination of the two periods. */}
            <span className="l-drift-in">
              {m.text}
              {m.name && <span className="l-drift-name">— {m.name}</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* onKeyDown on the form, not the field: Enter from the name box should
          send too — it is one line of input wearing two boxes. isComposing
          is the part that matters for half this album's audience: an IME's
          Enter commits the candidate, and swallowing it would send 拼音.

          One form, three designs. The fields, the handlers and the honeypot are
          identical in all three — only the furniture around them and the order
          of the two inputs change, which is the whole reason this is a data
          attribute and not three components. */}
      <form className="l-say" onSubmit={onSubmit} onKeyDown={onKeyDown}>
        {design === 'sentence' && <span className="l-say-word">say</span>}

        <input
          className="l-say-text"
          type="text"
          value={text}
          maxLength={MAX_TEXT}
          /* Each design's prompt is a different part of speech, because in
             the sentence the field is INSIDE the copy: "say ___ , from ___"
             already contains the verb, so a placeholder that repeats it reads
             "say say something to the water". The riser has none at all — see
             the ghost below. */
          placeholder={
            design === 'sentence'
              ? 'something to the water'
              : design === 'riser'
                ? ''
                : 'say something to the water…'
          }
          aria-label="Your message"
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => {
            setText(e.target.value);
            if (state !== 'sending') setState('idle');
          }}
        />

        {/* The riser has no placeholder of its own — it IS a message, and a
            message with grey instructions in it is not one. The prompt sits
            beside the caret instead and goes the moment anything is typed. */}
        {/* The caret is the whole affordance in this design. Everything else
            about a riser-shaped input says "message"; one blinking bar is what
            says "yours". It is drawn rather than relying on the real text
            caret, which is invisible until the field has focus — and the field
            not looking focusable is the exact problem here. */}
        {design === 'riser' && !text && (
          <span className="l-say-ghost" aria-hidden>
            <span className="l-say-caret" />
            say something to the water
          </span>
        )}

        {design === 'sentence' && (
          <span className="l-say-word l-say-word-tight">, from</span>
        )}
        {design === 'rule' && <span className="l-say-rule" aria-hidden />}

        <input
          className="l-say-name"
          type="text"
          value={name}
          maxLength={MAX_NAME}
          placeholder={design === 'riser' ? 'sign it' : 'name'}
          aria-label="Your name, optional"
          autoComplete="nickname"
          onChange={(e) => setName(e.target.value)}
        />

        {/*
          The honeypot. Off-screen rather than display:none — a bot that reads
          the computed style skips hidden fields, and one that fills every input
          it can find is exactly the one this is for. Never focusable, never
          announced, and no autofill: a password manager dropping an address in
          here would silently swallow a real person's message.
        */}
        <input
          className="l-say-hp"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          onChange={() => {}}
        />

        {/* The submit, in each design's own voice. The sentence's is the last
            word of the sentence with the full stop OUTSIDE the rule — the same
            construction as `yes.` in the mailing-list panel, so the underline
            stays on the word and not on the punctuation. */}
        <button className="l-say-go" type="submit" disabled={!text.trim() || state === 'sending'}>
          {state === 'sending' ? (
            <span className="l-say-go-ink">…</span>
          ) : design === 'sentence' ? (
            <>
              <span className="l-say-go-ink">send it up</span>.
            </>
          ) : design === 'riser' ? (
            <span className="l-say-go-ink">let go</span>
          ) : (
            <span className="l-say-go-ink">SEND</span>
          )}
        </button>
      </form>

      <div className="l-say-note" role="status">
        {state === 'fast'
          ? 'a moment between lights, please'
          : state === 'fail'
            ? "that didn't reach the water — try again"
            : !persistent
              ? 'local only: no store configured, nothing here is kept'
              : left <= 30
                ? `${left}`
                : ''}
      </div>

    </section>
  );
}

/**
 * Screen three's stylesheet, injected by Landing with the rest.
 *
 * The lane geometry is the only part that is not obvious: lanes are laid out in
 * `dvh` across the middle of the screen, leaving the head clear at the top and
 * the composer clear at the bottom, so a line never drifts through either.
 */
export const DRIFT_CSS = `
.l-three{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;
  height:100%;overflow:hidden;position:relative;
  /* Used only by the reduced-motion column, which is the one presentation here
     that is laid out rather than travelling. It starts higher than it used to:
     the title it was clearing is gone. */
  --water-top:13dvh;--water-h:62dvh}

/* The stage owns the dark down here — see .l-floor in Landing. This screen
   paints nothing of its own over the picture, which is what keeps the grain
   (a layer under the scroller) from being buried by it. */
.l-three>*{position:relative;z-index:1}

/* The empty state, and the only thing the site itself says on this screen.
   Sits where the risers will be, so the screen does not change shape when the
   first one arrives. */
.l-drift-none{position:absolute;left:0;right:0;top:42%;z-index:2;
  margin:0;text-align:center;pointer-events:none;
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:clamp(13px,1.8vh,16px);letter-spacing:.3em;
  color:rgba(196,222,240,.34)}

/* ---- the water ---- */
.l-drift{position:absolute;left:0;right:0;top:0;bottom:0;margin:0;padding:0;
  list-style:none;overflow:hidden;pointer-events:none;z-index:1}

/* Messages RISE. They came off the floor, which is where the reader is, and
   they leave through the surface — the direction the whole site has been
   travelling, run backwards for the one thing on it that belongs to someone
   else. Sideways was built first and was wrong twice over: it is the motion of
   a ticker, and it forces every message onto one line, so a long one is three
   phone screens wide and can never be read as a sentence.

   Being a block rather than a line is what the change buys. A riser wraps to
   two or three short lines and holds together as an object — a scrap of paper
   going up — which is also why it can be read while it moves. */
.l-drift-msg{position:absolute;top:0;inset-inline-start:var(--x);
  max-inline-size:min(28ch,30vw);will-change:transform;
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:calc(clamp(15px,2.05vh,23px) * var(--scale));
  line-height:1.42;color:rgb(224,240,250);
  text-shadow:0 0 calc(16px * var(--scale)) rgba(96,172,220,calc(var(--dim) * .5));
  animation:l-drift-up var(--dur) linear var(--delay) infinite}

/* Floor to surface, fading at both ends.
   The fade is inside the keyframe rather than done with a mask over the layer:
   a mask forces the whole viewport-sized subtree into one render surface and
   re-rasters it every frame — the exact cost the glimmers were removed for.
   Four opacity stops cost nothing and solve the same problem, which is that a
   message must not pop into existence at the bottom edge or blink out at the
   top. var(--dim) in the middle two stops is what keeps the depth parallax:
   the keyframe fades TO the message's own brightness, not to 1. */
@keyframes l-drift-up{
  0%{transform:translate3d(0,100dvh,0);opacity:0}
  8%{opacity:var(--dim)}
  /* Gone well before the top, not at it. The travel still runs off the edge —
     it just does it invisibly. A message that is still lit when it reaches the
     upper fifth of the screen crosses the title and then the nav, and a
     stranger's sentence sliding through the album's own type reads as a bug
     rather than as weather. The last quarter of the rise is the fade. */
  66%{opacity:var(--dim)}
  82%{opacity:0}
  100%{transform:translate3d(0,-120%,0);opacity:0}}

/* The sway. Without it a riser is on a wire, and the eye reads the whole layer
   as a machine — the same failure as a tile with a findable period, one axis
   over. alternate, so it turns back rather than snapping to its start. */
.l-drift-in{display:block;will-change:transform;
  animation:l-drift-sway var(--sway) ease-in-out var(--sway-delay) infinite alternate}
@keyframes l-drift-sway{
  from{transform:translate3d(calc(var(--sway-px) * -1),0,0)}
  to{transform:translate3d(var(--sway-px),0,0)}}

/* Just-arrived. Brighter for one rise, then it is one of the others. A filter,
   so it composites with both transforms instead of fighting either for one. */
.l-drift-msg.is-fresh{animation:l-drift-up var(--dur) linear var(--delay) infinite,
  l-drift-lit 9s ease-out both}
@keyframes l-drift-lit{
  0%{filter:brightness(1.8) saturate(.9)}
  100%{filter:brightness(1)}}

.l-drift-name{display:block;margin-block-start:.24em;font-size:.72em;
  letter-spacing:.06em;opacity:.62;font-style:italic}

/* Off this screen the water is still there and still costing frames. Paused,
   it costs nothing — and because the animations keep their position, coming
   back does not restart the sea. */
.l-three:not(.is-in) .l-drift-msg,
.l-three:not(.is-in) .l-drift-in{animation-play-state:paused}

/* ---- the composer ------------------------------------------------------
   Three designs behind /?say=1|2|3. What they share is below; what makes each
   one itself is in its own block. The shared part is deliberately almost
   nothing: no box, no blur, no radius, no fill. That was the first version —
   a pill with a border and a backdrop-blur, which is the shape a chat input has
   on every product on the internet and the shape nothing else on this site has.
   Furniture is the thing being chosen between here, so none of it is shared. */
.l-say{position:absolute;left:0;right:0;margin-inline:auto;
  bottom:calc(clamp(30px,6vh,64px) + var(--bar));
  z-index:2;display:flex;align-items:baseline;
  width:min(660px,calc(100vw - 48px))}

.l-say input{background:none;border:0;outline:none;color:rgba(234,245,253,.96);
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:clamp(16px,2.05vh,21px);line-height:1.5;padding:0}
.l-say input::placeholder{color:rgba(178,206,226,.34)}
.l-say-text{flex:1 1 auto;min-inline-size:0}
.l-say-name{flex:0 0 auto;font-style:italic;opacity:.82;
  inline-size:clamp(58px,8vw,96px)}

/* Off-canvas, not hidden. See the note in the markup. */
.l-say-hp{position:absolute!important;left:-9999px;inline-size:1px;block-size:1px;
  opacity:0;pointer-events:none}

/* .landing-qualified because .landing button{font:inherit} is (0,1,1) and would
   otherwise beat a bare class on the rules here that set a font. */
.landing .l-say-go{flex:0 0 auto;background:none;border:0;cursor:pointer;
  padding:0 0 0 .9em;color:rgba(214,236,250,.9);
  transition:opacity .35s ease,color .35s ease}
.landing .l-say-go:disabled{opacity:.28;cursor:default}
.landing .l-say-go:not(:disabled):hover{color:#fff}

/* ---- 1 · the rule ----
   A single hairline and the type sitting on it. The argument is the down-mark's:
   of eight candidates the one with the least furniture won, because on a
   painting every box you draw is an object competing with the picture. The line
   is not decoration — it is the only thing telling you this is a field, so it
   lights up when you are in it and is otherwise almost not there. */
.l-three[data-say=rule] .l-say{
  gap:.9em;padding-block-end:.5em;
  border-block-end:1px solid rgba(150,196,226,.2);
  transition:border-color .45s ease}
.l-three[data-say=rule] .l-say:focus-within{border-block-end-color:rgba(178,220,248,.5)}
.l-three[data-say=rule] .l-say-rule{align-self:center;flex:0 0 auto;
  inline-size:1px;block-size:1.15em;background:rgba(150,196,226,.22)}
.landing .l-three[data-say=rule] .l-say-go{
  font-family:'Jost',system-ui,sans-serif;font-weight:300;
  font-size:clamp(9.5px,1.3vh,11.5px);letter-spacing:.3em}

/* ---- 2 · the sentence ----
   The mailing-list panel's device, and the reason to reuse it is that it is
   already the answer to this exact problem: a form that must not look like one.
   The copy IS the label, so there is nothing to read twice, and the submit is
   the sentence's last word rather than a button parked at the end of it.

   The full stop sits OUTSIDE the underlined span — punctuation is the
   sentence's, not the control's — which is the same detail as 'yes.' upstairs. */
.l-three[data-say=sentence] .l-say{
  flex-wrap:wrap;gap:.1em .42em;justify-content:center;text-align:center;
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:clamp(16px,2.05vh,21px);color:rgba(206,229,246,.62)}
.l-three[data-say=sentence] .l-say-word{flex:0 0 auto}
/* A comma sits on the word before it. The flex gap puts a space there, so this
   takes it back — otherwise the sentence reads "the water , from". */
.l-three[data-say=sentence] .l-say-word-tight{margin-inline-start:-.36em}
.l-three[data-say=sentence] input{
  border-block-end:1px solid rgba(150,196,226,.26);padding-block-end:.12em;
  transition:border-color .45s ease}
.l-three[data-say=sentence] input:focus{border-block-end-color:rgba(178,220,248,.55)}
.l-three[data-say=sentence] .l-say-text{min-inline-size:clamp(180px,34vw,320px)}
.landing .l-three[data-say=sentence] .l-say-go{
  font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-size:clamp(16px,2.05vh,21px);letter-spacing:0;padding-inline-start:.35em}
.l-three[data-say=sentence] .l-say-go-ink{
  border-block-end:1px solid currentColor;padding-block-end:.06em}

/* ---- 3 · the riser ----
   No form at all. It is set exactly like a message already in the water — same
   face, same size, same glow — held still at the bottom, and sending lets go of
   it. The risk is real and is the whole point of trying it: an input with no
   furniture may not read as an input. Two things carry it — a caret that is
   always there, and a prompt beside the caret rather than inside the field,
   because grey instructions sitting IN a message stop it being a message. */
.l-three[data-say=riser] .l-say{
  flex-wrap:wrap;gap:.3em .6em;justify-content:center;text-align:center;
  inline-size:min(32ch,calc(100vw - 48px));
  bottom:calc(clamp(56px,11vh,120px) + var(--bar))}
.l-three[data-say=riser] input{
  text-align:center;color:rgba(228,242,252,.94);
  text-shadow:0 0 18px rgba(96,172,220,.4)}
.l-three[data-say=riser] .l-say-text{flex:1 0 100%;caret-color:rgba(196,228,250,.9)}
.l-three[data-say=riser] .l-say-name{flex:0 0 auto;inline-size:7em;
  font-size:.74em;opacity:.6}
.l-three[data-say=riser] .l-say-ghost{position:absolute;left:0;right:0;top:0;
  pointer-events:none;color:rgba(178,206,226,.3);
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:clamp(16px,2.05vh,21px);line-height:1.5}
.l-three[data-say=riser] .l-say:focus-within .l-say-ghost{color:rgba(190,218,238,.42)}
.l-say-caret{display:inline-block;inline-size:1px;block-size:1.05em;
  vertical-align:-.16em;margin-inline-end:.34em;
  background:rgba(206,234,252,.85);
  animation:l-say-blink 1.15s steps(1,end) infinite}
@keyframes l-say-blink{0%,52%{opacity:1}53%,100%{opacity:0}}
/* Nothing to let go of yet, so the words for it are not there either. Hidden
   rather than dimmed: in a design with no furniture, a greyed-out control is
   just another piece of furniture. */
.landing .l-three[data-say=riser] .l-say-go:disabled{opacity:0}
.landing .l-three[data-say=riser] .l-say-go{
  font-family:'Jost',system-ui,sans-serif;font-weight:300;
  font-size:clamp(9px,1.2vh,10.5px);letter-spacing:.28em;text-transform:uppercase;
  padding:0;opacity:.7}

.l-say-note{position:absolute;left:0;right:0;
  bottom:calc(clamp(8px,1.6vh,20px) + var(--bar));z-index:2;
  font-family:'Jost',system-ui,sans-serif;font-weight:200;
  font-size:clamp(9px,1.2vh,10.5px);letter-spacing:.22em;text-transform:uppercase;
  color:rgba(186,214,232,.4);min-height:1.2em;text-align:center;
  pointer-events:none;white-space:nowrap}

/* ---- the mark at the foot of screen two ---- */
/* The shore's mark, one screen lower, and gated on both axes: invisible until
   the poem is most of the way in (so it is never a thing glimpsed at the bottom
   of the shore), gone again as the floor arrives. Multiplied rather than
   switched, so it fades on the scroll like everything else here.
   No entrance animation — l-down-in would run its 1.2s at page load, one screen
   below anyone's eyes, and own the opacity while it did. Only the bob. */
.landing .l-down.l-down-two{
  opacity:calc(clamp(0,(var(--s) - .55) * 4,1) * clamp(0,calc(1 - var(--s3) * 3),1));
  animation:l-down-bob 3.4s ease-in-out infinite}
/* Gone once it is transparent, or it eats presses over the end of the poem. */
.landing .l-down.l-down-two{pointer-events:auto}
.landing[data-three] .l-down.l-down-two{pointer-events:none}


/* The composer arrives with the screen, the way the poem's lines do.
   Note what it is NOT centred with: l-in ends on transform:none with
   fill-mode both, so a translateX(-50%) here would survive exactly until the
   entrance finished. See .l-say. */
@media (prefers-reduced-motion:no-preference){
  .l-say,.l-drift-none{opacity:0}
  .l-three.is-in .l-say{animation:l-in .9s cubic-bezier(.2,.7,.2,1) .25s both}
  .l-three.is-in .l-drift-none{animation:l-in 1.2s cubic-bezier(.2,.7,.2,1) .5s both}}

/* Asked for less motion, and given a guestbook instead of a current: the same
   messages, newest first, holding still. The drift is the presentation, not the
   content, so nothing is lost by dropping it. */
@media (prefers-reduced-motion:reduce){
  .l-drift{position:absolute;top:var(--water-top);bottom:auto;
    height:var(--water-h);overflow-y:auto;pointer-events:auto;
    display:flex;flex-direction:column;align-items:center;gap:.85em;
    padding:0 22px}
  .l-drift-msg{position:static;animation:none;text-align:center;
    inset-inline-start:auto;opacity:1;
    max-inline-size:min(620px,92vw);color:rgba(224,240,250,.86);
    font-size:clamp(15px,2vh,21px)}
  .l-drift-msg.is-fresh{animation:none}
  /* The sway is a transform, and animation:none freezes it at whatever the
     from-frame says — every block offset left by its own amplitude. */
  .l-drift-in{animation:none;transform:none}}

@media (max-width:640px){
  .l-three{--water-top:20dvh;--water-h:52dvh}
  /* A riser has to be wide enough to be a paragraph and narrow enough to leave
     room beside it. 38vw of a phone is 140px — a 140-character message would
     come out eight lines tall and read as a column, not a scrap. So the block
     gets most of the width here, and the starting position is scaled down to
     match (the offset is an inline style, so the media query multiplies it
     rather than replacing it: 0–61% becomes 0–23%, which keeps 74vw on screen). */
  .l-drift-msg{max-inline-size:min(30ch,74vw);
    inset-inline-start:calc(3% + var(--x) * .34);
    font-size:calc(clamp(13px,3.6vw,16px) * var(--scale))}
  /* Half the sway: the same swing that reads as drift on a desktop is a third
     of a phone's width, and a block sliding that far is being blown, not adrift. */
  .l-drift-in{animation-name:l-drift-sway-narrow}
  .l-say{width:calc(100vw - 34px)}
  .l-say-name{inline-size:54px}
  .l-three[data-say=rule] .l-say{gap:.6em}
  .l-three[data-say=sentence] .l-say-text{min-inline-size:100%}
  /* nowrap keeps the counter and the two short errors on one line, which is
     what it is for — but the dev-only store warning is a sentence and would
     run off both edges of a phone. */
  .l-say-note{white-space:normal;padding:0 22px}}
@keyframes l-drift-sway-narrow{
  from{transform:translate3d(calc(var(--sway-px) * -.45),0,0)}
  to{transform:translate3d(calc(var(--sway-px) * .45),0,0)}}
`;
