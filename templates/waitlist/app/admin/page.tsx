"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";

type Signup = {
  id: string;
  email: string;
  source: string | null;
  created_at: string;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Waitlist</h1>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/"
        >
          View the page
        </Link>
      </header>
      <OwnerGate>{() => <Signups />}</OwnerGate>
    </main>
  );
}

function Signups() {
  const [rows, setRows] = useState<Signup[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // No filter and no user id: the row-level policy on this table already
    // restricts it to the owner, so the query cannot return anyone else's data
    // even if this line is copied somewhere careless.
    backend.database
      .from("signups")
      .select("id,email,source,created_at")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setProblem(error.message);
        setRows((data as Signup[] | null) ?? []);
      });
  }, []);

  async function copyCsv() {
    if (!rows?.length) return;
    const csv = [
      "email,source,signed_up_at",
      ...rows.map((row) =>
        [row.email, row.source ?? "", row.created_at]
          // A comma or a quote inside a field breaks every spreadsheet that
          // opens this, and a referrer URL can contain both.
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("Your browser would not give access to the clipboard.");
    }
  }

  if (rows === null) {
    return <p className="py-20 text-center text-sm text-muted">Loading</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-3xl font-medium tracking-tight">{rows.length}</p>
          <p className="text-sm text-muted">
            {rows.length === 1 ? "person waiting" : "people waiting"}
          </p>
        </div>
        <button
          className="h-10 shrink-0 rounded-full border border-line px-4 text-sm transition-colors hover:bg-surface disabled:opacity-50"
          disabled={rows.length === 0}
          onClick={() => void copyCsv()}
          type="button"
        >
          {copied ? "Copied" : "Copy as CSV"}
        </button>
      </div>

      {problem ? <p className="text-sm text-accent">{problem}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-line border-dashed px-6 py-16 text-center text-sm text-muted">
          Nobody has signed up yet. Share the page and they will land here.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line">
          {rows.map((row) => (
            <li
              className="flex items-center justify-between gap-4 bg-surface px-5 py-3.5"
              key={row.id}
            >
              <span className="truncate text-sm">{row.email}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {new Date(row.created_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
