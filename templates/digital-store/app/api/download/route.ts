import { admin } from "@/lib/admin";
import { resolveCaller } from "@/lib/caller";
import { hasBought, purchasesFor } from "@/lib/purchases";

// Handing over a file somebody paid for.
//
// The order of the three checks below is the whole security model, and it only
// works in this order:
//
//   1. Who is asking, from their own access token.
//   2. Did THEY pay for THIS product, from billing_purchases.
//   3. Only then, what is the file, and a link to it that expires.
//
// The storage path never leaves the server, and the bucket is private, so a
// leaked link stops working rather than becoming the product.

/** Long enough to start a download on a slow connection, short enough to share badly. */
const LINK_TTL_SECONDS = 300;

export async function GET(request: Request) {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const plan = new URL(request.url).searchParams.get("plan");
  if (!plan) {
    return Response.json({ error: "Which product?" }, { status: 400 });
  }

  if (!(await hasBought(request, plan))) {
    // Deliberately the same answer whether they never bought it or it does not
    // exist. There is nothing useful in telling someone which.
    return Response.json({ error: "You do not own this." }, { status: 403 });
  }

  const { data } = await admin()
    .database.from("product_files")
    .select("storage_path,label")
    .eq("plan_slug", plan)
    .limit(1);
  const file = (data as { storage_path: string; label: string | null }[] | null)?.[0];
  if (!file) {
    return Response.json(
      { error: "This product has no file attached yet. The seller has been told." },
      { status: 404 },
    );
  }

  const signed = await admin()
    .storage.from("downloads")
    .createSignedUrl(file.storage_path, LINK_TTL_SECONDS);
  if (signed.error || !signed.data) {
    return Response.json(
      { error: "Could not open that file. Try again in a moment." },
      { status: 502 },
    );
  }

  return Response.json({ url: signed.data.signedUrl, label: file.label });
}

/** What this person owns, for the library page. */
export async function POST(request: Request) {
  const caller = await resolveCaller(request);
  if (!caller) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }
  return Response.json({ purchases: await purchasesFor(request) });
}
