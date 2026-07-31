"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";

type Site = {
  id: string;
  name: string | null;
  tagline: string | null;
  promise: string | null;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/"
        >
          View the page
        </Link>
      </header>
      <OwnerGate>{() => <Settings />}</OwnerGate>
    </main>
  );
}

function Settings() {
  const [site, setSite] = useState<Site | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,name,tagline,promise")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));

    // billing_subscriptions only exists once payments are set up, and its read
    // policy scopes rows to their own owner, so this count is 0 or 1 from the
    // browser. The real number lives in Finance; this is a link, not a report.
    backend.payments.plans().then(({ data }) => setMembers(data?.length ?? 0));
  }, []);

  async function save() {
    if (!site) return;
    setProblem(null);
    const { error } = await backend.database
      .from("site")
      .update({
        name: site.name,
        tagline: site.tagline,
        promise: site.promise,
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
    <div className="flex flex-1 flex-col gap-6 pb-16">
      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
        <Field
          label="Name"
          onChange={(value) => setSite({ ...site, name: value })}
          value={site.name ?? ""}
        />
        <Field
          label="One line about it"
          onChange={(value) => setSite({ ...site, tagline: value })}
          value={site.tagline ?? ""}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">What members get</span>
          <textarea
            className="min-h-32 rounded-2xl border border-line bg-background px-4 py-3 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            onChange={(event) => setSite({ ...site, promise: event.target.value })}
            placeholder={"One thing per line.\nWeekly teardowns.\nDirect answers from me."}
            value={site.promise ?? ""}
          />
        </label>
        {problem ? <p className="text-sm text-accent">{problem}</p> : null}
        <button
          className="h-11 rounded-full bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void save()}
          type="button"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </section>

      <section className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-5">
        <h2 className="text-xs tracking-wide text-muted uppercase">
          Membership
        </h2>
        {members === 0 ? (
          <p className="text-sm leading-6 text-muted">
            Nothing is on sale yet, so nobody can join. Add a recurring product
            in Finance and it appears on the page on its own.
          </p>
        ) : (
          <p className="text-sm leading-6 text-muted">
            {members} membership{members === 1 ? "" : "s"} on sale. Who is
            subscribed, and what they have paid, is in Finance.
          </p>
        )}
        <p className="text-sm leading-6 text-muted">
          Moderation lives on the feed itself: pin and delete appear on each post
          for you and nobody else.
        </p>
      </section>
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
        // 16px on mobile, or Safari zooms the whole page when the field focuses.
        className="h-11 rounded-2xl border border-line bg-background px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </label>
  );
}
