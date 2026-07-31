import { asCaller, bearerToken } from "@/lib/caller";

// Who owns what.
//
// This is the whole reason a store can exist on this platform. Every completed
// payment lands in `billing_purchases` in this app's own database, written by
// the platform's webhook receiver when the payment event actually arrives.
//
// The rule that everything else follows from: NEVER grant a download because
// somebody reached the thank-you page. A buyer can close the tab before the
// payment finishes, and a thank-you URL is a URL anyone can type.
//
// The entitlement question is asked through the SDK rather than by querying the
// table here, and that is deliberate. `hasPurchased` knows all three parts of
// the rule: the payment completed, it is not a subscription renewal, and it has
// not been refunded or charged back. An earlier version of this file
// re-implemented the first two and forgot the third, so a refunded buyer kept
// their download. One rule, in one place, and that place is the SDK.

export type Purchase = {
  transactionId: string;
  plan: string | null;
  status: string;
  amount: string | null;
  currencyCode: string | null;
  billedAt: string | null;
};

/**
 * Everything this person has paid for and still owns.
 *
 * Read AS the caller, so their own row-level security decides what comes back
 * rather than the admin key. Renewals are filtered out: a library is what
 * someone bought, not a list of receipts.
 */
export async function purchasesFor(request: Request): Promise<Purchase[]> {
  const token = bearerToken(request);
  if (!token) return [];
  try {
    const { data } = await asCaller(token).payments.purchases();
    return (data ?? [])
      .filter((purchase) => !purchase.revoked && !purchase.subscriptionId)
      .map((purchase) => ({
        transactionId: purchase.transactionId,
        plan: purchase.plan,
        status: purchase.status,
        amount: purchase.amount,
        currencyCode: purchase.currencyCode,
        billedAt: purchase.billedAt,
      }));
  } catch {
    // Payments not set up yet means nothing has been bought, which is the same
    // answer as an empty library.
    return [];
  }
}

/** Whether this person may download the file behind `plan`. */
export async function hasBought(
  request: Request,
  plan: string,
): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  try {
    const { data } = await asCaller(token).payments.hasPurchased(plan);
    return data === true;
  } catch {
    return false;
  }
}
