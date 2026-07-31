import { type Subscription, createClient, subscriptionGrantsAccess } from "@resultdev/sdk";
import { admin } from "@/lib/admin";

// Who is asking, and are they allowed in. Server side only.
//
// The paywall is HERE, not in the page. A component that hides the feed is a
// component anyone can open devtools and un-hide, and a database policy cannot
// express "has an active subscription" until payments have been set up, which
// happens after this project was created. So the feed is served by a route
// handler, and that route asks these two questions first.
//
// The caller proves who they are with their own access token. It is never a
// user id sent in the body: that would let anyone read anyone's feed by typing
// a different one.

export type Caller = { id: string; email: string | null };

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/** The caller's own bearer token, for asking the SDK questions as them. */
export function bearerToken(request: Request): string | null {
  return bearer(request);
}

/** A client acting AS the caller, so row-level security applies to them. */
export function asCaller(token: string) {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_BACKEND_URL!,
    accessToken: token,
  });
}

export async function resolveCaller(request: Request): Promise<Caller | null> {
  const token = bearer(request);
  if (!token) return null;
  try {
    const { data } = await asCaller(token).auth.getCurrentUser();
    const user = data.user;
    return user ? { id: user.id, email: user.email ?? null } : null;
  } catch {
    return null;
  }
}

/** True when this caller holds the one `site` row. */
export async function isOwner(callerId: string): Promise<boolean> {
  const { data } = await admin()
    .database.from("site")
    .select("user_id")
    .limit(1);
  return (data as { user_id: string | null }[] | null)?.[0]?.user_id === callerId;
}

/**
 * Whether this caller may read member-only content.
 *
 * The owner always may. They did not buy their own community, and locking them
 * out of it would be absurd.
 *
 * Everyone else needs a live subscription. `subscription()` reads
 * `billing_subscriptions` as the caller, which row-level security already
 * scopes to their own row, and `subscriptionGrantsAccess` is the same rule the
 * SDK applies in the browser: a failed renewal in recovery still counts, and a
 * cancellation scheduled for next month does not take effect today.
 */
export async function canRead(
  request: Request,
  caller: Caller,
): Promise<boolean> {
  if (await isOwner(caller.id)) return true;
  const token = bearer(request);
  if (!token) return false;
  try {
    const { data } = await asCaller(token).payments.subscription();
    return subscriptionGrantsAccess(data as Subscription | null);
  } catch {
    // No payments set up yet means no subscriptions exist, so nobody is a
    // member. The owner is already through, above.
    return false;
  }
}
