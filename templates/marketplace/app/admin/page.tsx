"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { callApi } from "@/lib/api";
import { backend } from "@/lib/backend";
import { hostOf } from "@/lib/listings";

type Row = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  category: string | null;
  contact_email: string | null;
  published: boolean;
  featured: boolean;
};

type Site = {
  id: string;
  name: string | null;
  tagline: string | null;
  categories: string | null;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          View the directory
        </Link>
      </header>
      <OwnerGate>
        {() => (
          <div className="flex flex-1 flex-col gap-10 pb-16">
            <Queue />
            <Settings />
          </div>
        )}
      </OwnerGate>
    </main>
  );
}

function Queue() {
  const [rows, setRows] = useState<Row[] | null>(null);

  async function load() {
    const result = await callApi<{ listings: Row[] }>("/api/listings");
    setRows(result.data?.listings ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function act(intent: string, id: string, value?: boolean) {
    await callApi("/api/listings", {
      method: "POST",
      body: JSON.stringify({ intent, id, value }),
    });
    await load();
  }

  if (rows === null) return <p className="text-sm text-muted">Loading</p>;

  const pending = rows.filter((row) => !row.published);
  const live = rows.filter((row) => row.published);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-wide text-muted uppercase">
          Waiting for you
          <span className="ml-1.5 font-mono">{pending.length}</span>
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
            Nothing waiting.
          </p>
        ) : (
          pending.map((row) => (
            <Card key={row.id} onAct={act} row={row} />
          ))
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs tracking-wide text-muted uppercase">
          Live
          <span className="ml-1.5 font-mono">{live.length}</span>
        </h2>
        {live.length === 0 ? (
          <p className="rounded-lg border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
            Nothing live yet.
          </p>
        ) : (
          live.map((row) => <Card key={row.id} onAct={act} row={row} />)
        )}
      </section>
    </div>
  );
}

function Card({
  onAct,
  row,
}: {
  readonly onAct: (intent: string, id: string, value?: boolean) => Promise<void>;
  readonly row: Row;
}) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{row.title}</h3>
        <span className="shrink-0 font-mono text-xs text-muted">
          {hostOf(row.url)}
        </span>
      </div>
      {row.summary ? (
        <p className="text-sm leading-6 text-muted">{row.summary}</p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-1 text-sm">
        <button
          className="text-muted underline underline-offset-4 hover:text-foreground"
          onClick={() => void onAct("publish", row.id, !row.published)}
          type="button"
        >
          {row.published ? "Unpublish" : "Approve"}
        </button>
        <button
          className="text-muted underline underline-offset-4 hover:text-foreground"
          onClick={() => void onAct("feature", row.id, !row.featured)}
          type="button"
        >
          {row.featured ? "Unfeature" : "Feature"}
        </button>
        <button
          className="text-muted underline underline-offset-4 hover:text-foreground"
          onClick={() => void onAct("delete", row.id)}
          type="button"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function Settings() {
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,name,tagline,categories")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
  }, []);

  async function save() {
    if (!site) return;
    await backend.database
      .from("site")
      .update({
        name: site.name,
        tagline: site.tagline,
        categories: site.categories,
      })
      .eq("id", site.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!site) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">
        The directory
      </h2>
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Name</span>
          <input
            className="h-11 rounded-lg border border-line bg-background px-4 text-base outline-none focus:border-accent sm:text-sm"
            onChange={(event) => setSite({ ...site, name: event.target.value })}
            type="text"
            value={site.name ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">One line under it</span>
          <input
            className="h-11 rounded-lg border border-line bg-background px-4 text-base outline-none focus:border-accent sm:text-sm"
            onChange={(event) =>
              setSite({ ...site, tagline: event.target.value })
            }
            type="text"
            value={site.tagline ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">
            Categories, one per line. Leave empty for no filter bar.
          </span>
          <textarea
            className="min-h-28 rounded-lg border border-line bg-background px-4 py-3 text-base outline-none focus:border-accent sm:text-sm"
            onChange={(event) =>
              setSite({ ...site, categories: event.target.value })
            }
            value={site.categories ?? ""}
          />
        </label>
        <button
          className="h-11 rounded-lg bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void save()}
          type="button"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}
