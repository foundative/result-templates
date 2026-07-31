import { admin } from "@/lib/admin";

// Submitting a score.
//
// Be honest about what this can and cannot do. The game runs on the player's
// machine, so a determined person can always send a number they did not earn.
// Nothing short of running the simulation on the server changes that, and for a
// marketing toy that is not worth building.
//
// What this DOES stop is the cheap version: a one-line fetch that writes
// 999999999 and ruins the leaderboard for everyone. The score is clamped to
// something a human could plausibly reach and the endpoint is rate limited.

const MAX_SCORE = 999;
const MAX_NAME = 24;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
/** Above this, the oldest addresses are dropped. Keeps the map from being its own leak. */
const RATE_MAX_KEYS = 5000;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((at) => now - at < RATE_WINDOW_MS);
  hits.push(now);
  // Delete before set so the key moves to the end: Map iterates in insertion
  // order, which makes the eviction below drop the least recently seen.
  recent.delete(ip);
  recent.set(ip, hits);
  if (recent.size > RATE_MAX_KEYS) {
    for (const key of recent.keys()) {
      recent.delete(key);
      if (recent.size <= RATE_MAX_KEYS) break;
    }
  }
  return hits.length > RATE_LIMIT;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return Response.json(
      { error: "Slow down a moment." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    score?: unknown;
  } | null;

  const raw = typeof body?.name === "string" ? body.name.trim() : "";
  const name = (raw || "Anonymous").slice(0, MAX_NAME);
  const score = Number(body?.score);
  if (!Number.isInteger(score) || score < 0) {
    return Response.json({ error: "That is not a score." }, { status: 400 });
  }

  const { error } = await admin()
    .database.from("scores")
    .insert({ name, score: Math.min(score, MAX_SCORE) });

  if (error) {
    return Response.json(
      { error: "Could not save that. Try again." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
