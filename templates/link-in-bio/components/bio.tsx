"use client";

// The public page. Everything on it is read from the database at runtime.
//
// Why this is a client component and not a server one: a server component that
// awaits a backend read is PRERENDERED AT BUILD TIME by default, when there is
// no database to read and nobody has set the page up yet. The result is a page
// that ships empty and stays empty. If you do want this rendered on the server
// (for search engines), add `export const dynamic = "force-dynamic"` to the
// page, which is checked and does work. Do not just move the read.

import Link from "next/link";
import { useEffect, useState } from "react";
import { backend } from "@/lib/backend";
import {
  type LinkRow,
  type Site,
  initials,
  normalizeHex,
  readableInk,
  safeUrl,
} from "@/lib/profile";

type Product = {
  slug: string;
  name: string;
  description: string | null;
  formattedTotal?: string;
};

export function Bio() {
  const [site, setSite] = useState<Site | null | undefined>(undefined);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    // The published filter is belt and braces: the read policy on `links`
    // already hides unpublished rows from anyone who is not the owner, and the
    // owner is the one person who would otherwise see their drafts in public.
    backend.database
      .from("links")
      .select("id,label,url,position,published")
      .eq("published", true)
      .order("position", { ascending: true })
      .then(({ data }) => setLinks((data as LinkRow[] | null) ?? []));

    backend.database
      .from("site")
      .select("id,user_id,display_name,tagline,bio,avatar_url,accent")
      .limit(1)
      .then(({ data }) => setSite((data as Site[] | null)?.[0] ?? null));

    backend.auth
      .getCurrentUser()
      .then(({ data }) => setViewerId(data.user?.id ?? null));

    // Products are optional. Payments are not set up on a new project, and a
    // bio page with no shop is a perfectly good bio page, so a failure here
    // renders nothing rather than an error.
    backend.payments.plans().then(({ data }) => {
      if (data) setProducts(data);
    });
  }, []);

  // Reserve the shape rather than showing a spinner: this page is one column of
  // known height, so a skeleton keeps it from jumping when the row lands.
  if (site === undefined) {
    return (
      <Frame>
        <div className="size-20 animate-pulse rounded-full bg-line" />
        <div className="h-6 w-40 animate-pulse rounded-full bg-line" />
        <div className="h-4 w-56 animate-pulse rounded-full bg-line" />
      </Frame>
    );
  }

  if (!site) {
    return (
      <Frame>
        <h1 className="text-xl font-medium">This page is not set up yet</h1>
        <p className="max-w-xs text-sm leading-6 text-muted">
          Open the editor, claim the page, and add your first link.
        </p>
        <Link
          className="flex h-11 items-center rounded-full bg-accent px-6 text-sm font-medium text-accent-ink"
          href="/admin"
        >
          Open the editor
        </Link>
      </Frame>
    );
  }

  const accent = normalizeHex(site.accent);
  const name = site.display_name?.trim() || "Your name";
  const isOwner = Boolean(viewerId && viewerId === site.user_id);

  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-14 sm:py-20"
      // The owner's accent, applied at runtime. It overrides the fallback in
      // globals.css for this subtree and nothing else.
      style={
        accent
          ? ({
              "--accent": accent,
              "--accent-ink": readableInk(accent),
            } as React.CSSProperties)
          : undefined
      }
    >
      <header className="flex flex-col items-center gap-4 text-center">
        {site.avatar_url ? (
          // Not next/image: the URL is user data pointing at a bucket, and the
          // loader would need that host allow-listed in next.config before it
          // would render at all.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={name}
            className="size-20 rounded-full border border-line object-cover"
            src={site.avatar_url}
          />
        ) : (
          <span className="flex size-20 items-center justify-center rounded-full bg-accent text-xl font-medium text-accent-ink">
            {initials(site.display_name)}
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-medium tracking-tight">{name}</h1>
          {site.tagline ? (
            <p className="text-sm text-muted">{site.tagline}</p>
          ) : null}
        </div>
        {site.bio ? (
          <p className="max-w-sm text-sm leading-6 whitespace-pre-line text-muted">
            {site.bio}
          </p>
        ) : null}
      </header>

      {links.length > 0 ? (
        <nav className="mt-10 flex flex-col gap-3">
          {links.map((link) => (
            <LinkCard key={link.id} link={link} />
          ))}
        </nav>
      ) : null}

      {products.length > 0 ? (
        <section className="mt-10 flex flex-col gap-3">
          <h2 className="px-1 text-xs tracking-wide text-muted uppercase">
            For sale
          </h2>
          {products.map((product) => (
            <ProductCard
              key={product.slug}
              onProblem={setProblem}
              product={product}
              signedIn={Boolean(viewerId)}
            />
          ))}
        </section>
      ) : null}

      {problem ? (
        <p className="mt-4 text-center text-sm text-red-700">{problem}</p>
      ) : null}

      {isOwner ? (
        <Link
          className="mt-10 text-center text-sm text-muted underline underline-offset-4"
          href="/admin"
        >
          Edit this page
        </Link>
      ) : null}
    </main>
  );
}

function LinkCard({ link }: { readonly link: LinkRow }) {
  const href = safeUrl(link.url);
  if (!href) return null;
  return (
    <a
      className="group flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-5 py-4 text-sm font-medium transition-transform hover:-translate-y-0.5"
      href={href}
      // Shows up in Analytics > Web, so the owner can see which link earns its
      // place without any tracking table of their own.
      onClick={() => backend.analytics.track("link_click", { label: link.label })}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="truncate">{link.label}</span>
      <svg
        aria-hidden="true"
        className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5"
        fill="none"
        height="14"
        viewBox="0 0 16 16"
        width="14"
      >
        <path
          d="M5 3h8v8M13 3 3 13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
      </svg>
    </a>
  );
}

function ProductCard({
  onProblem,
  product,
  signedIn,
}: {
  readonly onProblem: (message: string | null) => void;
  readonly product: Product;
  readonly signedIn: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function act() {
    onProblem(null);
    setBusy(true);
    // A payment has to be attached to an account or it can never be matched
    // back to the buyer, so checkout refuses an anonymous caller. Signing in is
    // its own step here rather than a hidden one, because on a normal tab it
    // navigates away and anything queued behind it would never run.
    if (!signedIn) {
      const { error } = await backend.auth.signInWithOAuth("google", {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      if (error) onProblem(error.nextActions ?? error.message);
      return;
    }
    backend.analytics.track("product_click", { plan: product.slug });
    const { error } = await backend.payments.checkout({
      plan: product.slug,
      successUrl: window.location.origin,
    });
    setBusy(false);
    if (error) onProblem(error.message);
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-card px-5 py-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{product.name}</p>
        {product.description ? (
          <p className="truncate text-sm text-muted">{product.description}</p>
        ) : null}
      </div>
      <button
        className="h-9 shrink-0 rounded-full bg-accent px-4 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        disabled={busy}
        onClick={() => void act()}
        type="button"
      >
        {signedIn ? (product.formattedTotal ?? "Buy") : "Sign in to buy"}
      </button>
    </div>
  );
}

function Frame({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-20 text-center">
      {children}
    </main>
  );
}
