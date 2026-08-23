/**
 * Where the drift lives.
 *
 * This is the first thing on qi.land that keeps data of its own. The mailing
 * list deliberately does not — /api/subscribe forwards to MailerLite and we
 * hold no address table — but a wall of messages that other visitors can read
 * has nowhere to forward to. So: one store, and the smallest one that can hold
 * a wall.
 *
 * Upstash Redis over its REST API, which is the whole reason for this file's
 * shape. Upstash speaks HTTP, so this adds **no npm dependency** — no client,
 * no connection pool, no cold-start handshake, nothing in the browser bundle.
 * A serverless function that has to open a TCP connection to Postgres before it
 * can answer a 4-second poll is the wrong machine for this job; a `fetch` is
 * exactly the right one.
 *
 * With the env vars unset the store falls back to memory. That is NOT a
 * production mode — a serverless deployment has many processes and each one
 * would keep its own wall — it is so the third screen is fully playable on a
 * laptop with no account anywhere. `isPersistent()` says which world we are in
 * and the API route tells the client, so the UI can be honest about it.
 *
 * last updated 2026-08-23
 */

export type Message = {
  /** Time-ordered, unique, and safe to show: `<ms>-<6 random chars>`. */
  id: string;
  /** Optional. Empty means the message is signed "anonymous" by the UI, not here. */
  name: string;
  text: string;
  /** ms since epoch. Doubles as the polling cursor — see the API route. */
  at: number;
};

/** The wall's length. Beyond this the oldest fall off; a guestbook is not an archive. */
const WALL = 200;

const LIST_KEY = 'gb:msgs';

const URL_ = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isPersistent(): boolean {
  return Boolean(URL_ && TOKEN);
}

/**
 * One round trip, however many commands. Upstash's /pipeline takes an array of
 * command arrays and answers an array of `{result}` — same order.
 *
 * Errors are thrown, not swallowed: the route above turns them into a 502. A
 * guestbook that silently drops a message someone typed is worse than one that
 * says it is broken.
 */
async function pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
  const res = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`upstash ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  const out = (await res.json()) as ({ result?: unknown; error?: string } | unknown)[];
  return out.map((r) => {
    if (r && typeof r === 'object' && 'error' in r && (r as { error?: string }).error) {
      throw new Error(String((r as { error: string }).error));
    }
    return r && typeof r === 'object' && 'result' in r ? (r as { result: unknown }).result : r;
  });
}

/* ---- the memory fallback ------------------------------------------------ */

/**
 * Module scope, so it survives between requests in one `next dev` process and
 * nowhere else. Seeded, because an empty sea is a broken-looking screen and the
 * first thing to check when building this is how the wall moves when it is full.
 */
const mem: Message[] = [];

/* ---- the store ---------------------------------------------------------- */

export function newId(now: number): string {
  // Math.random is fine here: this is a DOM key and a delete handle, not a
  // capability. Nothing is authorised by knowing an id.
  return `${now}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Newest first. `since` (ms) returns only what arrived after — the poll path.
 *
 * **One command.** This runs on every poll from every visitor on screen three,
 * so it is the only thing in this file whose command count matters: it is
 * essentially the entire monthly usage of the free tier. An earlier version
 * also read a set of hidden ids here, which doubled the bill of the hot path to
 * serve a case that fires when Qi deletes a line of spam. Hiding now edits the
 * list itself (see hide), and reading is a single LRANGE.
 */
export async function read(since = 0, limit = WALL): Promise<Message[]> {
  const n = Math.min(limit, WALL);
  let all: Message[];

  if (isPersistent()) {
    const [raw] = (await pipeline([['LRANGE', LIST_KEY, 0, WALL - 1]])) as [string[]];
    all = raw
      .map((s) => {
        try {
          return JSON.parse(s) as Message;
        } catch {
          return null; // A row we cannot parse is a row that no longer exists.
        }
      })
      .filter((m): m is Message => Boolean(m && m.id && typeof m.text === 'string'));
  } else {
    all = mem;
  }

  return all
    .filter((m) => m.at > since)
    .sort((a, b) => b.at - a.at)
    .slice(0, n);
}

export async function write(m: Message): Promise<void> {
  if (!isPersistent()) {
    mem.unshift(m);
    mem.length = Math.min(mem.length, WALL);
    return;
  }
  await pipeline([
    ['LPUSH', LIST_KEY, JSON.stringify(m)],
    ['LTRIM', LIST_KEY, 0, WALL - 1],
  ]);
}

/**
 * The undo.
 *
 * Nothing here is reviewed before it appears — that is the decision, and it is
 * the right one for a wall that is supposed to feel live. But "no moderation
 * queue" and "no way to take something down" are different promises, and only
 * the first one was made.
 *
 * A read plus an LREM, because LREM matches on the exact stored string and the
 * caller only has an id. That is the right way round: this runs when Qi deletes
 * something, which is rare, and paying two commands here is what buys the poll
 * — which runs constantly — its single-command read.
 */
export async function hide(id: string): Promise<void> {
  if (!isPersistent()) {
    const i = mem.findIndex((m) => m.id === id);
    if (i >= 0) mem.splice(i, 1);
    return;
  }
  const [raw] = (await pipeline([['LRANGE', LIST_KEY, 0, WALL - 1]])) as [string[]];
  const row = raw.find((r) => {
    try {
      return (JSON.parse(r) as Message).id === id;
    } catch {
      return false;
    }
  });
  if (!row) return; // Already gone, or never there. Deleting twice is not an error.
  await pipeline([['LREM', LIST_KEY, 1, row]]);
}

/**
 * Fixed-window counter. `INCR` then `EXPIRE` on first hit — two commands, one
 * round trip, and the window resets rather than sliding. A sliding window would
 * be more correct and needs a sorted set per visitor; for "one person cannot
 * paste forty lines in a row" the difference does not exist.
 *
 * Returns true when the caller is over the limit.
 */
export async function overLimit(key: string, max: number, windowSecs: number): Promise<boolean> {
  if (!isPersistent()) return false; // Local dev should never fight the rate limiter.
  const [count] = (await pipeline([
    ['INCR', key],
    ['EXPIRE', key, windowSecs, 'NX'],
  ])) as [number];
  return count > max;
}
