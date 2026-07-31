import { admin } from "@/lib/admin";
import { type Caller, canRead, resolveCaller } from "@/lib/caller";

// The paywalled part of the product.
//
// `entries` has no row-level policies at all, which denies everything, and this
// route is the only door. Every call proves two things before it touches data:
// who is asking (their own access token, never an id from the body) and whether
// they are paying (`canRead`).
//
// The obvious shortcut is to give `entries` a `user_id` column, let the CLI
// generate its owner policy, and query it straight from the browser. Do not:
// that policy says "your own rows", not "your own rows AND you are paying", so
// anyone who signs up gets the product for free.

type Entry = {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["open", "doing", "done"];
const MAX_TITLE = 200;
const MAX_NOTES = 2000;

async function gate(request: Request): Promise<{ caller: Caller } | Response> {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!(await canRead(request, caller))) {
    return Response.json(
      { error: "Your plan does not include this.", needsMembership: true },
      { status: 403 },
    );
  }
  return { caller };
}

export async function GET(request: Request) {
  const gated = await gate(request);
  if (gated instanceof Response) return gated;

  const { data } = await admin()
    .database.from("entries")
    .select("id,title,status,notes,created_at")
    // Scoped by hand, because there is no policy doing it. Leaving this filter
    // off would show every customer everyone else's data.
    .eq("owner_id", gated.caller.id)
    .order("created_at", { ascending: false })
    .limit(200);

  return Response.json({ entries: (data as Entry[] | null) ?? [] });
}

export async function POST(request: Request) {
  const gated = await gate(request);
  if (gated instanceof Response) return gated;
  const { caller } = gated;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const intent = typeof body?.intent === "string" ? body.intent : "create";
  const db = admin().database;

  if (intent === "create") {
    const title = text(body?.title, MAX_TITLE);
    if (!title) {
      return Response.json({ error: "Give it a name." }, { status: 400 });
    }
    const { error } = await db.from("entries").insert({
      title,
      notes: text(body?.notes, MAX_NOTES),
      status: "open",
      owner_id: caller.id,
    });
    return error ? failed() : Response.json({ ok: true });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return Response.json({ error: "Which one?" }, { status: 400 });

  if (intent === "status") {
    const status = typeof body?.status === "string" ? body.status : "";
    if (!STATUSES.includes(status)) {
      return Response.json({ error: "Unknown status." }, { status: 400 });
    }
    // The owner_id filter is the authorization. Without it, a customer could
    // move somebody else's row by guessing its id.
    const { error } = await db
      .from("entries")
      .update({ status })
      .eq("id", id)
      .eq("owner_id", caller.id);
    return error ? failed() : Response.json({ ok: true });
  }

  if (intent === "delete") {
    const { error } = await db
      .from("entries")
      .delete()
      .eq("id", id)
      .eq("owner_id", caller.id);
    return error ? failed() : Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown request." }, { status: 400 });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function failed() {
  return Response.json(
    { error: "Could not save that. Try again in a moment." },
    { status: 502 },
  );
}
