"use client";

// What you paid for, and the only place a download link is handed out.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

type Purchase = {
  transaction_id: string;
  plan: string | null;
  amount: string | null;
  currency_code: string | null;
  billed_at: string | null;
};

export default function Library() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function load() {
    const token = await backend
      .getHttpClient()
      .getValidAccessToken()
      .catch(() => null);
    if (!token) {
      setSignedIn(false);
      return;
    }
    setSignedIn(true);
    const response = await fetch("/api/download", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = (await response.json()) as { purchases?: Purchase[] };
    setPurchases(body.purchases ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return backend.auth.onAuthStateChange(() => void load());
  }, []);

  async function download(plan: string) {
    setProblem(null);
    const token = await backend
      .getHttpClient()
      .getValidAccessToken()
      .catch(() => null);
    if (!token) return;
    const response = await fetch(
      `/api/download?plan=${encodeURIComponent(plan)}`,
      { headers: { authorization: `Bearer ${token}` } },
    );
    const body = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !body.url) {
      setProblem(body.error ?? "Could not open that file.");
      return;
    }
    // The link expires in minutes, so it is used immediately and never stored.
    // assign() rather than setting location.href, which reads as mutating a
    // value from outside the component.
    window.location.assign(body.url);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-sm font-medium">Your library</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          The shop
        </Link>
      </header>

      {signedIn === false ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
          <p className="text-base">Sign in to see what you have bought.</p>
          <button
            className="h-11 rounded-xl bg-accent px-6 text-sm font-medium text-accent-ink"
            onClick={() =>
              void backend.auth.signInWithOAuth("google", {
                redirectTo: `${window.location.origin}/library`,
              })
            }
            type="button"
          >
            Sign in with Google
          </button>
        </div>
      ) : purchases === null ? (
        <p className="py-20 text-center text-sm text-muted">Loading</p>
      ) : purchases.length === 0 ? (
        <p className="my-10 rounded-2xl border border-line border-dashed px-6 py-16 text-center text-sm leading-6 text-muted">
          Nothing here yet. Anything you buy shows up on this page and stays
          here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 py-4 pb-16">
          {purchases.map((purchase) => (
            <li
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4"
              key={purchase.transaction_id}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {purchase.plan ?? "Purchase"}
                </p>
                <p className="text-xs text-muted">
                  {purchase.billed_at
                    ? new Date(purchase.billed_at).toLocaleDateString()
                    : ""}
                </p>
              </div>
              {purchase.plan ? (
                <button
                  className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
                  onClick={() => void download(purchase.plan as string)}
                  type="button"
                >
                  Download
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {problem ? (
        <p className="pb-10 text-center text-sm text-red-700">{problem}</p>
      ) : null}
    </main>
  );
}
