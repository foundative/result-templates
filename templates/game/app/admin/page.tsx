"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";

type Site = {
  id: string;
  title: string | null;
  tagline: string | null;
  accent: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

type Score = { id: string; name: string; score: number };

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          Play it
        </Link>
      </header>
      <OwnerGate>
        {() => (
          <div className="flex flex-1 flex-col gap-8 pb-16">
            <Branding />
            <Board />
          </div>
        )}
      </OwnerGate>
    </main>
  );
}

function Branding() {
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,title,tagline,accent,cta_label,cta_url")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
  }, []);

  async function save() {
    if (!site) return;
    setProblem(null);
    const { error } = await backend.database
      .from("site")
      .update({
        title: site.title,
        tagline: site.tagline,
        accent: site.accent,
        cta_label: site.cta_label,
        cta_url: site.cta_url,
      })
      .eq("id", site.id);
    if (error) setProblem(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  if (!site) return <p className="text-sm text-muted">Loading</p>;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">The page</h2>
      <Field
        label="Headline"
        onChange={(value) => setSite({ ...site, title: value })}
        value={site.title ?? ""}
      />
      <Field
        label="One line under it"
        onChange={(value) => setSite({ ...site, tagline: value })}
        value={site.tagline ?? ""}
      />
      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">Accent color</span>
        <input
          className="size-9 cursor-pointer rounded-full border border-line bg-surface"
          onChange={(event) => setSite({ ...site, accent: event.target.value })}
          type="color"
          value={site.accent ?? "#ff4d8d"}
        />
      </label>

      <p className="pt-2 text-sm leading-6 text-muted">
        The button under the leaderboard is what makes this a marketing page
        rather than a toy. Point it at whatever you actually sell.
      </p>
      <Field
        label="Button label"
        onChange={(value) => setSite({ ...site, cta_label: value })}
        value={site.cta_label ?? ""}
      />
      <Field
        label="Button link"
        onChange={(value) => setSite({ ...site, cta_url: value })}
        value={site.cta_url ?? ""}
      />

      {problem ? <p className="text-sm text-accent">{problem}</p> : null}
      <button
        className="h-11 rounded-full bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
        onClick={() => void save()}
        type="button"
      >
        {saved ? "Saved" : "Save"}
      </button>
    </section>
  );
}

function Board() {
  const [scores, setScores] = useState<Score[] | null>(null);

  async function load() {
    const { data } = await backend.database
      .from("scores")
      .select("id,name,score")
      .order("score", { ascending: false })
      .limit(50);
    setScores((data as Score[] | null) ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function remove(id: string) {
    await backend.database.from("scores").delete().eq("id", id);
    await load();
  }

  if (scores === null) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">
        Leaderboard
      </h2>
      {scores.length === 0 ? (
        <p className="rounded-2xl border border-line border-dashed px-5 py-8 text-center text-sm text-muted">
          Nobody has played yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {scores.map((entry) => (
            <li
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm odd:bg-surface"
              key={entry.id}
            >
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              <span className="font-mono">{entry.score}</span>
              <button
                className="text-xs text-muted underline underline-offset-4 hover:text-foreground"
                onClick={() => void remove(entry.id)}
                type="button"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        className="h-11 rounded-2xl border border-line bg-surface px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}
