/**
 * PostHog, kept off the critical path.
 *
 * The whole point of this module is that nothing above it has to know PostHog
 * exists. Call `track('demo_started', {...})` from anywhere in the client and
 * one of three things happens, all of them fine:
 *
 *   - analytics is up      → the event goes out
 *   - analytics is loading → the event waits in `pending` and goes out on flush
 *   - there is no key      → the event is dropped, silently
 *
 * The third case is not a failure mode, it is the default for local dev and for
 * anyone who clones this. An unconfigured site must behave exactly like a site
 * with no analytics in it — no console noise, no failed requests, no key.
 *
 * ## Why the SDK is imported dynamically
 *
 * `posthog-js` is ~250 kB raw / ~60 kB gzipped, against a front page whose own
 * code is ~37 kB — a static import would nearly double it and put it in front
 * of the hero painting. So it is an `await import()` fired from an idle
 * callback after mount: Next splits it into its own chunk and the browser
 * fetches it when it has nothing better to do.
 *
 * Measured 2026-08-23: / went 139 kB → 141 kB First Load JS. The SDK itself
 * lands in a separate chunk that the first paint never waits for. If that
 * number ever jumps ~60 kB, something has pulled posthog-js into the static
 * graph — a top-level `import posthog from 'posthog-js'` somewhere, most
 * likely — and the whole point of this file has been quietly lost.
 *
 * The cost of that is a window — a second or two on a slow phone — where the
 * page is interactive but the SDK is not loaded. Someone can absolutely hit
 * play in that window, and that is the click we most want to see. Hence the
 * queue: `track()` is callable from the first paint and events are held, in
 * order, until the SDK arrives.
 *
 * ## Why the events go to /ingest
 *
 * `api_host` defaults to this site's own `/ingest`, which next.config.mjs
 * rewrites to PostHog. A request to `qi.land/ingest/...` is first-party, so the
 * blocklists that kill `*.i.posthog.com` outright do not fire on it. This is
 * not a small correction on a site like this one — the audience for an indie
 * record skews hard toward people running uBlock, and unproxied they are simply
 * invisible.
 *
 * Last updated 2026-08-23.
 */

import type { PostHog } from 'posthog-js';

/** Event properties. Flat, JSON-able — no nesting, PostHog charts read columns. */
export type EventProps = Record<string, string | number | boolean | null | undefined>;

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

/**
 * Where events are POSTed. The default is this site's own path, proxied in
 * next.config.mjs; point it straight at PostHog only to debug the proxy itself.
 */
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest';

/**
 * Where the *app* lives, as opposed to where events go. Only the toolbar and
 * the "view in PostHog" links use it, and without it they resolve against
 * /ingest and 404. Flip to https://eu.posthog.com on an EU project — and see
 * next.config.mjs, which has to be flipped in step.
 */
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com';

let client: PostHog | null = null;
let starting = false;

/** Events fired before the SDK finished loading. Bounded — see `track`. */
const pending: { event: string; props?: EventProps }[] = [];
const PENDING_MAX = 50;

/** True when a key is configured, i.e. when any of this does anything at all. */
export const analyticsEnabled = Boolean(KEY);

/**
 * ?ph=debug — print every event, with its properties, as it is recorded.
 *
 * PostHog's own debug mode logs the event name but collapses the properties,
 * and the properties are the part worth checking: a milestone that is off by
 * one, a percent that is NaN, a track number that is 0. Read once, at module
 * load, so `track` stays a straight function call.
 */
const DEBUG =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('ph') === 'debug';

/**
 * Load and initialise the SDK. Idempotent, safe to call from an effect that
 * React's StrictMode runs twice, and safe to call on the server (it no-ops).
 */
export async function startAnalytics(): Promise<void> {
  if (!KEY || starting || client || typeof window === 'undefined') return;
  starting = true;

  try {
    const { default: posthog } = await import('posthog-js');

    posthog.init(KEY, {
      api_host: HOST,
      ui_host: UI_HOST,
      /*
       * Opts into PostHog's modern defaults rather than its 2020 ones. The one
       * that matters here is capture_pageview: 'history_change' — the App
       * Router navigates with pushState and never reloads, so the legacy
       * "capture on script load" default would record exactly one pageview per
       * visit no matter how many routes were seen.
       */
      defaults: '2026-01-30',
      /*
       * On. Every control on this page is a real <button> with a spoken label,
       * so autocapture arrives already legible — and it is the only thing that
       * will have recorded the click we did not think to instrument. The named
       * events below are the questions we know we have; this is for the ones
       * we find out we have in November.
       */
      autocapture: true,
      /*
       * Nobody logs in here and `identify` is never called, so in practice this
       * means the same thing 'never' would: no person profile is created for
       * any visitor, and the events carry a distinct_id, which is all the
       * funnels need.
       *
       * It is 'identified_only' rather than 'never' for one reason. PostHog
       * marks a localhost visitor as an internal/test user by writing a person
       * property, and under 'never' that write is refused — so every hour of
       * local development lands in the same numbers as real listeners, with no
       * way to filter it out afterwards. This keeps that one door open without
       * opening any other.
       */
      person_profiles: 'identified_only',
      /*
       * Page-load and interaction latency, from Chrome's own web-vitals
       * library: LCP, FCP, CLS, INP, one batched event per pageview.
       *
       * On this page LCP is essentially "how long until the painting is
       * there", and the painting IS the page — every funnel below it is
       * conditional on somebody having waited for it. Without this, a slow
       * first screen shows up only as a bounce rate, i.e. as visitors who look
       * uninterested rather than as a site that was still blank.
       *
       * `network_timing` stays off: it only feeds session replay's waterfall,
       * which is not on by default here.
       */
      capture_performance: { web_vitals: true },
      /*
       * Session replay is left to the project's own setting in the PostHog
       * dashboard rather than pinned here, because it is the one knob whose
       * right value changes with the month — worth watching in the week a
       * single is posted, wasteful the rest of the time — and a knob you can
       * turn without a deploy is a knob that actually gets turned.
       */
    });

    if (DEBUG) posthog.debug();

    client = posthog;
    for (const q of pending.splice(0)) posthog.capture(q.event, q.props);
  } catch {
    // A blocked or failed chunk is not an error the visitor should ever learn
    // about. Analytics stays off for the session; the page is untouched.
    starting = false;
  }
}

/**
 * Record something that happened. Never throws, never blocks, never needs the
 * caller to know whether analytics is loaded, configured, or blocked.
 */
export function track(event: string, props?: EventProps): void {
  if (DEBUG) console.log('%c[qi] ' + event, 'color:#8cb9d4', props ?? {});
  if (!KEY) return;
  if (client) {
    client.capture(event, props);
    return;
  }
  // Bounded, because if the SDK never arrives (blocked chunk, no network) this
  // array is the only thing that grows — and a player emitting a progress event
  // every quarter track would grow it all evening.
  if (pending.length < PENDING_MAX) pending.push({ event, props });
}
