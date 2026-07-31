"use client";

// The product, behind the paywall.
//
// Nothing here reads the database. Every call goes to /api/entries, which
// checks the caller's subscription before it answers. A component that hides a
// feature is a component anyone can open devtools and un-hide.

import Link from "next/link";
import { useEffect, useState } from "react";
import { callApi } from "@/lib/api";
import { backend } from "@/lib/backend";

type Entry = {
  id: string;
  title: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const COLUMNS = [
  { key: "open", label: "Open" },
  { key: "doing", label: "Doing" },
  { key: "done", label: "Done" },
];

export function Workspace() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "out" | "locked">(
    "loading",
  );
  const [title, setTitle] = useState("");

  async function load() {
    const result = await callApi<{ entries: Entry[] }>("/api/entries");
    if (result.signedOut) return setState("out");
    if (result.needsMembership) return setState("locked");
    if (result.data) {
      setEntries(result.data.entries);
      setState("ready");
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const value = title;
    setTitle("");
    await callApi("/api/entries", {
      method: "POST",
      body: JSON.stringify({ intent: "create", title: value }),
    });
    backend.analytics.track("entry_created");
    await load();
  }

  async function act(intent: string, id: string, extra = {}) {
    await callApi("/api/entries", {
      method: "POST",
      body: JSON.stringify({ intent, id, ...extra }),
    });
    await load();
  }

  if (state === "loading") return <Centered>Loading</Centered>;

  if (state === "out") {
    return (
      <Centered>
        <p className="text-base text-foreground">Sign in to open the app.</p>
        <button
          className="h-11 rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink"
          onClick={() =>
            void backend.auth.signInWithOAuth("google", {
              redirectTo: `${window.location.origin}/app`,
            })
          }
          type="button"
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }

  if (state === "locked") {
    return (
      <Centered>
        <p className="text-base text-foreground">
          Your subscription is not active.
        </p>
        <p className="max-w-sm text-sm leading-6">
          Pick a plan and this opens straight away. If you just paid, give it a
          few seconds and reload.
        </p>
        <Link
          className="flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/#pricing"
        >
          See pricing
        </Link>
      </Centered>
    );
  }

  const rows = entries ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <form className="flex gap-2" onSubmit={create}>
        <input
          // 16px on mobile, or Safari zooms the whole page when it focuses.
          className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-4 text-base outline-none transition-colors focus:border-focus sm:text-sm"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Add something to track"
          value={title}
        />
        <button
          className="h-11 shrink-0 rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          type="submit"
        >
          Add
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-line border-dashed px-6 py-16 text-center text-sm text-muted">
          Nothing here yet. Add the first one above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          {COLUMNS.map((column) => {
            const inColumn = rows.filter((row) => row.status === column.key);
            return (
              <section className="flex flex-col gap-2" key={column.key}>
                <h2 className="px-1 text-xs tracking-wide text-muted uppercase">
                  {column.label}
                  <span className="ml-1.5 font-mono">{inColumn.length}</span>
                </h2>
                {inColumn.map((row) => (
                  <article
                    className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3"
                    key={row.id}
                  >
                    <p className="text-sm">{row.title}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted">
                      {COLUMNS.filter((next) => next.key !== row.status).map(
                        (next) => (
                          <button
                            className="underline underline-offset-4 hover:text-foreground"
                            key={next.key}
                            onClick={() =>
                              void act("status", row.id, { status: next.key })
                            }
                            type="button"
                          >
                            {next.label}
                          </button>
                        ),
                      )}
                      <button
                        className="underline underline-offset-4 hover:text-foreground"
                        onClick={() => void act("delete", row.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Centered({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center text-muted">
      {children}
    </div>
  );
}
