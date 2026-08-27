/**
 * Quantcast Measure, kept off the critical path.
 *
 * Quantcast answers a question PostHog structurally cannot: *who* the audience
 * is — age, gender, interests, the demographic panel data an indie record needs
 * when it starts talking to playlists, press and (eventually) ad platforms.
 * PostHog answers what people *did* on the page. The two do not overlap and
 * neither replaces the other; see ANALYTICS.md.
 *
 * ## Why this is not a <script> tag in the layout
 *
 * The vendor snippet is a synchronous inline script that injects `quant.js`
 * before the first existing <script> on the page. Pasted into the <head> of a
 * Next app that is fighting for its LCP — the hero painting, the carved title,
 * the countdown — it lands in front of exactly the work that matters. So the
 * snippet's two effects (queue a PageView, fetch quant.js) are reproduced here
 * verbatim and fired from the same idle callback that starts PostHog. See
 * components/Analytics.tsx for that timing and why it exists.
 *
 * Deferring it is safe in a way it would not be on most sites: `_qevents` is a
 * queue by design, quant.js drains whatever is in it whenever it arrives, and
 * nothing on this page needs to fire a second Quantcast event later.
 *
 * ## Why one PageView is all of it
 *
 * The site has no client-side navigation — no next/link, no router.push
 * anywhere — so `/`, `/descent` and `/preview-jelly` are each a real document
 * load that runs this module fresh. One push per load is therefore one push per
 * page seen. If a <Link> is ever added, this stops being true and a route
 * change will need to push another `_fp.event.PageView` by hand.
 *
 * Last updated 2026-08-26.
 */

/** The Quantcast account this site reports to. Public by nature — it ships in
 *  the page source of every site that runs the tag, so it is a constant here
 *  rather than an env var. */
const QACCT = 'p-tfadYbvEcRkfz';

type QEvent = { qacct: string; labels?: string };

declare global {
  interface Window {
    _qevents?: QEvent[];
  }
}

let started = false;

/**
 * True unless we are on a dev host. Qi runs several worktrees at once and
 * reloads all day; against a measurement product whose whole output is an
 * audience profile, that traffic is not neutral noise — it is one laptop in
 * Shanghai voting a few hundred times. `?qc=1` forces it on so the tag can
 * actually be verified locally.
 */
function shouldLoad(): boolean {
  const { hostname, search } = window.location;
  if (new URLSearchParams(search).get('qc') === '1') return true;
  return hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.endsWith('.local');
}

/**
 * Queue the pageview and fetch quant.js. Idempotent, safe under StrictMode's
 * double-invoked effects, and a no-op on the server.
 */
export function startQuantcast(): void {
  if (started || typeof window === 'undefined') return;
  if (!shouldLoad()) return;
  started = true;

  window._qevents = window._qevents || [];
  window._qevents.push({ qacct: QACCT, labels: '_fp.event.PageView' });

  const el = document.createElement('script');
  // The vendor's own protocol switch. We are https everywhere in production, so
  // this only ever picks `edge` on a plain-http dev host — where an https asset
  // would be fine too, but there is no reason to deviate from their tag.
  el.src =
    (document.location.protocol === 'https:' ? 'https://secure' : 'http://edge') +
    '.quantserve.com/quant.js';
  el.async = true;
  el.type = 'text/javascript';

  // Their snippet inserts before the first <script>; ours falls back to <head>
  // because on a Next page there is no guarantee one has parsed yet at the
  // moment an idle callback runs.
  const first = document.getElementsByTagName('script')[0];
  if (first?.parentNode) first.parentNode.insertBefore(el, first);
  else document.head.appendChild(el);
}
