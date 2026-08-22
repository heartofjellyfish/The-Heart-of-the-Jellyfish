// /api/subscribe — the mailing list behind "Follow thy heart ;)".
//   POST { email, source? } → MailerLite. MailerLite owns the list, the unsubscribe
//   flow, the compliance footer, and the eventual 12/20 broadcast; we deliberately
//   keep no address table of our own and send nothing ourselves.
//
// Ported from hush.gallery, which runs this same route against its OWN MailerLite
// account. The two accounts are separate on purpose: MailerLite prices and
// suppresses per ACCOUNT, so sharing one would mean qi.land's subscribers eat into
// the gallery's free contact quota, and a single unsubscribe would silence both
// sites at once. Same code, different key — that is the whole isolation mechanism.
//
// The key never reaches the browser: the form posts here, and only this server-side
// route holds MAILERLITE_API_KEY. With the key unset the route 503s rather than
// failing open, and the form says so instead of lying to the visitor.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Good enough email shape check — not RFC-complete, just catches the obvious.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 254;
const MAX_SOURCE = 120;

const MAILERLITE_ENDPOINT = 'https://connect.mailerlite.com/api/subscribers';

export async function POST(req: Request) {
  const key = process.env.MAILERLITE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'writes disabled (no MAILERLITE_API_KEY)' }, { status: 503 });
  }

  let b: { email?: unknown; source?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  const source =
    typeof b.source === 'string' && b.source.trim() ? b.source.trim().slice(0, MAX_SOURCE) : 'qi.land';

  // Optional: create a Group in the MailerLite dashboard and put its ID in
  // MAILERLITE_GROUP_ID. Worth doing even while this account has one site — a list
  // that was tagged from day one can be split later by exporting per group, whereas
  // an untagged pile can only be sorted by guessing where each address came from.
  const groupId = process.env.MAILERLITE_GROUP_ID?.trim();
  const payload: Record<string, unknown> = { email };
  if (groupId) payload.groups = [groupId];
  // Which page the signup came from. MailerLite has no built-in `source` field, so
  // this rides in fields.source — if the field isn't defined in the dashboard it is
  // silently ignored, which is fine; the subscribe still succeeds.
  payload.fields = { source };

  try {
    const res = await fetch(MAILERLITE_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });
    // MailerLite answers 200 (already existed → updated) or 201 (created). Both are
    // a success for us: re-subscribing the same address must not look like an error.
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('mailerlite subscribe failed:', res.status, detail.slice(0, 300));
      // 422 = MailerLite itself judged the address invalid → hand it back as a client
      // error so the form can ask for a different one.
      if (res.status === 422) return NextResponse.json({ error: 'invalid email' }, { status: 400 });
      return NextResponse.json({ error: 'subscribe failed' }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('subscribe POST failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'subscribe failed' }, { status: 502 });
  }
}
