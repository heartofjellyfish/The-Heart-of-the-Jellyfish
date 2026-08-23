// /api/guestbook — the drift on screen three.
//
//   GET  ?since=<ms>  → { messages, persistent }   newest first; `since` is a poll cursor
//   POST { name?, text, hp?, dwell? } → { message }
//   DELETE ?id=<id>   → { ok }                     needs GUESTBOOK_ADMIN_TOKEN
//
// Nothing is reviewed before it appears. That is Qi's call and it is what makes
// the screen feel like a room rather than a suggestion box — but "unmoderated"
// is a decision about *review*, not about *defence*, and the two get confused
// constantly. Everything below is defence: it decides whether a request is a
// person, never whether a message is good.
//
//   honeypot + dwell   the two cheapest bot filters there are, and between them
//                      they stop the entire commodity form-spam industry
//   rate limit         5/min and 40/hour per IP, so one person cannot own the wall
//   length caps        140 chars — this is a passing line of light, not a post
//   sanitising         control characters out, runs of whitespace collapsed
//   hide, not delete   the undo Qi keeps, since there is no queue to catch it first
//
// What is deliberately NOT here: a CAPTCHA. It taxes every honest visitor to
// stop an attack nobody has made yet. If the wall ever does get hit, the answer
// is Cloudflare Turnstile in front of the POST — one env var and ~10 lines —
// and it should be added then, not now.
//
// The GET is a poll, not a socket. See the client hook for why 4 seconds is
// indistinguishable from realtime here and costs a fraction of what holding a
// connection open on a serverless function does.
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { hide, isPersistent, newId, overLimit, read, write, type Message } from '@/lib/guestbook-store';

export const dynamic = 'force-dynamic';

const MAX_TEXT = 140;
const MAX_NAME = 24;
/** How long a human takes to read the field and type into it. Bots post instantly. */
const MIN_DWELL_MS = 1200;

/**
 * The visitor, as a rate-limit key and nothing else.
 *
 * Hashed because the raw address is never needed: the only question ever asked
 * of it is "same as the last one?", and a hash answers that. It also means the
 * one piece of personal data this feature touches is not sitting in a Redis key
 * anyone with the dashboard can read — which is the same instinct as the
 * mailing list keeping no address table of its own.
 */
function visitorKey(req: Request, bucket: string): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const h = createHash('sha256').update(ip).update(process.env.GUESTBOOK_SALT ?? 'qi.land').digest('hex');
  return `gb:rl:${bucket}:${h.slice(0, 16)}`;
}

/**
 * Everything that can arrive as text goes through here.
 *
 * Not escaping — React escapes on render, and doing it twice is how you end up
 * with &amp;amp; on a wall of people's words. This strips what should never
 * have been in a one-line message in the first place: C0/C1 controls (including
 * the newlines that would break the drift lane), zero-width and bidi-override
 * characters (the ones used to make text render as something other than what is
 * stored), and runs of space.
 */
function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function GET(req: Request) {
  const since = Number(new URL(req.url).searchParams.get('since') ?? 0);
  try {
    const messages = await read(Number.isFinite(since) && since > 0 ? since : 0);
    return NextResponse.json(
      { messages, persistent: isPersistent() },
      // The poll must never be served from a CDN copy — the whole point of
      // asking again is to get something newer than last time.
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (e) {
    console.error('guestbook GET failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'read failed' }, { status: 502 });
  }
}

export async function POST(req: Request) {
  let b: { name?: unknown; text?: unknown; hp?: unknown; dwell?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  // The honeypot and the stopwatch. Both answer 200 with a plausible-looking
  // message rather than an error: a bot that is told it failed learns how to
  // pass, and a bot that thinks it succeeded goes away. Nothing is written.
  const now = Date.now();
  const dwell = typeof b.dwell === 'number' ? b.dwell : 0;
  if (clean(b.hp, 40) || dwell < MIN_DWELL_MS) {
    return NextResponse.json({ message: { id: newId(now), name: '', text: '', at: now } });
  }

  const text = clean(b.text, MAX_TEXT);
  const name = clean(b.name, MAX_NAME);
  if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 });

  try {
    // Per minute first: it is the one that actually fires, so the hourly
    // counter is not incremented by a burst the minute limit already refused.
    if (await overLimit(visitorKey(req, 'm'), 5, 60)) {
      return NextResponse.json({ error: 'too fast' }, { status: 429 });
    }
    if (await overLimit(visitorKey(req, 'h'), 40, 3600)) {
      return NextResponse.json({ error: 'too many' }, { status: 429 });
    }

    const message: Message = { id: newId(now), name, text, at: now };
    await write(message);
    return NextResponse.json({ message });
  } catch (e) {
    console.error('guestbook POST failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'write failed' }, { status: 502 });
  }
}

/**
 * Take one message off the wall.
 *
 * A shared secret in a header, not a login: there is one person who will ever
 * call this, and standing up an auth system so that person can delete a line of
 * spam from their phone is the wrong trade. With the token unset the route
 * 404s — an unconfigured admin door should not announce that it is a door.
 */
export async function DELETE(req: Request) {
  const token = process.env.GUESTBOOK_ADMIN_TOKEN;
  if (!token) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (req.headers.get('x-guestbook-token') !== token) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 });
  try {
    await hide(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('guestbook DELETE failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'hide failed' }, { status: 502 });
  }
}
