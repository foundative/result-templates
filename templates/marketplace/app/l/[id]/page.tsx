import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hostOf, readListing, safeUrl } from "@/lib/listings";

// Rendered on the server, on every request. See the note in app/page.tsx: this
// line is what stops Next prerendering an empty page at build time.
export const dynamic = "force-dynamic";

// A listing page is the thing that actually gets shared and indexed, so its
// title and description come from the listing rather than from the site.
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const listing = await readListing((await params).id);
  if (!listing) return { title: "Not found" };
  return {
    title: listing.title,
    description: listing.summary ?? undefined,
    openGraph: {
      title: listing.title,
      description: listing.summary ?? undefined,
    },
  };
}

export default async function ListingPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const listing = await readListing((await params).id);
  // An unapproved listing is invisible to the read policy, so this covers both
  // "does not exist" and "not approved yet" without leaking which it is.
  if (!listing) notFound();

  const href = safeUrl(listing.url);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-12">
      <Link className="text-sm text-muted hover:text-foreground" href="/">
        Back to everything
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-3xl font-medium tracking-tight">
            {listing.title}
          </h1>
          {listing.featured ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
              Featured
            </span>
          ) : null}
        </div>
        {listing.category ? (
          <Link
            className="w-fit rounded-full border border-line px-3 py-1 text-sm text-muted hover:bg-surface"
            href={`/?category=${encodeURIComponent(listing.category)}`}
          >
            {listing.category}
          </Link>
        ) : null}
      </header>

      {listing.summary ? (
        <p className="text-base leading-7 whitespace-pre-line">
          {listing.summary}
        </p>
      ) : null}

      {href ? (
        <a
          className="flex h-12 w-fit items-center rounded-lg bg-accent px-6 text-sm font-medium text-accent-ink"
          href={href}
          rel="noopener noreferrer nofollow"
          target="_blank"
        >
          Visit {hostOf(listing.url)}
        </a>
      ) : null}
    </main>
  );
}
