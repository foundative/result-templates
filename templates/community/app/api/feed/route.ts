import { admin } from "@/lib/admin";
import { type Caller, canRead, isOwner, resolveCaller } from "@/lib/caller";

// The members-only feed.
//
// Every read and write goes through here because the answer to "may you see
// this" is "do you have a live subscription", and that is not a question a
// row-level policy can answer: `billing_subscriptions` does not exist until
// payments are set up, which happens long after this project was created.
//
// So `posts` and `comments` have no policies at all, which denies everything,
// and this route is the only door. See lib/caller.ts.

type Post = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_id: string;
  author_name: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  post_id: string;
  body: string;
  author_id: string;
  author_name: string | null;
  created_at: string;
};

const MAX_TITLE = 140;
const MAX_BODY = 5000;

async function gate(
  request: Request,
): Promise<{ caller: Caller } | Response> {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!(await canRead(request, caller))) {
    return Response.json(
      { error: "This is for members.", needsMembership: true },
      { status: 403 },
    );
  }
  return { caller };
}

export async function GET(request: Request) {
  const gated = await gate(request);
  if (gated instanceof Response) return gated;

  const db = admin().database;
  // Pinned first, then newest, ordered IN THE QUERY. Sorting after the limit
  // would drop an old pinned post off the end before the sort ever saw it, so
  // pinning would stop working as soon as there were 100 newer posts.
  const { data: postRows } = await db
    .from("posts")
    .select("id,title,body,pinned,author_id,author_name,created_at")
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const found = (postRows as Post[] | null) ?? [];
  // Comments for THESE posts, newest first. A global ascending window returns
  // the oldest ones forever, so past the limit a new reply would never appear.
  const { data: commentRows } = found.length
    ? await db
        .from("comments")
        .select("id,post_id,body,author_id,author_name,created_at")
        .in(
          "post_id",
          found.map((post) => post.id),
        )
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [] };

  const comments = (commentRows as Comment[] | null) ?? [];
  const posts = found.map((post) => ({
    ...post,
    comments: comments
      .filter((comment) => comment.post_id === post.id)
      // Read order, restored after fetching newest-first.
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));

  return Response.json({
    posts,
    isOwner: await isOwner(gated.caller.id),
    you: gated.caller.id,
  });
}

export async function POST(request: Request) {
  const gated = await gate(request);
  if (gated instanceof Response) return gated;
  const { caller } = gated;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const intent = typeof body?.intent === "string" ? body.intent : "";
  const db = admin().database;

  if (intent === "post") {
    const title = text(body?.title, MAX_TITLE);
    const content = text(body?.body, MAX_BODY);
    if (!title) return bad("Give the post a title.");
    const { error } = await db.from("posts").insert({
      title,
      body: content ?? "",
      author_id: caller.id,
      author_name: displayName(body?.authorName, caller),
    });
    return error ? failed() : Response.json({ ok: true });
  }

  if (intent === "comment") {
    const postId = typeof body?.postId === "string" ? body.postId : "";
    const content = text(body?.body, MAX_BODY);
    if (!postId || !content) return bad("Write something first.");
    const { error } = await db.from("comments").insert({
      post_id: postId,
      body: content,
      author_id: caller.id,
      author_name: displayName(body?.authorName, caller),
    });
    return error ? failed() : Response.json({ ok: true });
  }

  // Moderation. A member being able to pin or delete would let anyone who paid
  // for a month rearrange somebody else's community, so this is owner only and
  // checked here rather than by hiding the button.
  if (intent === "pin" || intent === "delete") {
    if (!(await isOwner(caller.id))) {
      return Response.json({ error: "Owners only." }, { status: 403 });
    }
    const postId = typeof body?.postId === "string" ? body.postId : "";
    if (!postId) return bad("Which post?");
    if (intent === "delete") {
      await db.from("comments").delete().eq("post_id", postId);
      await db.from("posts").delete().eq("id", postId);
    } else {
      await db
        .from("posts")
        .update({ pinned: Boolean(body?.pinned) })
        .eq("id", postId);
    }
    return Response.json({ ok: true });
  }

  return bad("Unknown request.");
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * The name shown on a post.
 *
 * Taken from what the client sent so somebody can post as "Ada" rather than as
 * an email address, and capped. It is a label, never an identity: `author_id`
 * comes from the verified token and is what any check uses.
 */
function displayName(value: unknown, caller: Caller): string {
  const given = text(value, 60);
  return given ?? caller.email?.split("@")[0] ?? "Member";
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
