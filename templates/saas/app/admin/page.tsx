"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";

type Site = {
  id: string;
  product_name: string | null;
  tagline: string | null;
  pitch: string | null;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          View the site
        </Link>
      </header>
      <OwnerGate>{() => <Settings />}</OwnerGate>
    </main>
  );
}

function Settings() {
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,product_name,tagline,pitch")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
  }, []);

  async function save() {
    if (!site) return;
    setProblem(null);
    const { error } = await backend.database
      .from("site")
      .update({
        product_name: site.product_name,
        tagline: site.tagline,
        pitch: site.pitch,
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
    <div className="flex flex-col gap-4 pb-16">
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-5">
        <Field
          label="Product name"
          onChange={(value) => setSite({ ...site, product_name: value })}
          value={site.product_name ?? ""}
        />
        <Field
          label="Headline"
          onChange={(value) => setSite({ ...site, tagline: value })}
          value={site.tagline ?? ""}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">The paragraph under it</span>
          <textarea
            className="min-h-24 rounded-lg border border-line bg-background px-4 py-3 text-base outline-none transition-colors focus:border-focus sm:text-sm"
            onChange={(event) => setSite({ ...site, pitch: event.target.value })}
            value={site.pitch ?? ""}
          />
        </label>
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        <button
          className="h-11 rounded-lg bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void save()}
          type="button"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>

      <p className="rounded-lg border border-line bg-card p-5 text-sm leading-6 text-muted">
        Pricing, customers and revenue live in Finance, not here. Add a recurring
        product there and it appears on the pricing section on its own.
      </p>
    </div>
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
        className="h-11 rounded-lg border border-line bg-background px-4 text-base outline-none transition-colors focus:border-focus sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}
