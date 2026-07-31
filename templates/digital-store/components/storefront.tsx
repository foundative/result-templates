"use client";

// The shop. Products come from Finance, not from a table in this app, so a
// price change is never a code change and a price id is never hardcoded into an
// app that then breaks the day it goes live.
//
// Prices are read in the BROWSER on purpose. In a browser `plans()` comes back
// localized, with the right currency and the right tax for wherever the visitor
// is. That is the thing being a merchant of record buys you, and rendering the
// price on the server would throw it away.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

export type Plan = {
  slug: string;
  name: string;
  description: string | null;
  formattedTotal?: string;
  interval: string | null;
};

type Site = {
  user_id: string | null;
  store_name: string | null;
  tagline: string | null;
};

export function Storefront() {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("user_id,store_name,tagline")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
    backend.payments.plans().then(({ data }) => setPlans(data ?? []));
    backend.auth
      .getCurrentUser()
      .then(({ data }) => setViewerId(data.user?.id ?? null));
  }, []);

  if (site === undefined) {
    return (
      <main className="flex flex-1 items-center justify-center text-sm text-muted">
        Loading
      </main>
    );
  }

  const isOwner = Boolean(viewerId && site && viewerId === site.user_id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-sm font-medium">
          {site?.store_name?.trim() || "The shop"}
        </span>
        <Link className="text-sm text-muted hover:text-foreground" href="/library">
          Your library
        </Link>
      </header>

      <section className="flex flex-col gap-3 py-10">
        <h1 className="text-3xl font-medium tracking-tight text-balance">
          {site?.store_name?.trim() || "Things worth paying for"}
        </h1>
        {site?.tagline ? (
          <p className="text-base leading-7 text-muted">{site.tagline}</p>
        ) : null}
      </section>

      {plans === null ? (
        <p className="text-sm text-muted">Loading</p>
      ) : plans.length === 0 ? (
        <p className="rounded-2xl border border-line border-dashed px-6 py-16 text-center text-sm leading-6 text-muted">
          Nothing on sale yet. Add a product in Finance and it appears here on
          its own, priced correctly for wherever the buyer is.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {plans.map((plan) => (
            <li key={plan.slug}>
              <Link
                className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-card p-5 transition-transform hover:-translate-y-0.5"
                href={`/p/${plan.slug}`}
              >
                <p className="text-sm font-medium">{plan.name}</p>
                {plan.description ? (
                  <p className="line-clamp-3 text-sm leading-6 text-muted">
                    {plan.description}
                  </p>
                ) : null}
                <p className="mt-auto pt-2 text-sm">
                  {plan.formattedTotal ?? ""}
                  {plan.interval ? (
                    <span className="text-muted"> per {plan.interval}</span>
                  ) : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="py-10 text-sm text-muted">
        {isOwner || !site ? (
          <Link className="underline underline-offset-4" href="/admin">
            {site ? "Admin" : "Set the shop up"}
          </Link>
        ) : null}
      </footer>
    </main>
  );
}
