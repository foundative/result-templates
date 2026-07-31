"use client";

// The public side: what this community is, what it costs, and the way in.
//
// The pricing comes from `payments.plans()`, so adding a plan in Finance
// changes this page with no code. If payments are not set up yet, the page says
// so to the owner and shows nothing to anyone else, rather than rendering a
// broken buy button.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

type Site = {
  user_id: string | null;
  name: string | null;
  tagline: string | null;
  promise: string | null;
};

type Plan = {
  slug: string;
  name: string;
  description: string | null;
  formattedTotal?: string;
  interval: string | null;
};

export function Join() {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("user_id,name,tagline,promise")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));

    backend.payments.plans().then(({ data }) => setPlans(data ?? []));

    backend.auth.getCurrentUser().then(({ data }) => {
      setViewerId(data.user?.id ?? null);
      if (data.user) {
        backend.payments.hasAccess().then(({ data: allowed }) => {
          setIsMember(Boolean(allowed));
        });
      }
    });
  }, []);

  async function signIn() {
    setProblem(null);
    // From a click handler, never an effect: when this app is framed the SDK
    // opens the provider in a popup, and a popup opened outside a user gesture
    // is blocked by the browser.
    const { error } = await backend.auth.signInWithOAuth("google", {
      redirectTo: window.location.origin,
    });
    if (error) setProblem(error.nextActions ?? error.message);
  }

  async function subscribe(slug: string) {
    setProblem(null);
    backend.analytics.track("membership_checkout", { plan: slug });
    const { error } = await backend.payments.checkout({
      plan: slug,
      // Access comes from the payment event the platform receives, never from
      // landing here, so this is only where the buyer ends up.
      successUrl: `${window.location.origin}/feed`,
    });
    if (error) setProblem(error.message);
  }

  if (site === undefined) {
    return (
      <Frame>
        <div className="h-8 w-56 animate-pulse rounded-full bg-surface" />
        <div className="h-4 w-72 animate-pulse rounded-full bg-surface" />
      </Frame>
    );
  }

  if (!site) {
    return (
      <Frame>
        <h1 className="text-xl font-medium">This community is not set up yet</h1>
        <p className="max-w-xs text-sm leading-6 text-muted">
          Open the admin side, claim it, and describe what members get.
        </p>
        <Link
          className="flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/admin"
        >
          Open the admin
        </Link>
      </Frame>
    );
  }

  const isOwner = Boolean(viewerId && viewerId === site.user_id);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-12 px-5 py-14 sm:py-20">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl leading-tight font-medium tracking-tight text-balance sm:text-4xl">
          {site.name?.trim() || "A community worth paying for"}
        </h1>
        {site.tagline ? (
          <p className="text-base leading-7 text-muted">{site.tagline}</p>
        ) : null}
      </header>

      {site.promise ? (
        <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-6">
          <h2 className="text-xs tracking-wide text-muted uppercase">
            What members get
          </h2>
          <p className="text-sm leading-7 whitespace-pre-line">{site.promise}</p>
        </section>
      ) : null}

      {isMember || isOwner ? (
        <Link
          className="flex h-12 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          href="/feed"
        >
          Go to the feed
        </Link>
      ) : (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs tracking-wide text-muted uppercase">Join</h2>
          {plans === null ? (
            <p className="text-sm text-muted">Loading</p>
          ) : plans.length === 0 ? (
            <p className="rounded-3xl border border-line border-dashed px-6 py-10 text-center text-sm leading-6 text-muted">
              No membership on sale yet.
              {isOwner || !viewerId
                ? " Set one up in Finance, then it appears here."
                : ""}
            </p>
          ) : (
            plans.map((plan) => (
              <div
                className="flex items-center justify-between gap-4 rounded-3xl border border-line bg-surface p-5"
                key={plan.slug}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{plan.name}</p>
                  {plan.description ? (
                    <p className="text-sm text-muted">{plan.description}</p>
                  ) : null}
                </div>
                <button
                  className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
                  onClick={() =>
                    viewerId ? void subscribe(plan.slug) : void signIn()
                  }
                  type="button"
                >
                  {viewerId
                    ? (plan.formattedTotal ?? "Join")
                    : "Sign in to join"}
                </button>
              </div>
            ))
          )}
        </section>
      )}

      {problem ? (
        <p className="text-center text-sm text-accent">{problem}</p>
      ) : null}

      {isOwner ? (
        <Link
          className="text-center text-sm text-muted underline underline-offset-4"
          href="/admin"
        >
          Admin
        </Link>
      ) : null}
    </main>
  );
}

function Frame({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
      {children}
    </main>
  );
}
