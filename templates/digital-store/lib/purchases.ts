import { admin } from "@/lib/admin";

// Who owns what.
//
// This is the whole reason a store can exist on this platform. Every completed
// payment lands in `billing_purchases` in this app's own database, written by
// the platform's webhook receiver, and this file is how the store reads it.
//
// The rule that everything else follows from: NEVER grant a download because
// somebody reached the thank-you page. A buyer can close the tab before the
// payment finishes, and a thank-you URL is a URL anyone can type. Access comes
// from the row the payment event wrote, and nothing else.

export type Purchase = {
  transaction_id: string;
  plan: string | null;
  status: string;
  subscription_id: string | null;
  amount: string | null;
  currency_code: string | null;
  billed_at: string | null;
};

/**
 * Both statuses mean the money arrived.
 *
 * One sale emits `transaction.paid` and `transaction.completed` and the order
 * they land in is not guaranteed, so waiting for `completed` alone would hold a
 * download back for the gap between them.
 */
const PAID = new Set(["completed", "paid"]);

/**
 * Everything this person has paid for.
 *
 * Renewals of a subscription land here too, with `subscription_id` set, so they
 * are filtered out: a library is what someone bought, not a list of receipts.
 */
export async function purchasesFor(userId: string): Promise<Purchase[]> {
  try {
    const { data } = await admin()
      .database.from("billing_purchases")
      .select(
        "transaction_id,plan,status,subscription_id,amount,currency_code,billed_at",
      )
      .eq("user_id", userId)
      .order("billed_at", { ascending: false })
      .limit(200);
    return ((data as Purchase[] | null) ?? []).filter(
      (purchase) => PAID.has(purchase.status) && !purchase.subscription_id,
    );
  } catch {
    // The table only exists once payments have been set up. Before that nobody
    // has bought anything, which is the same answer.
    return [];
  }
}

/** Whether this person may download the file behind `plan`. */
export async function hasBought(
  userId: string,
  plan: string,
): Promise<boolean> {
  const purchases = await purchasesFor(userId);
  return purchases.some((purchase) => purchase.plan === plan);
}
