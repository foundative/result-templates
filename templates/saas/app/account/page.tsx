"use client";

// Billing, from the customer's side. Every button here is one SDK call: the
// portal, the plan change and the cancellation are all handled by the platform,
// so there is no payment plumbing in this app at all.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

type Subscription = {
  status: string;
  plan: string | null;
  currentPeriodEndsAt: string | null;
  scheduledChangeAction: string | null;
  scheduledChangeAt: string | null;
};

export default function Account() {
  const [email, setEmail] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function load() {
    const { data: user } = await backend.auth.getCurrentUser();
    setEmail(user.user?.email ?? null);
    if (user.user) {
      const { data } = await backend.payments.subscription();
      setSubscription((data as Subscription | null) ?? null);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function openPortal() {
    setBusy(true);
    setProblem(null);
    const { data, error } = await backend.payments.portalUrl();
    setBusy(false);
    if (error || !data) {
      setProblem(error?.message ?? "Could not open the billing portal.");
      return;
    }
    // Short-lived and single use, so it is opened immediately and never cached.
    window.open(data, "_blank", "noopener");
  }

  async function cancel() {
    setBusy(true);
    setProblem(null);
    // Ends at the close of the period they already paid for, not today.
    const { error } = await backend.payments.cancel();
    setBusy(false);
    if (error) setProblem(error.message);
    else await load();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-sm font-medium">Account</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          Home
        </Link>
      </header>

      {loading ? (
        <p className="py-20 text-center text-sm text-muted">Loading</p>
      ) : !email ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-base">Sign in to see your billing.</p>
          <button
            className="h-11 rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink"
            onClick={() =>
              void backend.auth.signInWithOAuth("google", {
                redirectTo: `${window.location.origin}/account`,
              })
            }
            type="button"
          >
            Sign in with Google
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-16">
          <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-5">
            <Row label="Signed in as" value={email} />
            <Row
              label="Plan"
              value={subscription?.plan ?? "No subscription"}
            />
            <Row
              label="Status"
              value={subscription ? statusLabel(subscription) : "Not subscribed"}
            />
          </div>

          {subscription ? (
            <div className="flex flex-wrap gap-2">
              <button
                className="h-11 rounded-lg border border-line bg-card px-5 text-sm transition-colors hover:bg-background disabled:opacity-50"
                disabled={busy}
                onClick={() => void openPortal()}
                type="button"
              >
                Payment method and invoices
              </button>
              {subscription.scheduledChangeAction === "cancel" ? null : (
                <button
                  className="h-11 rounded-lg border border-line bg-card px-5 text-sm text-red-700 transition-colors hover:bg-background disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void cancel()}
                  type="button"
                >
                  Cancel subscription
                </button>
              )}
            </div>
          ) : (
            <Link
              className="flex h-11 items-center justify-center rounded-lg bg-accent text-sm font-medium text-accent-ink"
              href="/#pricing"
            >
              See pricing
            </Link>
          )}

          {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        </div>
      )}
    </main>
  );
}

function statusLabel(subscription: Subscription): string {
  if (subscription.scheduledChangeAction === "cancel") {
    const at = subscription.scheduledChangeAt;
    // A scheduled cancellation is not a cancellation: they keep what they paid
    // for until it takes effect, and saying "cancelled" here would be a lie.
    return at
      ? `Active until ${new Date(at).toLocaleDateString()}`
      : "Ending at the end of the period";
  }
  if (subscription.status === "past_due") {
    return "Payment failed, retrying";
  }
  return subscription.status;
}

function Row({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="truncate text-sm">{value}</span>
    </div>
  );
}
