"use client";

// One product, and the button that sells it.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import type { Plan } from "@/components/storefront";

export function Product({ slug }: { readonly slug: string }) {
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [owned, setOwned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Declared before the effect that calls it. Function declarations hoist, so
  // this ordering is only for the linter, which reads a later declaration as a
  // value that could change under the effect.
  const checkOwned = useCallback(async () => {
    const token = await backend
      .getHttpClient()
      .getValidAccessToken()
      .catch(() => null);
    if (!token) return;
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return;
    const body = (await response.json()) as {
      purchases: { plan: string | null }[];
    };
    setOwned(body.purchases.some((purchase) => purchase.plan === slug));
  }, [slug]);

  useEffect(() => {
    backend.payments
      .plan(slug)
      .then(({ data }) => setPlan((data as Plan | null) ?? null));
    backend.auth.getCurrentUser().then(({ data }) => {
      setViewerId(data.user?.id ?? null);
      if (data.user) void checkOwned();
    });
  }, [slug, checkOwned]);

  async function buy() {
    setProblem(null);
    setBusy(true);
    // A payment has to be attached to an account or it can never be matched
    // back to the buyer, so checkout refuses an anonymous caller. Sign-in is its
    // own visible step: on a normal tab it navigates away, and anything queued
    // behind it would never run.
    if (!viewerId) {
      const { error } = await backend.auth.signInWithOAuth("google", {
        redirectTo: window.location.href,
      });
      setBusy(false);
      if (error) setProblem(error.nextActions ?? error.message);
      return;
    }
    backend.analytics.track("checkout_opened", { plan: slug });
    const { error } = await backend.payments.checkout({
      plan: slug,
      // Where they LAND, not where access comes from. The download is granted
      // by the payment event the platform receives, so closing this tab early
      // loses nothing.
      successUrl: `${window.location.origin}/library`,
    });
    setBusy(false);
    if (error) setProblem(error.message);
  }

  if (plan === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-muted">
        Loading
      </main>
    );
  }

  if (!plan) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-xl font-medium">This product is not on sale</h1>
        <Link className="text-sm underline underline-offset-4" href="/">
          Back to the shop
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-6 py-12">
      <Link className="text-sm text-muted hover:text-foreground" href="/">
        Back to the shop
      </Link>

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{plan.name}</h1>
        <p className="text-2xl">
          {plan.formattedTotal ?? ""}
          {plan.interval ? (
            <span className="text-base text-muted"> per {plan.interval}</span>
          ) : null}
        </p>
      </header>

      {plan.description ? (
        <p className="text-base leading-7 whitespace-pre-line">
          {plan.description}
        </p>
      ) : null}

      {owned ? (
        <Link
          className="flex h-12 w-fit items-center rounded-xl bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/library"
        >
          You own this. Download it
        </Link>
      ) : (
        <button
          className="h-12 w-fit rounded-xl bg-accent px-6 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={busy}
          onClick={() => void buy()}
          type="button"
        >
          {viewerId ? "Buy it" : "Sign in to buy"}
        </button>
      )}

      <p className="text-sm leading-6 text-muted">
        Tax is worked out and included for wherever you are. You get the file the
        moment the payment goes through, and it stays in your library.
      </p>

      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
    </main>
  );
}
