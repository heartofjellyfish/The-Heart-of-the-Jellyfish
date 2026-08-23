# Analytics

*Last updated 2026-08-23.*

PostHog. What it is for, what it records, and the rules that keep it from
turning into a pile of events nobody reads.

Code: [lib/analytics.ts](lib/analytics.ts) (the wrapper),
[components/Analytics.tsx](components/Analytics.tsx) (where it is switched on),
[next.config.mjs](next.config.mjs) (the first-party proxy),
[components/Landing.tsx](components/Landing.tsx) (every named event).

## The two questions

The site has exactly two jobs before 2026.12.20, so the taxonomy answers two
questions and deliberately nothing else:

1. **Does a visitor end up on the mailing list?**
   `subscribe_opened → subscribe_submitted → subscribe_completed` is the funnel,
   with `subscribe_dismissed` and `subscribe_failed` on the ways out of it.
2. **Which of the ten demos holds someone?**
   `demo_started → demo_progress (25/50/75) → demo_finished`, per track. Read as
   a retention curve per title, that is a running order argument with evidence
   in it.

`tracklist_reached` sits between the two: it is the only measure of whether the
second screen is discovered at all, and if it is low, the poem is a room nobody
walks into and that is a design problem, not a copy problem.

Anything that does not serve one of those three is not worth an event. It costs
quota, it costs a line in this file, and it dilutes the charts that matter.

## Events

### The descent

| Event | Properties | Fired when |
|---|---|---|
| `tracklist_reached` | `via: scroll \| button \| chevron` | The descent passes 30%, **once per page load**. `via` is set by whichever control called `goTo(1)`, defaulting to `scroll` — most people just scroll |
| `surfaced` | — | The `QI · 琦` wordmark takes them back up. The only door out of screen two |

### The demo player

Every one of these carries `track` (1–10) and `title`. The number joins and
sorts; the title makes the table readable.

| Event | Extra properties | Fired when |
|---|---|---|
| `demo_started` | `from: hero \| poem \| keyboard \| auto` | A new track is loaded. `auto` is the next track starting on its own — it is not a play anyone asked for, so never count it as one |
| `demo_progress` | `milestone: 25 \| 50 \| 75` | The clock **plays** past a quarter. Once per mark per load. A quarter that was *jumped* over by a seek is marked spent but never reported — dragging to the end is not listening to the end, and without that rule one scrub would file 25, 50 and 75 in the same tick and flatten every retention curve |
| `demo_finished` | — | The track ran out |
| `demo_paused` | `percent` | Pause. *Where* they stopped is the whole signal — 8% and 90% are opposite verdicts |
| `demo_resumed` | `percent` | Play, on the track already loaded |
| `demo_seeked` | `percent`, `control: bar \| poem_line` | A scrub gesture ends. Once per gesture, not per pointermove |
| `demo_unavailable` | — | The audio element errored: the demo is not uploaded, or the file 404s. Invisible in a play count, so it gets its own event |
| `player_closed` | `percent` | The bar's ✕. The one unambiguous "done listening" on the page |

### The mailing list

| Event | Properties | Fired when |
|---|---|---|
| `subscribe_opened` | `via: nav` | The panel opens. `via` is already a property because PRE-SAVE will not stay the only way in |
| `subscribe_submitted` | — | **yes** is pressed, before the address is judged. So a wave of submits with no completes reads as our validation being wrong, not as nobody caring |
| `subscribe_completed` | — | MailerLite took it. The conversion |
| `subscribe_failed` | `reason: email_format \| email_rejected \| server \| network`, `status` | Any of the ways it does not land. The HTTP status rides along because a 503 is a missing key on Vercel and a 502 is MailerLite, and the visitor sees the same sentence for both |
| `subscribe_dismissed` | `state: idle \| sending \| error` | The panel closes without a signup, from the ✕ **or** Escape. `idle` is a look and a shrug; `error` is someone who tried and was turned away |

### Not written by us

`$pageview` / `$pageleave` (App Router navigations included — see `defaults`
below) and autocapture clicks. Autocapture is on because every control here is a
real `<button>` with a spoken label, so it arrives already legible, and it is the
only thing that will have recorded the click we did not think to instrument.

## Rules

- **No personal data leaves the page.** The subscriber's email is posted to
  `/api/subscribe` and lives in MailerLite only. It is never a PostHog property
  and `posthog.identify` is never called. One list, one unsubscribe to honour.
- **`person_profiles: 'identified_only'`, and `identify` is never called.** Which
  means no profile is ever created for a visitor — the same outcome `'never'`
  would give. It is not set to `'never'` because PostHog flags a localhost
  visitor as an internal/test user by writing a person property, and `'never'`
  refuses that write: every hour of local development would then land in the
  same numbers as real listeners with no way to filter it out. Events still
  carry a `distinct_id`, which is all the funnels need.
- **Milestones, not streams.** Four events per track played, not a few hundred.
- **A seek is not a listen.** `seekToFraction` raises the milestone watermark
  without emitting, so scrubbing can neither manufacture progress nor (seeking
  backwards) report the same quarter twice.
- **One event per intention.** A drag across the seek bar is one `demo_seeked`,
  fired on pointer-up.
- **Session replay is not configured in code**, only in the PostHog dashboard.
  It is the one knob whose right value changes with the month — worth watching
  the week a single is posted, wasteful the rest of the time — and a knob you can
  turn without a deploy is a knob that actually gets turned.

## Setup

Two environment variables, in Vercel and in `.env.local` for local work. With
the key unset the whole thing is a no-op: no requests, no console noise, no
behaviour change. That is the default for anyone who clones this.

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx        # Project settings → Project API key
NEXT_PUBLIC_POSTHOG_UI_HOST=https://us.posthog.com    # optional; eu.posthog.com on an EU project
POSTHOG_REGION=us                            # optional; `eu` on an EU project
```

`POSTHOG_REGION` is read by `next.config.mjs` **at build time** and picks which
PostHog the `/ingest` rewrite points at. On an EU project it and
`NEXT_PUBLIC_POSTHOG_UI_HOST` must be flipped together — they are separate hosts,
and getting one right while the other is wrong fails in a way that looks exactly
like a bad key.

### Why /ingest

Events are posted to `qi.land/ingest/...` and rewritten to PostHog. The point is
not speed, it is existing: content blockers ship `*.i.posthog.com` on their
default lists, and an indie record's audience runs uBlock at a rate that would
make an unproxied setup lose a large and *non-random* share of its visitors.
`skipTrailingSlashRedirect` in `next.config.mjs` is part of the proxy, not an
unrelated setting — without it Next answers some ingest POSTs with a 308 that a
beacon will not follow, and events vanish with no error anywhere.

### Why the SDK is loaded late

`posthog-js` is ~60 kB gzipped against a front page whose own code is ~37 kB. So
it is an `await import()` fired from `requestIdleCallback` after mount, which
puts it in its own chunk: measured on 2026-08-23, `/` went from 139 kB to 140 kB
First Load JS. If that ever jumps by ~60 kB, something has pulled the SDK into
the static graph and this is no longer true. The gap that opens up — a
second or two on a slow phone where the page is live and the SDK is not — is
covered by a queue in `lib/analytics.ts`, because the click most likely to land
in that gap is the play button.

### Checking it locally

```bash
npm run dev
```

Then open the page with `?ph=debug` — every event prints to the console as it is
sent, which is the only way to check a change to this taxonomy without waiting
on the PostHog UI.

## If you add an event

1. It has to answer one of the two questions at the top, or it does not go in.
2. Name it `noun_verbed`, past tense, snake case, like the ones above.
3. Add the row to the table here in the same commit.
4. Properties are flat and JSON-able. PostHog charts read columns, not trees.
