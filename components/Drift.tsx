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

/*
 * Everything here is prefixed `l-riser*` / `l-say*`, and that is load-bearing.
 *
 * This page has ONE flat namespace shared by three stylesheets in three files,
 * concatenated in that order, so whatever comes last wins — silently. It has
 * bitten twice, and both times the same way:
 *
 *   `.l-drift` is screen two's pair of slow water clouds. Taking that class
 *   cost them their z-index, and under prefers-reduced-motion turned them into
 *   a scrolling flex column.
 *
 *   `@keyframes l-rise` is the HERO's entrance. Taking that name left the whole
 *   of screen one — title, countdown, both buttons — sitting at opacity 0.
 *
 * Screen three looked perfect on both occasions; the damage was on another
 * screen, which is exactly why a screenshot of the thing being worked on does
 * not catch it. **Keyframes share the namespace with classes and are the easier
 * half to forget.** Before naming anything here, diff the names across all
 * three stylesheets — there is a script for it in CLAUDE.md, and it takes a
 * second.
 */

/** The buffer. Beyond this the oldest stop being held at all. */
const IN_WATER = 60;

/**
 * How much history to put in the water, which is not the same number.
 *
 * A screen holds what a screen holds. On a desktop the field is seven columns
 * wide and takes a couple of dozen risers before it stops reading as drift and
 * starts reading as a page of text; a phone is effectively ONE column, and the
 * same twenty-odd messages there are a queue with everything overlapping
 * everything. Measured on a 375px screen with eighteen: thirteen pairs
 * overlapping at the worst moment. No amount of placement cleverness fixes
 * that — there is nowhere for them to be. The cap is the fix.
 *
 * Arrivals are exempt: someone who has just typed must see their message,
 * whatever the field already holds. IN_WATER is still the ceiling.
 *
 * It scales with the width rather than switching at a breakpoint, because
 * crowding does: a 768px tablet gets the desktop geometry and used to get the
 * desktop count with it, which measured one overlap at load where 1280px
 * measured none. Roughly one message per 80px of width, floored at eight so a
 * phone still feels inhabited and capped at sixteen so a wide screen does not
 * become a page of text.
 */
function historyCap(width: number) {
  return Math.max(8, Math.min(16, Math.round(width / 80)));
}
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
/** Empty polls before the sea is declared quiet. ~30s and ~3min of nothing. */
const QUIET = 5;
const ASLEEP = 30;

/**
 * How often the poll asks for the whole wall instead of only what is new.
 *
 * An incremental poll can only ever ADD, so it never learns that something was
 * taken down: Qi deletes a line of spam and it stays on the screen of everyone
 * who already had the page open, for as long as they leave the tab open. That
 * is a hole in the only moderation there is.
 *
 * It costs almost nothing to close, because of how the store reads: `read()`
 * does a single LRANGE of the whole list either way and filters by timestamp in
 * JS, so a full fetch is the SAME one Redis command as an incremental one. Only
 * the size of the JSON differs, which is why this is once a minute rather than
 * every poll.
 *
 * **In milliseconds, not in a count of polls**, and that distinction was found
 * by testing rather than by thinking: the poll backs off to 15s and then 30s
 * when the water is quiet, so "every tenth poll" stretched to several minutes
 * exactly when the wall was empty — which is precisely the state a wall is in
 * after someone deletes the only thing on it.
 */
const SWEEP_MS = 60_000;

/**
 * The wall, kept live.
 *
 * `active` is "the visitor is actually looking at screen three". Everything
 * about this hook is gated on it: a poll running behind the poem is a request
 * per visitor per four seconds buying a screen nobody is on.
 */
function useDrift(active: boolean, capacity: number) {
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
  /** When the last full sweep happened. See SWEEP_MS. */
  const swept = useRef(0);

  /**
   * Merge, newest first, id-deduped.
   *
   * Dedupe by id and not by cursor alone, because the optimistic copy of your
   * own message is in the list before the server has ever heard of it: the POST
   * answers with the real row and this call replaces it, and then the next poll
   * must not put a third copy in the water.
   */
  const merge = useCallback(
    (all: DriftMessage[], absorb: boolean) => {
    if (!all.length) return;
    /* The cursor must advance past everything the server sent, including what
       is about to be dropped for being more history than the screen can hold —
       otherwise the next poll returns it again, forever. */
    cursor.current = Math.max(cursor.current, ...all.map((m) => m.at));
    const incoming = absorb ? all.slice(0, capacity) : all;
    if (!incoming.length) return;
    if (!absorb) incoming.forEach((m) => fresh.current.add(m.id));
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      if (!fresh.length) return prev;
      return [...fresh, ...prev].sort((a, b) => b.at - a.at).slice(0, IN_WATER);
    });
    },
    [capacity],
  );

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
      // Once a minute the poll asks for everything, so removals land too.
      const now = Date.now();
      const sweep = now - swept.current >= SWEEP_MS;
      try {
        const from = sweep ? 0 : cursor.current;
        const res = await fetch(`/api/guestbook?since=${from}`, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { messages?: DriftMessage[]; persistent?: boolean };
          const list = Array.isArray(data.messages) ? data.messages : [];
          if (typeof data.persistent === 'boolean') setPersistent(data.persistent);
          if (sweep) {
            swept.current = now;
            const alive = new Set(list.map((m) => m.id));
            setMessages((prev) => {
              /* Keep anything the server still has, and anything of ours it
                 cannot have heard of yet — an optimistic copy posted in the
                 gap between this request going out and its answer coming back
                 would otherwise be swept away a moment after being typed. */
              const kept = prev.filter((m) => alive.has(m.id) || m.id.startsWith('local-'));
              return kept.length === prev.length ? prev : kept;
            });
          }
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

type Look = {
  x: number;
  dur: number;
  sway: number;
  swayPx: number;
  scale: number;
  dim: number;
  phase: number;
  swayPhase: number;
};

/**
 * The five speeds, and there are five rather than a range for one reason.
 *
 * Two messages that overlap and are travelling at the SAME speed never come
 * apart — they are glued for as long as both are in the water, and that is what
 * makes a field look broken rather than busy. A continuous range produces
 * near-identical pairs constantly, so the speeds are quantised into bands and
 * anything that can overlap is given a different one.
 *
 * The band spacing was widened once, after measuring. 41 against 50 is only
 * ~1.6px a second of relative drift on an 880px rise — a pair took well over
 * twenty seconds to come apart, which is not "brief overlap", it is a stack
 * that eventually resolves. The neighbour rule now also skips the ADJACENT
 * band, so an overlapping pair differs by at least two: ~6px a second, and a
 * stack clears in well under ten.
 *
 * Brief overlap is fine and unavoidable in a drift. Slow overlap is the bug.
 */
/* Seven, not five. On a phone the field is one column, so every message is
   every other message's neighbour and the speed rule runs out of distinct bands
   to hand out — with five and a cap of eight, three pairs were forced to share,
   and a shared speed means a pair that never converges but also never comes
   apart. Seven covers the crowded case with room to spare and costs nothing on
   a desktop, where the three-bands-apart preference now has more to work with. */
const SPEEDS = [34, 42, 51, 60, 70, 81, 93];

/**
 * How wide a riser is, as a percentage of the viewport, for collision purposes.
 *
 * An over-estimate on purpose: the max-inline-size in the stylesheet plus the
 * sway's swing either side. Guessing high costs a little variety in the speed
 * assignment; guessing low puts two messages on top of each other permanently,
 * which is the thing being prevented.
 *
 * **It is per-viewport, and the geometry it describes lives here rather than in
 * the stylesheet.** A phone gives a riser most of the width, so every message
 * is every other message's neighbour and the whole field is effectively one
 * column — the opposite of the desktop case. That used to be expressed as a CSS
 * override that scaled the offset down, with the collision model still using
 * desktop numbers: the model believed the field was seven spread-out columns
 * while the screen showed one stack, so it cheerfully gave overlapping messages
 * the same speed. Phones were visibly worse than desktops for exactly that
 * reason. **One source of truth: the offset is computed here, and the CSS just
 * places what it is given.**
 *
 * The sway is the other easy thing to forget, in the code and in the
 * measurement both: it is a transform on an INNER span, so it moves the text
 * without moving the <li>'s box. A collision check written against the outer
 * element is blind to it.
 */
function geometry(narrow: boolean) {
  return narrow
    ? { block: 78, spread: 18, base: 3, jitter: 3 }
    : { block: 30, spread: 60, base: 0, jitter: 6 };
}

/**
 * Everything about one line's motion.
 *
 * Deliberately NOT a pure function of the id any more, which is a real cost
 * worth naming: it was, and a pure hash is stable, needs no bookkeeping and
 * looks the same for every visitor. What it cannot do is know about the other
 * messages — and every stacking problem is a relationship between two of them.
 * So this takes the column's current occupancy, and the assignment is cached
 * for the life of the tab (see the layout ref): a message's motion is decided
 * once, when it first appears, and never recomputed. That part is essential —
 * re-deriving phases when someone posts would make the entire field jump.
 *
 * `depth` is still the parallax, and it now comes FROM the speed rather than
 * alongside it: slower is further, so it is also smaller and dimmer. One
 * quantity, three expressions, which is the only way the three cannot disagree.
 */
function look(
  m: DriftMessage,
  opts: { column: number; speed: number; phase: number; x: number },
): Look {
  const h = hash(m.id);
  const depth = opts.speed / (SPEEDS.length - 1); // 0 = near and quick, 1 = far and slow
  return {
    x: opts.x,
    dur: SPEEDS[opts.speed],
    /* The sway is the difference between rising and being winched.
       Its period is deliberately NOT a fraction of the rise: near-primes, the
       same trick the light shafts use, so a message never repeats the same
       path twice on its way up and the layer as a whole never finds a beat. */
    sway: 11 + ((h >>> 12) % 9) + ((h >>> 20) % 7) * 1.3,
    swayPx: 8 + depth * 16,
    scale: 1.06 - depth * 0.34,
    dim: 0.94 - depth * 0.36,
    phase: opts.phase,
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
const SAY_DEFAULT: Say = 'riser';
const SAY_BY_PARAM: Record<string, Say> = { '1': 'rule', '2': 'sentence', '3': 'riser' };

export function Drift({ active }: { active: boolean }) {
  /* Read once, after mount — the page is statically prerendered and there is no
     viewport on the server. A rotation does not re-cap: obeying it would mean
     deleting messages mid-rise, and a slightly crowded phone beats a screen
     that removes what someone is reading. */
  const [view, setView] = useState({ narrow: false, cap: 16 });
  useEffect(() => {
    setView({ narrow: window.innerWidth <= 640, cap: historyCap(window.innerWidth) });
  }, []);

  const { messages, loaded, persistent, say, fresh } = useDrift(active, view.cap);

  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'fast' | 'fail'>('idle');
  /** Whether the pointer is in the name field. See the placeholder below. */
  const [signing, setSigning] = useState(false);
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

  /**
   * Motion, decided once per message and never again.
   *
   * The cache is the point, not an optimisation. Phase and speed are now chosen
   * with knowledge of what else is in the water, and anything derived from the
   * live list would be re-derived the moment somebody posts — every message in
   * the field would jump to a new position mid-rise. So a message's motion is
   * fixed when it first appears and outlives every later change to the list.
   */
  const layout = useRef(new Map<string, Look>());
  /** How many messages have been put in each column, for the life of the tab. */
  const columnLoad = useRef<number[]>(new Array(COLUMNS).fill(0));
  /** Round-robin over SPEEDS, so consecutive assignments never share a speed. */
  const speedTurn = useRef(0);
  /** Everything placed so far, for the one collision rule below. */
  const placed = useRef<{ x: number; speed: number; at: number }[]>([]);

  /* Recomputed only when the list changes, not on every keystroke in the
     composer — otherwise typing would restyle sixty animated nodes per letter. */
  const drawn = useMemo(() => {
    const pending = messages.filter((m) => !layout.current.has(m.id));

    if (pending.length) {
      /* Read once per batch, not per message. A rotation between batches will
         leave earlier placements described by the old geometry; that is
         accepted — positions are percentages and stay on screen, only the
         neighbour model goes slightly stale, and re-deriving would make the
         whole field jump. */
      const geo = geometry(view.narrow);
      const xOf = (h: number, column: number) =>
        geo.base + column * (geo.spread / (COLUMNS - 1)) + ((h >>> 16) % 100) / 100 * geo.jitter;

      /* History and arrivals are laid out differently, and they have to be.
         History is a batch we can see all of at once, so it can be SPREAD —
         which is the only chance to guarantee that two messages sharing a
         column start far apart. An arrival is one message with nowhere to be
         but the bottom of the screen. */
      const history = pending.filter((m) => !fresh.current.has(m.id));
      const arrivals = pending.filter((m) => fresh.current.has(m.id));

      /**
       * The one rule that makes an overlap temporary.
       *
       * Two messages whose columns are far apart can still overlap on screen —
       * a riser is up to ~26% of the width and the columns are 10% apart, so a
       * message shares horizontal space with several of its neighbours. Within
       * a column the phase spread keeps them apart; across columns nothing did,
       * and a pair that overlaps at the SAME speed is glued for as long as both
       * are in the water. That is the difference between a busy field and a
       * broken one, and it is the only overlap worth engineering against.
       *
       * So: a new message may not take a speed already held by anything it can
       * overlap horizontally. Different speeds means they cross, briefly, and
       * come apart on their own — which is exactly what a drift should do. If
       * every speed is taken (a very crowded stripe) it falls back to the
       * round-robin, because at that density no assignment saves it.
       */
      const neighbours = (x: number) =>
        placed.current.filter((q) => Math.abs(q.x - x) < geo.block);

      const pickSpeed = (x: number) => {
        const near = neighbours(x);
        // Two passes, and the first one is why an overlap clears quickly rather
        // than merely eventually: prefer a band at least two away from every
        // neighbour's, and only then settle for merely different.
        for (const gap of [3, 2, 1]) {
          for (let i = 0; i < SPEEDS.length; i++) {
            const cand = (speedTurn.current + i) % SPEEDS.length;
            if (near.every((q) => Math.abs(q.speed - cand) >= gap)) {
              speedTurn.current = cand + 1;
              return cand;
            }
          }
        }
        return speedTurn.current++ % SPEEDS.length;
      };

      /**
       * Where in its cycle a history message starts, as a fraction.
       *
       * Spreading within a column was not enough, and the measurement said so:
       * a riser is ~30% of the width and the columns are 10% apart, so most of
       * a message's real neighbours are in OTHER columns, and nothing was
       * keeping it away from those.
       *
       * So: try 48 positions around the cycle, keep the one furthest from
       * everything that can actually overlap it. Fraction of the cycle is the
       * right unit — it maps straight to height on screen, whatever the speed.
       *
       * **Two cleverer objectives were built, measured, and thrown away**, and
       * they are recorded here so nobody spends the afternoon again:
       *
       *   *maximise the time until the next exact coincidence* — the obvious
       *   "don't just look good now, look good in a minute" upgrade. Far worse:
       *   9 overlaps at load and a 46-second stack, because two messages
       *   already sitting on top of each other are not due to coincide again
       *   for nearly a whole relative period, so that state scores brilliantly.
       *   Exact coincidence is not the event that matters.
       *
       *   *simulate ninety seconds and minimise the time spent overlapping* —
       *   the honest version of the same idea, weighted towards the near
       *   future. Still worse: 3 at load, 26-second worst. It optimises a total
       *   and will happily buy a long stack later with a clean start, or the
       *   reverse.
       *
       * Plain distance wins because the speed rule is already doing the
       * future-proofing: nothing that can overlap shares a speed, and most
       * differ by two bands or more, so every pair is guaranteed to cross
       * rather than sit. Given that, the only thing left worth choosing is
       * where they are *now*. **When a heuristic is already constrained into
       * good behaviour, adding a smarter objective mostly finds new ways to
       * satisfy it.**
       */
      const pickPhase = (x: number, seed: number) => {
        const near = neighbours(x);
        /* Nothing to avoid yet — so scatter, do not default. Returning a
           constant here was a real bug and a quiet one: the FIRST message
           placed in each clear stretch of the width got the same phase as
           every other first message, so a handful of them started life in a
           row at the same height. An unconstrained message is not one that
           should be put anywhere in particular; it is one that should be put
           anywhere at all. */
        if (!near.length) return (seed % 1000) / 1000;
        let best = 0;
        let bestGap = -1;
        for (let i = 0; i < 48; i++) {
          const cand = i / 48;
          let gap = 1;
          for (const q of near) {
            const d = Math.abs(q.at - cand);
            gap = Math.min(gap, Math.min(d, 1 - d)); // the cycle wraps
          }
          if (gap > bestGap) {
            bestGap = gap;
            best = cand;
          }
        }
        return best;
      };

      const byColumn = new Map<number, DriftMessage[]>();
      for (const m of history) {
        const c = hash(m.id) % COLUMNS;
        const list = byColumn.get(c);
        if (list) list.push(m);
        else byColumn.set(c, [m]);
      }
      for (const [column, members] of byColumn) {
        columnLoad.current[column] += members.length;
        members.forEach((m) => {
          const x = xOf(hash(m.id), column);
          const speed = pickSpeed(x);
          /* Plus a small per-message wobble, so the spacing is regular without
             being measured. Regular beats random here: random phases produce
             visible pile-ups at exactly the rate they produce visible gaps, and
             the pile-up is the thing being fixed. */
          const at = (pickPhase(x, hash(m.id)) + (hash(m.id) % 100) / 3200) % 1;
          placed.current.push({ x, speed, at });
          layout.current.set(m.id, look(m, { column, speed, phase: at * SPEEDS[speed], x }));
        });
      }

      for (const m of arrivals) {
        /* Into the emptiest column. Two people posting in the same minute is
           the commonest way a field gets a stack, and it is the one case where
           a hash would put them anywhere at all — including on top of each
           other. */
        let column = 0;
        for (let c = 1; c < COLUMNS; c++) {
          if (columnLoad.current[c] < columnLoad.current[column]) column = c;
        }
        columnLoad.current[column] += 1;
        const x = xOf(hash(m.id), column);
        const speed = pickSpeed(x);
        placed.current.push({ x, speed, at: 0 });
        // Phase 0: an arrival starts at the bottom, because watching it rise is
        // the whole reason it is not just added to a list.
        layout.current.set(m.id, look(m, { column, speed, phase: 0, x }));
      }
    }

    return messages.map((m) => ({
      m,
      s: layout.current.get(m.id) as Look,
      isFresh: fresh.current.has(m.id),
    }));
  }, [messages, fresh, view.narrow]);

  return (
    <section
      className={'l-screen l-three' + (active ? ' is-in' : '')}
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
           loading, so the screen says one line — and it says it in English.
           This was 还没有人说话 for a day, and it was wrong for a reason worth
           keeping: **on this site Chinese is ceremonial, never functional.**
           `QI · 琦` is a name and 水母之心 is the album's second name; both are
           titles. Every piece of working copy — HEAR THE DEMOS, TRACKLIST,
           FOLLOW, "follow thy heart", "receive a heartbeat at" — is English. A
           status line reporting that the wall is empty is working copy, and
           putting it in Chinese used the one register the site had never used
           Chinese for. The screen is still bilingual whenever the people in the
           water are; that is theirs to do, not the site's. */
        <p className="l-risers-none">no one has spoken yet</p>
      )}

      <ul className="l-risers" aria-live="off">
        {drawn.map(({ m, s, isFresh }) => (
          <li
            key={m.id}
            className={'l-riser' + (isFresh ? ' is-fresh' : '')}
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
            <span className="l-riser-in">
              {m.text}
              {m.name && <span className="l-riser-name">— {m.name}</span>}
            </span>
          </li>
        ))}
      </ul>

      {/* onKeyDown on the form, not the field: Enter from the name box should
          send too — it is one line of input wearing two boxes. isComposing
          is the part that matters for half this album's audience: an IME's
          Enter commits the candidate, and swallowing it would send 拼音.

    */}
      <form className="l-say" onSubmit={onSubmit} onKeyDown={onKeyDown}>
        <input
          className="l-say-text"
          type="text"
          value={text}
          maxLength={MAX_TEXT}
          /* No placeholder: this field IS a message, and a message with grey
             instructions inside it is not one. The prompt sits beside the caret
             instead — see the ghost below. */
          placeholder=""
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
        {/* The caret is the whole affordance here. Everything else about a
            riser-shaped input says "message"; one blinking bar is what says
            "yours". It is drawn rather than relying on the real text caret,
            which is invisible until the field has focus — and the field not
            looking focusable is the exact problem. */}
        {!text && (
          <span className="l-say-ghost" aria-hidden>
            <span className="l-say-caret" />
            say something to the water
          </span>
        )}

        <input
          className="l-say-name"
          type="text"
          value={name}
          maxLength={MAX_NAME}
          /* "sign it" is an invitation, and once accepted it is in the way:
             click in and you should get a caret and nothing else. Done in state
             rather than with :focus::placeholder because the aria-label is what
             actually names the field — the placeholder here is copy, not a
             label, and copy that has served its purpose can leave. */
          placeholder={signing ? '' : 'sign it'}
          aria-label="Your name, optional"
          autoComplete="nickname"
          onFocus={() => setSigning(true)}
          onBlur={() => setSigning(false)}
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

        <button className="l-say-go" type="submit" disabled={!text.trim() || state === 'sending'}>
          <span className="l-say-go-ink">{state === 'sending' ? '…' : 'send'}</span>
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
  --water-top:13dvh;--water-h:62dvh;

  /* Where a riser is born. Off the bottom edge, so the field fills the whole
     screen — see the note on the composer for the version of this that emptied
     a band at the bottom instead, and why it lost. */
  --rise-from:100dvh}

/* The stage owns the dark down here — see .l-floor in Landing. This screen
   paints nothing of its own over the picture, which is what keeps the grain
   (a layer under the scroller) from being buried by it. */
.l-three>*{position:relative;z-index:1}

/* The empty state, and the only thing the site itself says on this screen.
   Sits where the risers will be, so the screen does not change shape when the
   first one arrives. */
/* Tracking came down from .3em when this line stopped being Chinese. Wide
   tracking is what makes 还没有人说话 read as considered rather than cramped;
   on a Latin sentence the same value pulls the words apart into a label, and
   this is a sentence. Italic Cormorant, so it is in the same voice as the
   prompt in the composer — the two are the only things the screen says. */
.l-risers-none{position:absolute;left:0;right:0;top:42%;z-index:2;
  margin:0;text-align:center;pointer-events:none;
  font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
  font-size:clamp(14px,2vh,18px);letter-spacing:.03em;
  color:rgba(196,222,240,.36)}

/* ---- the water ---- */
.l-risers{position:absolute;left:0;right:0;top:0;bottom:0;margin:0;padding:0;
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
.l-riser{position:absolute;top:0;inset-inline-start:var(--x);
  max-inline-size:min(28ch,30vw);will-change:transform;
  font-family:'Cormorant Garamond',Georgia,serif;
  /* A floor under the parallax. --scale runs to .72 for the furthest messages,
     and on a short viewport that took the smallest risers to 9.7px, which is
     not distance, it is unreadable. Depth is allowed to make a message quieter;
     it is not allowed to make it a texture. */
  font-size:max(12.5px,calc(clamp(15px,2.05vh,23px) * var(--scale)));
  line-height:1.42;color:rgb(224,240,250);
  text-shadow:0 0 calc(16px * var(--scale)) rgba(96,172,220,calc(var(--dim) * .5));
  animation:l-riser-up var(--dur) linear var(--delay) infinite}

/* Floor to surface, fading at both ends.
   The fade is inside the keyframe rather than done with a mask over the layer:
   a mask forces the whole viewport-sized subtree into one render surface and
   re-rasters it every frame — the exact cost the glimmers were removed for.
   Four opacity stops cost nothing and solve the same problem, which is that a
   message must not pop into existence at the bottom edge or blink out at the
   top. var(--dim) in the middle two stops is what keeps the depth parallax:
   the keyframe fades TO the message's own brightness, not to 1. */
@keyframes l-riser-up{
  0%{transform:translate3d(0,var(--rise-from,100dvh),0);opacity:0}
  /* Sixteen, not eight. The long fade-in is doing two jobs: things should
     emerge out of the dark rather than switch on at the bottom edge, and it
     means anything crossing the composer — which sits low, in the first tenth
     of the travel — is at less than half its brightness while it does. */
  16%{opacity:var(--dim)}
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
.l-riser-in{display:block;will-change:transform;
  animation:l-riser-sway var(--sway) ease-in-out var(--sway-delay) infinite alternate}
@keyframes l-riser-sway{
  from{transform:translate3d(calc(var(--sway-px) * -1),0,0)}
  to{transform:translate3d(var(--sway-px),0,0)}}

/* Just-arrived. Brighter for one rise, then it is one of the others. A filter,
   so it composites with both transforms instead of fighting either for one. */
.l-riser.is-fresh{animation:l-riser-up var(--dur) linear var(--delay) infinite,
  l-riser-lit 9s ease-out both}
@keyframes l-riser-lit{
  0%{filter:brightness(1.8) saturate(.9)}
  100%{filter:brightness(1)}}

.l-riser-name{display:block;margin-block-start:.24em;font-size:.72em;
  letter-spacing:.06em;opacity:.62;font-style:italic}

/* Off this screen the water is still there and still costing frames. Paused,
   it costs nothing — and because the animations keep their position, coming
   back does not restart the sea. */
.l-three:not(.is-in) .l-riser,
.l-three:not(.is-in) .l-riser-in{animation-play-state:paused}

/* ---- the composer ------------------------------------------------------
   No box, no blur, no radius, no fill. The first version was a pill with a
   border and a backdrop-blur — the shape a chat input has on every product on
   the internet, and the shape nothing else on this site has. Two alternatives
   with less furniture were built beside this one and cut; see the note in the
   markup. */
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

/* ---- the composer ----
   No form at all. It is set exactly like a message already in the water — same
   face, same size, same glow — held still, and sending lets go of it.

   Built once and it failed, in the two ways a design with no furniture can:
   you could not tell it was an input, and the risers went straight through it.
   Both are the same fact. Once messages travel UPWARD, the bottom of the screen
   is where messages are BORN, so anything parked there is guaranteed to be
   collided with by things that look exactly like it. A rule fixes that by
   declaring "not a message" — which is designs 1 and 2, and is the furniture
   this one refuses.

   The first fix was to part the water — empty a band at the bottom and have
   risers begin their travel at the composer's own line. It worked, and it was
   wrong: **the field filling the entire screen is the effect.** Cutting a strip
   off the bottom to protect one control traded the thing people come for
   against a problem the control could solve locally. Kept as a note because the
   idea was good and the trade was not: if the composer ever moves somewhere
   with room of its own, that version is waiting.

   What it does instead is win locally, three ways, none of them furniture:

     · **depth**: the composer is in front, and risers go behind it. A pool in
       the floor's own colour, soft to nothing at every edge, so a message
       crossing under it is occluded rather than interleaved. An earlier version
       of this pool was cut for being a patch of grey on an oil painting — the
       difference now is the colour and the falloff. It is not a scrim laid over
       the picture, it is the same deep the picture already is, thicker where
       the composer sits. Water is allowed to be denser somewhere.
     · **a tight halo**, hugging the glyphs, doing the last few percent the pool
       cannot: it stops a crossing message's strokes merging with the
       composer's at the exact edge of the pool. Same construction as every
       white label on the shore, which survives a much brighter ground.
     · **a dim light of its own.** Qi's call, and it is the piece that finally
       makes the thing announce itself without becoming an object: the water
       around the composer is lit, faintly, the way something alive down there
       would be. Light is allowed here and objects are not — the same rule the
       shafts are built on, and the reason the wide DARK pool that was tried
       first had to go. It breathes on a slow cycle, deliberately not the
       album's 60bpm: the heartbeat belongs to the record, and a control that
       borrowed it would be claiming to be part of the work. It brightens when
       you are in the field, which is the only state change on this screen.
     · **stillness.** It is the only thing on the screen holding still. In a
       field where everything else is moving, that reads — it just cannot be
       photographed, which is why the screenshots of this design looked worse
       than the design is.
     · **one caret**, blinking, which is the one glyph on earth that means
       "type here". *One* is the load-bearing word: the drawn caret and the
       browser's real one were two different marks in two different places —
       the drawn one at the left of a centred prompt, the real one appearing
       mid-line the moment you typed. Two carets that swap positions do not
       read as a caret at all. They are the same mark now: the field is
       left-aligned, the drawn caret sits exactly where the real one will be,
       and it hands over on focus without moving.

   The long fade-in does the rest of the work: the composer sits inside the
   first tenth of the travel, where a riser is still under half its brightness.
   Nothing is being hidden — the bottom of the screen is full of messages, they
   are simply still coming out of the dark down there, which is where they
   should be coming out of. */
/* Left-aligned, not centred, and that is the caret's doing rather than a
   typographic preference. A centred field puts the insertion point in the
   middle of the box when it is empty and walks it outward as you type; the
   drawn caret can only be in one place. Ragged-right, the two are the same
   point — start of the line — and typing simply moves it right, which is what
   a caret is supposed to do. */
.l-three .l-say{
  flex-wrap:wrap;gap:.34em .6em;justify-content:flex-start;text-align:left;
  inline-size:min(32ch,calc(100vw - 48px));
  /* Set here so the glow below can be sized in em and land somewhere
     predictable — the form otherwise inherits whatever the section has. */
  font-size:clamp(16px,2.05vh,21px);
  bottom:calc(clamp(46px,8vh,86px) + var(--bar))}

/* The pool that puts the composer in front.
   .l-say is its own stacking context at z-index 2, so both of these sit under
   its type on a negative z-index and still comfortably over the water at
   z-index 1 — the occlusion is real, not a trick of contrast.

   Two layers, in this order: the pool hides, then the light is added over it.
   One layer cannot do both, because the thing that hides has to be nearly
   opaque and the thing that glows has to be nearly not.

   Same geometry rule as the glow below — last stop x radius < 50% on BOTH axes
   — because an occluder with an edge is a box, and a box is what this design
   exists to avoid. And the colour is the floor's own, not a grey: this is not a
   scrim laid over the picture, it is the water being denser here. */
.l-three .l-say::after{content:'';position:absolute;z-index:-2;
  inset:-3.6em -7em;pointer-events:none;
  /* A plateau, then a shoulder — not a single ramp. A plain ramp from the
     centre was measured against a riser parked exactly behind the composer and
     it only reached ~.35 alpha at the far end of the words: dimmed, not
     occluded, which is worse than either. The near-opaque part has to be at
     least as wide as the text it is hiding things behind, and only then start
     falling away. It is short vertically for the same reason in reverse: the
     composer is two lines tall, so anything taller than that is dark for no
     one's benefit. */
  background:radial-gradient(46% 48% at 50% 50%,
    rgba(2,11,23,.97) 0%,rgba(2,11,23,.93) 52%,
    rgba(2,11,23,.5) 70%,rgba(2,11,23,0) 96%)}

/* The dim light, over the pool.

   **The gradient must reach fully transparent INSIDE its own box**, and getting
   that wrong is what made the first version read as a banner rather than as a
   glow. A radial-gradient sized '56% 100%' gives an ellipse whose vertical
   radius is the box's full height — so at the top and bottom edges the ramp was
   still at ~.04 alpha and simply stopped, which is a straight horizontal edge,
   which is the one thing a glow cannot have. Percentages in a radial-gradient
   resolve per axis, so the rule is: last stop × radius < 50% on BOTH axes.
   Here 72% × 44% = 32% and 72% × 46% = 33%, comfortably inside a box that the
   negative insets have already made much bigger than the words.

   It is also nearly as tall as it is wide, on purpose — 一团, a body of light
   the composer sits inside, not a bar behind a line of text. */
.l-three .l-say::before{content:'';position:absolute;z-index:-1;
  inset:-7.5em -8em;pointer-events:none;
  background:radial-gradient(44% 46% at 50% 50%,
    rgba(122,186,232,.2),rgba(122,186,232,.075) 40%,rgba(122,186,232,0) 72%);
  animation:l-say-flicker 9.7s ease-in-out infinite,
            l-say-flicker-b 6.1s ease-in-out infinite;
  transition:opacity .5s ease,filter .5s ease}

/* It flickers, and the flicker is TWO animations on near-prime periods rather
   than one — 9.7s on opacity, 6.1s on brightness. A single loop of any length
   is findable, and once you have found it a flicker becomes a strobe; two that
   never come back into phase read as an unstable light and nothing else. This
   is the same rule the light shafts are built on (17/23/29/37/43s), one screen
   down. If it ever needs another layer, add another near-prime — do not round.

   Neither period is 1s. The album's beat is 60bpm and it belongs to the record;
   a text field borrowing it would be claiming to be part of the work rather
   than the way in. */
@keyframes l-say-flicker{
  0%{opacity:.74}  9%{opacity:.97}  17%{opacity:.62}
  26%{opacity:.9}  34%{opacity:.7}  43%{opacity:1}
  51%{opacity:.66} 60%{opacity:.88} 68%{opacity:.58}
  77%{opacity:.93} 85%{opacity:.72} 93%{opacity:.86}
  100%{opacity:.74}}
@keyframes l-say-flicker-b{
  0%{filter:brightness(1)}    13%{filter:brightness(1.16)}
  29%{filter:brightness(.88)} 47%{filter:brightness(1.1)}
  61%{filter:brightness(.92)} 78%{filter:brightness(1.13)}
  100%{filter:brightness(1)}}

/* Steady while you are in it. The one state change on this screen, and the
   right way round: an unstable light that settles when touched is alive. */
.l-three .l-say:focus-within::before{
  animation-play-state:paused,paused;opacity:1;filter:brightness(1.12)}


.l-three input,
.l-three .l-say-ghost{
  text-align:left;
  /* Two shadows doing opposite jobs on the same glyphs. The blue spread is what
     makes this read as a message in the water like all the others; the tight
     dark pair is what keeps it readable when one of them crosses behind. Order
     matters — the dark is painted last, so it sits nearest the letter. */
  text-shadow:0 0 18px rgba(96,172,220,.4),
              0 0 9px rgba(2,10,20,.8),
              0 1px 2px rgba(2,10,20,.9)}
.l-three input{color:rgba(228,242,252,.94)}
.l-three .l-say-text{flex:1 0 100%;caret-color:rgba(214,238,254,.95)}
/* The name sits under the message, and clicking it should give you a caret and
   nothing else — the word "sign it" is an invitation, and once accepted it is
   just in the way. Transparent rather than removed, so the box does not resize
   under the pointer that just landed in it. */
.l-three .l-say-name{flex:0 0 auto;inline-size:8em;
  font-size:.74em;opacity:.6;caret-color:rgba(214,238,254,.95)}
.l-three .l-say-name:focus{opacity:.85}
/* Pushed to the far end of the second line, so the name and the send are the
   two ends of one row rather than a pair of words stuck together. */
.landing .l-three .l-say-go{margin-inline-start:auto}
.l-three .l-say-ghost{position:absolute;left:0;right:0;top:0;
  pointer-events:none;color:rgba(184,212,232,.34);font-style:italic;
  font-family:'Cormorant Garamond',Georgia,serif;
  font-size:clamp(16px,2.05vh,21px);line-height:1.5}
.l-three .l-say:focus-within .l-say-ghost{color:rgba(190,218,238,.42)}
/* Handover. The drawn caret goes when the real one arrives, and goes by
   visibility rather than by display — the prompt after it must not shift
   sideways by a caret's width at the exact moment someone clicks into the
   field, which is the one moment they are looking straight at it. */
.l-three .l-say:focus-within .l-say-caret{visibility:hidden}
/* 1s, steps(1) — a real caret's rate, and the album's 60bpm, which are the same
   number. Not a soft pulse: a soft pulse reads as decoration, and the hard
   on/off is the entire reason anyone recognises a caret. */
/* 2px, not 1. A hairline is the site's language for structure, and this is the
   opposite of structure — it is the one mark on the screen that has to be
   noticed, on a ground with grain over it, at half opacity for half of every
   second. 1px lost that fight. */
.l-say-caret{display:inline-block;inline-size:2px;block-size:1.1em;
  vertical-align:-.18em;margin-inline-end:.4em;
  background:rgba(222,242,255,.95);
  box-shadow:0 0 10px rgba(150,208,246,.55);
  animation:l-say-blink 1s steps(1,end) infinite}
@keyframes l-say-blink{0%,52%{opacity:1}53%,100%{opacity:0}}
/* Nothing to let go of yet, so the words for it are not there either. Hidden
   rather than dimmed: in a design with no furniture, a greyed-out control is
   just another piece of furniture. */
.landing .l-three .l-say-go:disabled{opacity:0}
.landing .l-three .l-say-go{
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
  .l-say,.l-risers-none{opacity:0}
  .l-three.is-in .l-say{animation:l-in .9s cubic-bezier(.2,.7,.2,1) .25s both}
  .l-three.is-in .l-risers-none{animation:l-in 1.2s cubic-bezier(.2,.7,.2,1) .5s both}}

/* Asked for less motion, and given a guestbook instead of a current: the same
   messages, newest first, holding still. The drift is the presentation, not the
   content, so nothing is lost by dropping it. */
@media (prefers-reduced-motion:reduce){
  .l-risers{position:absolute;top:var(--water-top);bottom:auto;
    height:var(--water-h);overflow-y:auto;pointer-events:auto;
    display:flex;flex-direction:column;align-items:center;gap:.85em;
    padding:0 22px}
  .l-riser{position:static;animation:none;text-align:center;
    inset-inline-start:auto;opacity:1;
    max-inline-size:min(620px,92vw);color:rgba(224,240,250,.86);
    font-size:clamp(15px,2vh,21px)}
  .l-riser.is-fresh{animation:none}
  /* The sway is a transform, and animation:none freezes it at whatever the
     from-frame says — every block offset left by its own amplitude. */
  .l-riser-in{animation:none;transform:none}}

@media (max-width:640px){
  .l-three{--water-top:20dvh;--water-h:52dvh}
  /* A riser has to be wide enough to be a paragraph and narrow enough to leave
     room beside it. 38vw of a phone is 140px — a 140-character message would
     come out eight lines tall and read as a column, not a scrap. So the block
     gets most of the width here, and the starting position is scaled down to
     match (the offset is an inline style, so the media query multiplies it
     rather than replacing it: 0–61% becomes 0–23%, which keeps 74vw on screen). */
  /* The offset is NOT recomputed here — see geometry(). This block sets only
     what is genuinely presentational: how wide a riser may be, and how big. */
  .l-riser{max-inline-size:min(30ch,74vw);
    font-size:max(12.5px,calc(clamp(14px,4vw,17px) * var(--scale)))}
  /* Half the sway: the same swing that reads as drift on a desktop is a third
     of a phone's width, and a block sliding that far is being blown, not adrift. */
  .l-riser-in{animation-name:l-riser-sway-narrow}
  .l-say{width:calc(100vw - 34px)}
  .l-say-name{inline-size:54px}
  /* nowrap keeps the counter and the two short errors on one line, which is
     what it is for — but the dev-only store warning is a sentence and would
     run off both edges of a phone. */
  .l-say-note{white-space:normal;padding:0 22px}}
@keyframes l-riser-sway-narrow{
  from{transform:translate3d(calc(var(--sway-px) * -.45),0,0)}
  to{transform:translate3d(calc(var(--sway-px) * .45),0,0)}}
`;
