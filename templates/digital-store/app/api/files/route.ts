import { admin } from "@/lib/admin";
import { isOwner, resolveCaller } from "@/lib/caller";

// The owner's side of `product_files`.
//
// This route exists because `product_files` has NO row-level policies, which
// denies everything including the owner. That is deliberate: the storage path
// is the product, and a table a browser can read is a product a browser can
// take. So the admin page cannot query it directly, and every read and write of
// the mapping comes through here behind an owner check.

const MAX_PATH = 400;
const MAX_LABEL = 200;

async function requireOwner(request: Request): Promise<string | Response> {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  if (!(await isOwner(caller.id))) {
    return Response.json({ error: "Owners only." }, { status: 403 });
  }
  return caller.id;
}

/** Which file is attached to which product. Owner only. */
export async function GET(request: Request) {
  const gate = await requireOwner(request);
  if (gate instanceof Response) return gate;

  const { data } = await admin()
    .database.from("product_files")
    .select("id,plan_slug,storage_path,label");
  return Response.json({ files: data ?? [] });
}

/** Attach a file to a product, or replace the one already there. */
export async function POST(request: Request) {
  const gate = await requireOwner(request);
  if (gate instanceof Response) return gate;

  const body = (await request.json().catch(() => null)) as {
    planSlug?: unknown;
    storagePath?: unknown;
    label?: unknown;
  } | null;

  const planSlug = text(body?.planSlug, 200);
  const storagePath = text(body?.storagePath, MAX_PATH);
  if (!planSlug || !storagePath) {
    return Response.json(
      { error: "Which product, and which file?" },
      { status: 400 },
    );
  }
  const label = text(body?.label, MAX_LABEL);

  const db = admin().database;
  const { data: existing } = await db
    .from("product_files")
    .select("id")
    .eq("plan_slug", planSlug)
    .limit(1);
  const row = (existing as { id: string }[] | null)?.[0];

  // Replace rather than insert when the product already has a file, or the
  // unique constraint on plan_slug rejects it and the owner sees a failure for
  // doing exactly what the button says.
  const { error } = row
    ? await db
        .from("product_files")
        .update({ storage_path: storagePath, label })
        .eq("id", row.id)
    : await db
        .from("product_files")
        .insert({ plan_slug: planSlug, storage_path: storagePath, label });

  if (error) {
    return Response.json(
      { error: "Could not save that. Try again in a moment." },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}
