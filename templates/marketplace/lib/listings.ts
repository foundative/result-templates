import { backend } from "@/lib/backend";

// Reading the directory.
//
// These run on the SERVER, from pages that declare
// `export const dynamic = "force-dynamic"`. That line is not optional: without
// it Next prerenders the page at build time, when there is no database to read,
// and ships an empty directory forever with no error anywhere.
//
// They use `backend`, the ordinary anon-key client, NOT the admin one. So the
// `listings_public_read` policy still applies and an unapproved listing cannot
// leak out of here even if a filter is forgotten. A directory is the one
// template where pages have to be rendered on the server, because a directory
// nobody can find in a search engine is not worth running.

export type Listing = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  category: string | null;
  featured: boolean;
  created_at: string;
};

export type Site = {
  user_id: string | null;
  name: string | null;
  tagline: string | null;
  categories: string | null;
};

const COLUMNS = "id,title,summary,url,category,featured,created_at";

export async function readSite(): Promise<Site | null> {
  const { data } = await backend.database
    .from("site")
    .select("user_id,name,tagline,categories")
    .limit(1);
  return (data as Site[] | null)?.[0] ?? null;
}

export async function searchListings(options: {
  query?: string;
  category?: string;
}): Promise<Listing[]> {
  let request = backend.database.from("listings").select(COLUMNS);

  if (options.category) {
    request = request.eq("category", options.category);
  }
  if (options.query) {
    // `%` and `,` are both meaningful to PostgREST's filter syntax, so they are
    // stripped rather than passed through as a search someone typed.
    const safe = options.query.replace(/[%,()]/g, " ").trim();
    if (safe) request = request.ilike("title", `%${safe}%`);
  }

  const { data } = await request
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as Listing[] | null) ?? [];
}

export async function readListing(id: string): Promise<Listing | null> {
  // No published filter: the policy is what enforces that, and repeating it
  // here would suggest the policy is optional.
  const { data } = await backend.database
    .from("listings")
    .select(COLUMNS)
    .eq("id", id)
    .limit(1);
  return (data as Listing[] | null)?.[0] ?? null;
}

/** The owner writes one per line in /admin. Empty means no filter bar. */
export function parseCategories(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);
}

/** A link the browser will actually follow, or null. */
export function safeUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    return ["http:", "https:"].includes(parsed.protocol)
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

/** "https://acme.com/pricing" reads as "acme.com" in a list. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
