import { admin } from "@/lib/admin";

// The public write path for this app.
//
// The signups table has row-level security on and no policy for anonymous
// visitors, so nothing on the page can write to it directly. That is the point:
// an open insert policy is a form anyone can point a script at. Everything a
// visitor submits comes through here, gets checked, and is written with the
// admin client.

// Deliberately loose. Address validation is a swamp, and the only real test of
// an address is whether mail arrives at it. This rejects the shapes that are
// certainly wrong and lets the rest through.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

// A crude per-instance limiter. It resets on every cold start and is not shared
// between instances, so treat it as a speed bump rather than a defence. It is
// here because the alternative, no limit at all on a public endpoint, is worse.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > RATE_LIMIT;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

async function countSignups(): Promise<number> {
  const { count } = await admin()
    .database.from("signups")
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** How many people are on the list. Read by the form to show social proof. */
export async function GET() {
  try {
    return Response.json({ count: await countSignups() });
  } catch {
    // A number nobody can see is better than a page that fails to load.
    return Response.json({ count: 0 });
  }
}

export async function POST(request: Request) {
  if (rateLimited(clientIp(request))) {
    return Response.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    source?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body?.source === "string" ? body.source.slice(0, 80) : null;

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    return Response.json(
      { error: "That does not look like an email address." },
      { status: 400 },
    );
  }

  const { error } = await admin()
    .database.from("signups")
    .insert({ email, source });

  // 23505 is the unique violation on `email`. Someone signing up twice is not
  // an error worth showing them, and the second submit should feel identical to
  // the first.
  if (error && error.code !== "23505") {
    return Response.json(
      { error: "Could not save that. Try again in a moment." },
      { status: 502 },
    );
  }

  const alreadyOnList = Boolean(error);
  if (!alreadyOnList) await sendConfirmation(email);

  return Response.json({
    ok: true,
    alreadyOnList,
    count: await countSignups().catch(() => 0),
  });
}

/**
 * Best effort, deliberately.
 *
 * The signup is already saved by the time this runs. Failing the request
 * because a confirmation email bounced would tell someone they are not on a
 * list they are in fact on, and they would have no way to fix it.
 */
async function sendConfirmation(email: string): Promise<void> {
  try {
    await admin().emails.send({
      to: email,
      subject: "You are on the list",
      html: `
        <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#18181b">
          <p>Thanks for signing up. You are on the list.</p>
          <p>We will email you here the moment there is something to open.</p>
        </div>
      `,
    });
  } catch {
    // Nothing to do about it here, and nothing the visitor can act on.
  }
}
