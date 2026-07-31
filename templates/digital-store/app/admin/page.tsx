"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { callApi } from "@/lib/api";
import { backend } from "@/lib/backend";
import { objectKey } from "@/lib/object-key";

type Site = {
  id: string;
  store_name: string | null;
  tagline: string | null;
};

type Plan = { slug: string; name: string };
type ProductFile = {
  id: string;
  plan_slug: string;
  storage_path: string;
  label: string | null;
};

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <h1 className="text-sm font-medium">Admin</h1>
        <Link className="text-sm text-muted hover:text-foreground" href="/">
          View the shop
        </Link>
      </header>
      <OwnerGate>
        {() => (
          <div className="flex flex-1 flex-col gap-10 pb-16">
            <Files />
            <Settings />
          </div>
        )}
      </OwnerGate>
    </main>
  );
}

function Files() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function load() {
    // `product_files` has no policies, so the browser cannot query it and this
    // has to go through the route. Reading it directly here would silently
    // return an empty list and every product would look unattached.
    const [{ data: planData }, mapping] = await Promise.all([
      backend.payments.plans(),
      callApi<{ files: ProductFile[] }>("/api/files"),
    ]);
    setPlans((planData as Plan[] | null) ?? []);
    setFiles(mapping.data?.files ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function upload(slug: string, file: File) {
    setBusy(slug);
    setProblem(null);
    // The bucket is private, so this path is not a URL anyone can open. It only
    // becomes a link through /api/download, after the purchase is checked.
    //
    // The key is ours rather than read back off the response: `upload()` returns
    // three different shapes depending on the strategy the backend picks, and
    // storing the wrong field here would mean the file uploads fine and every
    // buyer's download 404s afterwards.
    const key = objectKey(file.name);
    const { error } = await backend.storage.from("downloads").upload(key, file);
    if (error) {
      setBusy(null);
      setProblem(error.message);
      return;
    }
    // Same reason: the mapping is written by the route, behind an owner check,
    // never from here.
    const saved = await callApi("/api/files", {
      method: "POST",
      body: JSON.stringify({
        planSlug: slug,
        storagePath: key,
        label: file.name,
      }),
    });
    setBusy(null);
    if (saved.error) setProblem(saved.error);
    else await load();
  }

  if (plans === null) return <p className="text-sm text-muted">Loading</p>;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">
        What buyers get
      </h2>

      {plans.length === 0 ? (
        <p className="rounded-2xl border border-line border-dashed px-5 py-10 text-center text-sm leading-6 text-muted">
          No products yet. Add one in Finance, then come back here to attach the
          file it delivers.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plans.map((plan) => {
            const file = files.find((entry) => entry.plan_slug === plan.slug);
            return (
              <li
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4"
                key={plan.slug}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{plan.name}</p>
                  <p className="truncate text-xs text-muted">
                    {file?.label ?? "No file attached, so nothing to deliver"}
                  </p>
                </div>
                <label className="shrink-0 cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-foreground">
                  {busy === plan.slug
                    ? "Uploading"
                    : file
                      ? "Replace"
                      : "Attach a file"}
                  <input
                    className="hidden"
                    onChange={(event) => {
                      const chosen = event.target.files?.[0];
                      if (chosen) void upload(plan.slug, chosen);
                    }}
                    type="file"
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}

      <p className="text-sm leading-6 text-muted">
        Sales, refunds and who bought what live in Finance. This page only
        decides which file each product hands over.
      </p>
    </section>
  );
}

function Settings() {
  const [site, setSite] = useState<Site | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,store_name,tagline")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
  }, []);

  async function save() {
    if (!site) return;
    await backend.database
      .from("site")
      .update({ store_name: site.store_name, tagline: site.tagline })
      .eq("id", site.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!site) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs tracking-wide text-muted uppercase">The shop</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">Name</span>
          <input
            // 16px on mobile, or Safari zooms the whole page when it focuses.
            className="h-11 rounded-xl border border-line bg-background px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            onChange={(event) =>
              setSite({ ...site, store_name: event.target.value })
            }
            type="text"
            value={site.store_name ?? ""}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">One line under it</span>
          <input
            className="h-11 rounded-xl border border-line bg-background px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            onChange={(event) =>
              setSite({ ...site, tagline: event.target.value })
            }
            type="text"
            value={site.tagline ?? ""}
          />
        </label>
        <button
          className="h-11 rounded-xl bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void save()}
          type="button"
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </section>
  );
}
