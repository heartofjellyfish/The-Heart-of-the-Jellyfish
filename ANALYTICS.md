# Analytics

*Last updated 2026-08-23.*

PostHog. What it is for, what it records, and the rules that keep it from
turning into a pile of events nobody reads.

Code: [lib/analytics.ts](lib/analytics.ts) (the wrapper),
[components/Analytics.tsx](components/Analytics.tsx) (where it is switched on),
[next.config.mjs](next.config.mjs) (the first-party proxy),
[components/Landing.tsx](components/Landing.tsx) (every named event).

## The questions

The taxonomy answers these and deliberately nothing else. If a proposed event
does not serve one of them, it does not go in — it costs quota, it costs a row
in this file, and it dilutes the charts that matter.

| Question | Answered by |
|---|---|
| Which demo gets played most? | `demo_started`, count by `title` — **exclude `from = auto`**, or the autoplay chain credits every track that follows a popular one |
| How far into each demo do people get? | `demo_progress` (25/50/75/100) broken down by `milestone` — one retention curve per track |
| Where does a demo lose people? | `demo_ended` by `percent` + `reason`. `reason` is what separates a song that ran out from one abandoned at 12% |
| Which passage is the one? | `demo_seeked` where `direction = back` — a rewind is a listener asking to hear a part again, the strongest "this bit" signal the page can produce |
| How patient is everyone? | `visit_summary.seconds_listened` and `.seconds_on_page`; per track, the shape of the `demo_progress` curve |
| Does anyone read the poem, and for how long? | `tracklist_reached` for whether, `visit_summary.poem_seconds` for how long |
| How many open the mailing list and never submit? | `subscribe_opened` → `subscribe_dismissed` where `state = idle` |
| How many come back? | PostHog's **Lifecycle** insight (new / returning / resurrecting / dormant) on `$pageview`. See *Returning visitors* below for what it can and cannot see |
| Is the site fast enough to have been seen at all? | `$web_vitals` (LCP/FCP/CLS/INP), plus `demo_started.ms_to_sound` and `subscribe_*.ms` |
| Does anyone find the painter? | `artist_found` for how many ever saw the man light up, `artist_clicked` for how many went to his site. The first is the denominator of the second |
| Does anyone write on the wall? | Not yet — the guestbook is a separate branch. The contract it should call is below |

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
| `demo_started` | `from: hero \| poem \| keyboard \| auto`, `ms_to_sound` | Sound actually began — fired when `play()` resolves, not when the button was pressed, so it carries how long the wait was. A press that never becomes sound is `demo_blocked` instead |
| `demo_progress` | `milestone: 25 \| 50 \| 75 \| 100` | The clock **plays** past a quarter. Once per mark per load. 100 comes from the `ended` handler, not the clock — the last `timeupdate` lands at 99-point-something as often as not, so a milestone waiting at 100 would under-report every completed listen |
| `demo_ended` | `percent`, `reason: finished \| switched \| closed \| left` | **Every** play ends exactly once, whatever the cause: ran out, switched away from, player closed, page left. This is the only event that says where a listen stopped. `left` fires on `pagehide` only — **never** when the tab is merely hidden, because audio keeps sounding in a background tab and someone who switches away and leaves it playing is the best listener the site has, not an abandonment at 12% |
| `demo_paused` | `percent` | Pause. *Where* they stopped is the signal — 8% and 90% are opposite verdicts |
| `demo_resumed` | `percent` | Play, on the track already loaded |
| `demo_seeked` | `from_percent`, `percent`, `direction: back \| forward`, `control: bar \| poem_line` | A scrub gesture ends. Once per gesture, not per pointermove. `direction = back` is the "play that part again" signal |
| `demo_blocked` | `error` (the DOMException name) | `play()` was refused. `NotAllowedError` is an autoplay policy or the iOS mute switch, `AbortError` is playback interrupted, `NotSupportedError` is the file. Ours to fix, and invisible if it were filed as a missing demo |
| `demo_unavailable` | `error` (the `MediaError` code) | The media element errored: demo not uploaded, 404, or a body that will not decode |

### The mailing list

| Event | Properties | Fired when |
|---|---|---|
| `subscribe_opened` | `via: nav` | The panel opens. `via` is already a property because PRE-SAVE will not stay the only way in |
| `subscribe_submitted` | — | **yes** is pressed, before the address is judged. So a wave of submits with no completes reads as our validation being wrong, not as nobody caring |
| `subscribe_completed` | `ms` | MailerLite took it. The conversion |
| `subscribe_failed` | `reason: email_format \| email_rejected \| server \| network`, `status`, `ms` | Any of the ways it does not land. The HTTP status rides along because a 503 is a missing key on Vercel and a 502 is MailerLite, and the visitor sees the same sentence for both |
| `subscribe_dismissed` | `state: idle \| sending \| error` | The panel closes without a signup, from the ✕ **or** Escape. `idle` is a look and a shrug; `error` is someone who tried and was turned away |

### The credit

The front page is somebody else's painting, and the credit for it is worn by the
man standing in it: hovering his silhouette lights him and names **Sho Peng**,
and he is a link to [pengsho.com](https://pengsho.com). See `CREDITS.md`.

| Event | Properties | Fired when |
|---|---|---|
| `artist_found` | `via: hover \| keyboard` | The cursor has rested on the man for 250 ms, or a keyboard has focused him. **Once per visit** — sweeping over him six times is not six discoveries. The delay is deliberate: the cursor crosses that silhouette on its way to the play button, and an undelayed enter would be counting travel as interest |
| `artist_clicked` | — | They went to his site. Once per visit |

Read them together, never `artist_clicked` alone. The credit is invisible at
rest, so three clicks is either an excellent rate or a dismal one depending on
how many people ever found him — `artist_found` is the only denominator that
makes the number mean anything.

Both are desktop-only, and that is the truth rather than a gap. Below a 13/10
aspect ratio the crop takes him off the right-hand edge and the whole layer is
`display:none`, so on a phone there is no credit on the page to find. Where it
does survive on touch, `hover:none` leaves the caption permanently on — nothing
is hidden, so nothing is discovered. **A zero here is not evidence nobody
cares; check `$device_type` before concluding anything.**

Autocapture also records this click as `$autocapture`, since it is an anchor.
Ignore that copy — it is keyed on markup and will break the day the caption is
reworded. `artist_clicked` is the one to query.

### The visit

| Event | Properties | Fired when |
|---|---|---|
| `visit_summary` | `seconds_on_page`, `seconds_listened`, `tracks_played`, `poem_seconds`, `reached_tracklist`, `opened_subscribe`, `subscribed`, `final` | Every time the page is hidden, and again on `pagehide` (`final: true`). Values are **cumulative, not deltas** — see below |

`seconds_listened` is the most important number on this page: minutes of
attention rather than presses of a button, summed from the audio clock's own
forward steps so a seek adds nothing to it. `seconds_on_page` counts **visible**
time only — a tab left open in the background for three hours is not three hours
of attention.

**There may be more than one per visit, and the last one wins.** The first
version sent exactly one, on the first hide, and real traffic showed within the
hour why that is wrong: a visit backgrounded one second in filed
`seconds_on_page: 1, reached_tracklist: false` and then carried on for minutes
and *did* reach the tracklist, with the record already closed and lying. The web
has no "the visitor is finished" event, so treating the first hide as one
produces numbers that are wrong precisely in the visits that went best.

So every hide sends a cumulative snapshot, identical ones are suppressed, and
`final: true` marks the send from `pagehide`. **Any query over this event must
take the last row per `$session_id`** — the two dashboard tiles that read it are
SQL for exactly this reason. Typical visit: one or two rows.

A visit that was never visible sends nothing at all — a link cmd-clicked into a
background tab and closed unread is not a visit, and left in, each one files a
row of zeroes that drags down every average. It is the same line PostHog draws
by withholding `$pageview` until the tab is looked at.

### Not written by us

`$pageview` / `$pageleave` (App Router navigations included), `$autocapture`
clicks, `$web_vitals`, and `$set` for the internal-user flag on localhost.
Autocapture is on because every control here is a real `<button>` with a spoken
label, so it arrives already legible, and it is the only thing that will have
recorded the click we did not think to instrument.

## Latency

Three different waits, each with its own measure, because they fail
independently and only one of them is visible from a server:

- **The page** — `$web_vitals`, from Chrome's web-vitals library. LCP is
  effectively "how long until the painting is there", and the painting *is* the
  page: every funnel below it is conditional on somebody having waited. Without
  this a slow first screen shows up only as a bounce rate, i.e. as visitors who
  look uninterested rather than as a site that was still blank.
- **The audio** — `demo_started.ms_to_sound`. The demos are ~5 MB each and
  nothing is preloaded, so on a phone the gap between pressing a line and
  hearing anything is the moment the page is most likely to be abandoned.
- **The mailing list** — `subscribe_completed.ms` / `subscribe_failed.ms`. Our
  route is mostly MailerLite's round-trip; a third party that has got slow is
  otherwise only visible as people giving up on a spinner.

Not measured: server response time for the routes themselves. Vercel's own
dashboard has that, and duplicating it here would be a second, worse copy.

## Returning visitors

PostHog's **Lifecycle** insight (new / returning / resurrecting / dormant) works
on events alone — the `distinct_id` lives in `localStorage`+cookie and survives
across sessions, so no `identify` call is needed.

What it cannot see, and what to keep in mind before quoting the number:

- A different device or browser is a different person.
- Cleared storage is a new person.
- Safari's ITP caps script-written storage, so an iOS visitor returning weeks
  later can read as new. On a music site that skews mobile this undercounts
  rather than over-counts — treat returning-visitor counts as a **floor**.

The only durable identity this site has is the mailing list, and it is
deliberately not wired to PostHog. Calling `identify` with a hash of the email
on `subscribe_completed` would tie a signup to the visit that produced it — it
is a real option, and it is Qi's call, not a default.

## Where visitors are, and who counts as one

City, region and country come free on every event as `$geoip_city_name`,
`$geoip_subdivision_1_name` and `$geoip_country_name` — PostHog resolves them
from the IP at ingest. Nothing in this repo collects them and no location is
ever asked for in the browser. The **Where they are** tile on the dashboard is
the read.

**Why the numbers are already close to bot-free**, without a rule anyone
maintains — three independent layers, none of which we wrote:

1. A crawler that does not run JavaScript never loads the SDK. That is most of
   them, including every link-unfurl fetcher (Slack, iMessage, WhatsApp,
   Twitter) that hits the page when a link is pasted.
2. `posthog-js` ships a blocklist of ~70 known agent strings — `googlebot`,
   `gptbot`, `bytespider`, `perplexitybot`, `ahrefsbot`, `screaming frog`,
   `headlesschrome`, `cypress`, `vercel-screenshot` among them — and captures
   nothing at all for a match.
3. The tile counts `$pageview`, and PostHog withholds the initial `$pageview`
   until the tab is actually **visible**. Automation and headless runs sit in a
   background tab and never clear that bar. (This is also why the whole first
   day of testing produced zero pageviews — every automated tab is a background
   tab. It looked like a bug for an hour and was not.)

What is left through all three is a headless browser with a spoofed agent
string and a real viewport. Rare, and not worth building a fourth layer for.

**What the city actually means.** It is IP-derived, so read it as the metro and
never as the person: our own events came back with `$geoip_accuracy_radius`
between 5 and 100 km. A VPN reads as wherever it exits, a phone on mobile data
often resolves to the carrier's hub rather than the street the listener is
standing on, and office traffic resolves to the office. Country is close to
reliable; city is a strong hint. Fine for "the record is being heard in Warsaw",
wrong for anything narrower.

## Rules

- **No personal data leaves the page.** The subscriber's email is posted to
  `/api/subscribe` and lives in MailerLite only. It is never a PostHog property
  and `identify` is never called. One list, one unsubscribe to honour.
- **`person_profiles: 'identified_only'`, and `identify` is never called.** Which
  means no profile is ever created for a visitor — the same outcome `'never'`
  would give. It is not set to `'never'` because PostHog flags a localhost
  visitor as an internal/test user by writing a person property, and `'never'`
  refuses that write: every hour of local development would then land in the
  same numbers as real listeners with no way to filter it out.
- **Milestones, not streams.** Four marks per track played, not a few hundred.
- **A seek is not a listen.** `seekToFraction` raises the milestone watermark
  without emitting, so scrubbing can neither manufacture progress nor (seeking
  backwards) report the same quarter twice. `seconds_listened` ignores it too.
- **One event per intention.** A drag across the seek bar is one `demo_seeked`,
  fired on pointer-up.
- **One ending per play, always.** `endPlay` is idempotent per play, or a track
  that runs out would be filed twice — once as `finished` and once as an
  abandonment at 100% when the autoplay walks past it.
- **Session replay is not configured in code**, only in the PostHog dashboard.
  It is the one knob whose right value changes with the month — worth watching
  the week a single is posted, wasteful the rest of the time — and a knob you can
  turn without a deploy is a knob that actually gets turned.

## For the guestbook (screen three, separate branch)

The wall is being built on its own branch. When it lands, `import { track } from
'@/lib/analytics'` and call these — the names are reserved here so the two
branches cannot invent different ones for the same thing:

| Event | Properties | Fired when |
|---|---|---|
| `guestbook_reached` | — | Screen three becomes visible. Once per visit, same shape as `tracklist_reached` |
| `guestbook_focused` | — | The field is focused. The gap between this and `_submitted` is the abandonment the wall actually has |
| `guestbook_submitted` | `has_name: boolean`, `length` | Posted. Never the message text and never the name — the wall already displays those, and a copy in PostHog is a second place to have to delete from |
| `guestbook_failed` | `reason: empty \| rate_limited \| server`, `status`, `ms` | 400 / 429 / 502 from `/api/guestbook`. `rate_limited` is worth its own value: it is either a bot, or one enthusiastic person being told no |

Add `messages_posted` to `visit_summary` at the same time.

Nothing goes to PostHog that identifies a writer. The route already hashes the
IP for rate limiting and keeps no address; this must not be the thing that
reintroduces one.

## If you add an event

1. It has to answer a question in the table at the top, or it does not go in.
2. Name it `noun_verbed`, past tense, snake case, like the ones above.
3. Add the row to the table here in the same commit.
4. Properties are flat and JSON-able. PostHog charts read columns, not trees.

## Setup

Two environment variables, in Vercel and in `.env.local` for local work. With
the key unset the whole thing is a no-op: no requests, no console noise, no
behaviour change. That is the default for anyone who clones this.

```
NEXT_PUBLIC_POSTHOG_KEY=phc_xxxxxxxx        # Project settings → Project API key
NEXT_PUBLIC_POSTHOG_UI_HOST=https://us.posthog.com    # optional; eu.posthog.com on an EU project
POSTHOG_REGION=us                            # optional; `eu` on an EU project
```

qi.land's project is on **US cloud**, so both optional values are already right
and only the key needs setting.

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

`posthog-js` is ~60 kB gzipped against a front page whose own code is ~38 kB. So
it is an `await import()` fired from `requestIdleCallback` after mount, which
puts it in its own chunk: measured on 2026-08-23, `/` went from 139 kB to 141 kB
First Load JS. If that ever jumps by ~60 kB, something has pulled the SDK into
the static graph and this is no longer true. The gap that opens up — a second or
two on a slow phone where the page is live and the SDK is not — is covered by a
queue in `lib/analytics.ts`, because the click most likely to land in that gap
is the play button.

### Checking it locally

```bash
npm run dev
```

Then open the page with `?ph=debug`. Every event prints to the console **with
its properties expanded** — PostHog's own debug mode collapses them, and the
properties are the part worth checking: a milestone off by one, a percent that
is NaN, a track number that is 0.
