import Link from "next/link";
import {
  hostOf,
  parseCategories,
  readSite,
  searchListings,
} from "@/lib/listings";

// Rendered on the server, on every request.
//
// This line is load-bearing. Without it Next prerenders the page at build time,
// when there is no database to read, and the directory ships empty and stays
// empty with no error anywhere. A directory that search engines cannot read is
// not worth running, which is why this page is not a client component like the
// rest of the app.
export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  readonly searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const [site, listings] = await Promise.all([
    readSite(),
    searchListings({ query: params.q, category: params.category }),
  ]);
  const categories = parseCategories(site?.categories);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
      <header className="flex flex-col gap-3 py-12">
        <div className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-medium tracking-tight">
              {site?.name?.trim() || "The directory"}
            </h1>
            {site?.tagline ? (
              <p className="text-base leading-7 text-muted">{site.tagline}</p>
            ) : null}
          </div>
          <Link
            className="shrink-0 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink"
            href="/submit"
          >
            Submit
          </Link>
        </div>

        <form action="/" className="flex gap-2 pt-2">
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-4 text-base outline-none transition-colors focus:border-accent sm:text-sm"
            defaultValue={params.q ?? ""}
            name="q"
            placeholder="Search"
            type="search"
          />
          {params.category ? (
            <input name="category" type="hidden" value={params.category} />
          ) : null}
          <button
            className="h-11 shrink-0 rounded-lg border border-line px-4 text-sm transition-colors hover:bg-surface"
            type="submit"
          >
            Go
          </button>
        </form>

        {categories.length > 0 ? (
          <nav className="flex flex-wrap gap-2 pt-1">
            <Chip active={!params.category} href="/">
              All
            </Chip>
            {categories.map((category) => (
              <Chip
                active={params.category === category}
                href={`/?category=${encodeURIComponent(category)}`}
                key={category}
              >
                {category}
              </Chip>
            ))}
          </nav>
        ) : null}
      </header>

      {listings.length === 0 ? (
        <p className="rounded-lg border border-line border-dashed px-6 py-16 text-center text-sm leading-6 text-muted">
          {params.q || params.category
            ? "Nothing matches that."
            : "Nothing listed yet. Submissions show up here once they are approved."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {listings.map((listing) => (
            <li key={listing.id}>
              <Link
                className="flex flex-col gap-1.5 py-5 transition-colors hover:bg-surface"
                href={`/l/${listing.id}`}
              >
                <div className="flex items-baseline gap-2.5">
                  <h2 className="text-base font-medium">{listing.title}</h2>
                  {listing.featured ? (
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                      Featured
                    </span>
                  ) : null}
                </div>
                {listing.summary ? (
                  <p className="text-sm leading-6 text-muted">
                    {listing.summary}
                  </p>
                ) : null}
                <p className="font-mono text-xs text-muted">
                  {hostOf(listing.url)}
                  {listing.category ? ` · ${listing.category}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <footer className="py-10 text-sm text-muted">
        <Link className="underline underline-offset-4" href="/admin">
          Admin
        </Link>
      </footer>
    </main>
  );
}

function Chip({
  active,
  children,
  href,
}: {
  readonly active: boolean;
  readonly children: React.ReactNode;
  readonly href: string;
}) {
  return (
    <Link
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line hover:bg-surface"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
