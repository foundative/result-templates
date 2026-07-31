"use client";

// The page that sells the thing. Copy at the top, pricing from Finance.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

const FEATURES = [
  {
    title: "One list, not four tools",
    body: "Everything your team is tracking, in a place that opens in one tab and needs no training.",
  },
  {
    title: "Fast enough to actually use",
    body: "Nothing loads twice. Nothing asks you to pick a workspace before it shows you anything.",
  },
  {
    title: "Priced like a tool, not a platform",
    body: "One number, per month, cancel whenever. No seats to count and no annual talk.",
  },
];

type Site = {
  user_id: string | null;
  product_name: string | null;
  tagline: string | null;
  pitch: string | null;
};

type Plan = {
  slug: string;
  name: string;
  description: string | null;
  formattedTotal?: string;
};

export function Marketing() {
  const [site, setSite] = useState<Site | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("user_id,product_name,tagline,pitch")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
    backend.payments.plans().then(({ data }) => setPlans(data ?? []));
    backend.auth.getCurrentUser().then(({ data }) => {
      setViewerId(data.user?.id ?? null);
      if (data.user) {
        backend.payments
          .hasAccess()
          .then(({ data: allowed }) => setHasPlan(Boolean(allowed)));
      }
    });
  }, []);

  async function signIn() {
    setProblem(null);
    // From a click handler, never an effect: a popup opened outside a user
    // gesture is blocked by the browser.
    const { error } = await backend.auth.signInWithOAuth("google", {
      redirectTo: `${window.location.origin}/app`,
    });
    if (error) setProblem(error.nextActions ?? error.message);
  }

  async function subscribe(slug: string) {
    setProblem(null);
    backend.analytics.track("checkout_opened", { plan: slug });
    const { error } = await backend.payments.checkout({
      plan: slug,
      // Access comes from the payment event the platform receives, never from
      // landing here.
      successUrl: `${window.location.origin}/app`,
    });
    if (error) setProblem(error.message);
  }

  const name = site?.product_name?.trim() || "Ledgerly";
  const isOwner = Boolean(viewerId && site && viewerId === site.user_id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-sm font-medium">{name}</span>
        <div className="flex items-center gap-4 text-sm">
          {hasPlan ? (
            <Link className="text-muted hover:text-foreground" href="/app">
              Open the app
            </Link>
          ) : null}
          <Link className="text-muted hover:text-foreground" href="/account">
            Account
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-6 py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl leading-[1.1] font-medium tracking-tight text-balance sm:text-5xl">
          {site?.tagline?.trim() || "The quiet way to track anything"}
        </h1>
        <p className="max-w-xl text-base leading-7 text-muted">
          {site?.pitch?.trim() ||
            "One list, shared with your team, that does not need a manual. Open it, type, close it."}
        </p>
        <div className="flex flex-wrap gap-3">
          {hasPlan ? (
            <Link
              className="flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink"
              href="/app"
            >
              Open the app
            </Link>
          ) : (
            <button
              className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
              onClick={() => {
                if (!viewerId) void signIn();
                else document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
              }}
              type="button"
            >
              {viewerId ? "See pricing" : "Get started"}
            </button>
          )}
        </div>
      </section>

      <section className="grid gap-8 border-t border-line py-14 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <div className="flex flex-col gap-2" key={feature.title}>
            <h2 className="text-sm font-medium">{feature.title}</h2>
            <p className="text-sm leading-6 text-muted">{feature.body}</p>
          </div>
        ))}
      </section>

      <section
        className="flex flex-col gap-4 border-t border-line py-14"
        id="pricing"
      >
        <h2 className="text-xs tracking-wide text-muted uppercase">Pricing</h2>
        {plans === null ? (
          <p className="text-sm text-muted">Loading</p>
        ) : plans.length === 0 ? (
          <p className="rounded-lg border border-line border-dashed px-6 py-10 text-center text-sm leading-6 text-muted">
            Nothing on sale yet. Add a recurring product in Finance and it
            appears here on its own.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <div
                className="flex flex-col gap-3 rounded-lg border border-line bg-card p-5"
                key={plan.slug}
              >
                <p className="text-sm font-medium">{plan.name}</p>
                <p className="text-2xl font-medium tracking-tight">
                  {plan.formattedTotal ?? ""}
                </p>
                {plan.description ? (
                  <p className="text-sm leading-6 text-muted">
                    {plan.description}
                  </p>
                ) : null}
                <button
                  className="mt-auto h-10 rounded-lg bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
                  onClick={() =>
                    viewerId ? void subscribe(plan.slug) : void signIn()
                  }
                  type="button"
                >
                  {viewerId ? "Subscribe" : "Sign in to subscribe"}
                </button>
              </div>
            ))}
          </div>
        )}
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
      </section>

      <footer className="flex items-center justify-between border-t border-line py-8 text-sm text-muted">
        <span>{name}</span>
        {isOwner ? (
          <Link className="underline underline-offset-4" href="/admin">
            Admin
          </Link>
        ) : null}
      </footer>
    </main>
  );
}
