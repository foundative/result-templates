"use client";

// The one thing this page is for. Everything else on it exists to get someone
// to this component.
//
// Three states, and the third one matters more than it looks: a form that
// clears itself and shows a small grey "thanks" reads as a failure. Replacing
// the form outright with something that has its own next action is what makes
// a signup feel like it landed.

import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";

type State = "idle" | "saving" | "done";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/signup")
      .then((response) => response.json())
      .then((body: { count?: number }) => {
        if (!cancelled) setCount(body.count ?? 0);
      })
      .catch(() => {
        // Social proof is a nice-to-have. A failed count must not look like a
        // broken page, so it just stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (state === "saving") return;
    setState("saving");
    setProblem(null);

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: document.referrer || null }),
      });
      const body = (await response.json()) as {
        error?: string;
        alreadyOnList?: boolean;
        count?: number;
      };
      if (!response.ok) {
        setProblem(body.error ?? "Could not save that. Try again.");
        setState("idle");
        return;
      }
      setAlreadyOnList(Boolean(body.alreadyOnList));
      if (typeof body.count === "number") setCount(body.count);
      setState("done");
      // Shows up in Analytics > Web as a goal you can build a funnel on.
      backend.analytics.track("waitlist_signup");
    } catch {
      setProblem("Could not reach the server. Check your connection.");
      setState("idle");
    }
  }

  if (state === "done") return <Joined alreadyOnList={alreadyOnList} count={count} />;

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <div className="flex h-14 items-center gap-2 rounded-full border border-line bg-surface pr-2 pl-5 transition-colors focus-within:border-accent">
        <label className="sr-only" htmlFor="email">
          Email address
        </label>
        <input
          autoComplete="email"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          id="email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          required
          type="email"
          value={email}
        />
        <button
          className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          disabled={state === "saving"}
          type="submit"
        >
          {state === "saving" ? "Joining" : "Join"}
        </button>
      </div>

      <p aria-live="polite" className="min-h-5 px-5 text-sm text-muted">
        {problem ? (
          <span className="text-accent">{problem}</span>
        ) : (
          <>
            No spam. One email when the doors open.
            {count !== null && count > 0 ? ` ${count} already waiting.` : ""}
          </>
        )}
      </p>
    </form>
  );
}

function Joined({
  alreadyOnList,
  count,
}: {
  readonly alreadyOnList: boolean;
  readonly count: number | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright. The link is on screen either
      // way, so there is nothing to recover from.
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-ink">
          <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
            <path
              d="M3 8.5 6.5 12 13 4.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </span>
        <p className="text-base font-medium">
          {alreadyOnList ? "You were already on the list" : "You are on the list"}
          {count ? <span className="text-muted"> at number {count}</span> : null}
        </p>
      </div>

      <p className="text-sm leading-6 text-muted">
        Check your inbox for a confirmation. Moving up the list is easy: send
        this to someone who would want it too.
      </p>

      <button
        className="flex h-11 items-center justify-center gap-2 rounded-full border border-line text-sm transition-colors hover:bg-background"
        onClick={() => void copy()}
        type="button"
      >
        {copied ? "Link copied" : "Copy the link"}
      </button>
    </div>
  );
}
