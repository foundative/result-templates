import { admin } from "@/lib/admin";
import { isOwner, resolveCaller } from "@/lib/caller";
import { safeUrl } from "@/lib/listings";

// Every write to the directory.
//
// `listings` has exactly one policy, and it only lets anyone READ approved
// rows. Submitting, approving and featuring all happen here, which is what
// makes moderation real: if a submitter could update their own row from the
// browser, they could set `published` on it and approve themselves.

const MAX_TITLE = 120;
const MAX_SUMMARY = 600;

export async function POST(request: Request) {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json(
      { error: "Sign in before submitting." },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const intent = typeof body?.intent === "string" ? body.intent : "submit";
  const db = admin().database;

  if (intent === "submit") {
    const title = text(body?.title, MAX_TITLE);
    const url = safeUrl(typeof body?.url === "string" ? body.url : "");
    if (!title) return bad("Give it a name.");
    if (!url) return bad("That address will not open.");

    const { error } = await db.from("listings").insert({
      title,
      url,
      summary: text(body?.summary, MAX_SUMMARY),
      category: text(body?.category, 60),
      contact_email: text(body?.contactEmail, 254),
      submitter_id: caller.id,
      // Never taken from the request. A submission arrives unapproved, full
      // stop, and the only way it changes is the branch below.
      published: false,
    });
    return error ? failed() : Response.json({ ok: true });
  }

  // Everything past here is the owner's.
  if (!(await isOwner(caller.id))) {
    return Response.json({ error: "Owners only." }, { status: 403 });
  }

  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return bad("Which listing?");

  if (intent === "publish" || intent === "feature") {
    const column = intent === "publish" ? "published" : "featured";
    const { error } = await db
      .from("listings")
      .update({ [column]: Boolean(body?.value) })
      .eq("id", id);
    return error ? failed() : Response.json({ ok: true });
  }

  if (intent === "delete") {
    const { error } = await db.from("listings").delete().eq("id", id);
    return error ? failed() : Response.json({ ok: true });
  }

  return bad("Unknown request.");
}

/** The owner's queue, including everything not yet approved. */
export async function GET(request: Request) {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!(await isOwner(caller.id))) {
    return Response.json({ error: "Owners only." }, { status: 403 });
  }
  const { data } = await admin()
    .database.from("listings")
    .select(
      "id,title,summary,url,category,contact_email,published,featured,created_at",
    )
    // Pending first: the queue is the reason to open this page.
    .order("published", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);
  return Response.json({ listings: data ?? [] });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function bad(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

function failed() {
  return Response.json(
    { error: "Could not save that. Try again in a moment." },
    { status: 502 },
  );
}
