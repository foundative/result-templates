"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OwnerGate } from "@/components/owner-gate";
import { backend } from "@/lib/backend";
import { type LinkRow, type Site, normalizeHex, safeUrl } from "@/lib/profile";

export default function Admin() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <h1 className="text-sm font-medium">Editor</h1>
        <Link
          className="text-sm text-muted transition-colors hover:text-foreground"
          href="/"
        >
          View the page
        </Link>
      </header>
      <OwnerGate>{() => <Editor />}</OwnerGate>
    </main>
  );
}

function Editor() {
  return (
    <div className="flex flex-1 flex-col gap-10 pb-16">
      <Profile />
      <Links />
    </div>
  );
}

function Profile() {
  const [site, setSite] = useState<Site | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    backend.database
      .from("site")
      .select("id,user_id,display_name,tagline,bio,avatar_url,accent")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));
  }, []);

  function edit(patch: Partial<Site>) {
    setSaved(false);
    setSite((current) => (current ? { ...current, ...patch } : current));
  }

  async function save() {
    if (!site) return;
    setSaving(true);
    setProblem(null);
    const { error } = await backend.database
      .from("site")
      .update({
        display_name: site.display_name,
        tagline: site.tagline,
        bio: site.bio,
        accent: normalizeHex(site.accent),
      })
      // The owner policy already scopes this to their own row, but an update
      // with no filter is a habit worth not building: copied into a table that
      // holds more than one row, it rewrites all of them.
      .eq("id", site.id);
    setSaving(false);
    if (error) setProblem(error.message);
    else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function upload(file: File) {
    if (!site) return;
    setProblem(null);
    const { data, error } = await backend.storage.from("avatars").uploadAuto(file);
    if (error || !data) {
      setProblem(error?.message ?? "That file would not upload.");
      return;
    }
    // Saved on its own rather than waiting for the Save button: an upload that
    // appears to work and then vanishes on reload is the worse failure.
    const { error: writeError } = await backend.database
      .from("site")
      .update({ avatar_url: data.url })
      .eq("id", site.id);
    if (writeError) setProblem(writeError.message);
    else edit({ avatar_url: data.url });
  }

  if (!site) return <p className="text-sm text-muted">Loading</p>;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs tracking-wide text-muted uppercase">Profile</h2>

      <label className="flex cursor-pointer items-center gap-4">
        {site.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-14 rounded-full border border-line object-cover"
            src={site.avatar_url}
          />
        ) : (
          <span className="size-14 rounded-full border border-line border-dashed" />
        )}
        <span className="text-sm text-muted underline underline-offset-4">
          {site.avatar_url ? "Replace photo" : "Add a photo"}
        </span>
        <input
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
          type="file"
        />
      </label>

      <Field
        label="Name"
        onChange={(value) => edit({ display_name: value })}
        placeholder="Ada Lovelace"
        value={site.display_name ?? ""}
      />
      <Field
        label="Tagline"
        onChange={(value) => edit({ tagline: value })}
        placeholder="Building things that count"
        value={site.tagline ?? ""}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Bio</span>
        <textarea
          className="min-h-24 rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
          onChange={(event) => edit({ bio: event.target.value })}
          placeholder="A sentence or two about what you do."
          value={site.bio ?? ""}
        />
      </label>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">Accent color</span>
        <input
          className="size-9 cursor-pointer rounded-full border border-line bg-card"
          onChange={(event) => edit({ accent: event.target.value })}
          type="color"
          value={normalizeHex(site.accent) ?? "#1c1a17"}
        />
      </label>

      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}

      <button
        className="h-11 rounded-full bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        disabled={saving}
        onClick={() => void save()}
        type="button"
      >
        {saving ? "Saving" : saved ? "Saved" : "Save profile"}
      </button>
    </section>
  );
}

function Links() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    const { data } = await backend.database
      .from("links")
      .select("id,label,url,position,published")
      .order("position", { ascending: true });
    setLinks((data as LinkRow[] | null) ?? []);
  }

  async function add() {
    setProblem(null);
    if (!label.trim()) return;
    if (!safeUrl(url)) {
      setProblem("That address will not open. Try something like acme.com.");
      return;
    }
    const next = (links?.length ?? 0) + 1;
    // user_id fills in from the session by a column default, so it is not sent.
    const { error } = await backend.database
      .from("links")
      .insert({ label: label.trim(), url: url.trim(), position: next });
    if (error) {
      setProblem(error.message);
      return;
    }
    setLabel("");
    setUrl("");
    await load();
  }

  async function remove(id: string) {
    await backend.database.from("links").delete().eq("id", id);
    await load();
  }

  async function toggle(link: LinkRow) {
    await backend.database
      .from("links")
      .update({ published: !link.published })
      .eq("id", link.id);
    await load();
  }

  /**
   * Swap this link with its neighbour.
   *
   * Two writes rather than a drag library: reordering is a rare action on a
   * list of eight things, and a drag-and-drop dependency is install time every
   * visitor pays for on their first screen.
   */
  async function move(index: number, direction: -1 | 1) {
    if (!links) return;
    const target = links[index + direction];
    const current = links[index];
    if (!target || !current) return;
    await Promise.all([
      backend.database
        .from("links")
        .update({ position: target.position })
        .eq("id", current.id),
      backend.database
        .from("links")
        .update({ position: current.position })
        .eq("id", target.id),
    ]);
    await load();
  }

  if (links === null) return <p className="text-sm text-muted">Loading</p>;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs tracking-wide text-muted uppercase">Links</h2>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-line border-dashed px-5 py-10 text-center text-sm text-muted">
          No links yet. Add the first one below.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {links.map((link, index) => (
            <li
              className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-3"
              key={link.id}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm font-medium ${link.published ? "" : "text-muted line-through"}`}
                >
                  {link.label}
                </p>
                <p className="truncate text-xs text-muted">{link.url}</p>
              </div>
              <IconButton
                disabled={index === 0}
                label="Move up"
                onClick={() => void move(index, -1)}
              >
                ↑
              </IconButton>
              <IconButton
                disabled={index === links.length - 1}
                label="Move down"
                onClick={() => void move(index, 1)}
              >
                ↓
              </IconButton>
              <IconButton
                label={link.published ? "Hide" : "Show"}
                onClick={() => void toggle(link)}
              >
                {link.published ? "○" : "●"}
              </IconButton>
              <IconButton label="Delete" onClick={() => void remove(link.id)}>
                ✕
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
        <Field
          label="Label"
          onChange={setLabel}
          placeholder="My newsletter"
          value={label}
        />
        <Field
          label="Address"
          onChange={setUrl}
          placeholder="acme.com/newsletter"
          value={url}
        />
        {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
        <button
          className="h-10 rounded-full bg-accent text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          onClick={() => void add()}
          type="button"
        >
          Add link
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <input
        // 16px on mobile, or Safari zooms the whole page when the field focuses.
        className="h-11 rounded-2xl border border-line bg-card px-4 text-base outline-none transition-colors focus:border-foreground sm:text-sm"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="text"
        value={value}
      />
    </label>
  );
}

function IconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  readonly children: React.ReactNode;
  readonly disabled?: boolean;
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm text-muted transition-colors hover:bg-background disabled:opacity-30"
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
