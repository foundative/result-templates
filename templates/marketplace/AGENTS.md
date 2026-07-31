<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A directory, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the directory: search, category filter, featured first.
- `/l/[id]` is one listing, with its own title and link preview.
- `/submit` takes submissions from anyone who signs in. They arrive unapproved.
- `/admin` is the queue: approve, feature, delete, plus the directory's name and
  its list of categories.
- The schema exists. `site` and `listings` were created when this project was.

## This is the one template that renders on the server

Every other template reads data in the browser, because a server component that
awaits a backend read gets **prerendered at build time**, when there is no
database, and ships empty forever.

A directory is different: one nobody can find in a search engine is not worth
running. So `/` and `/l/[id]` are server components with:

```ts
export const dynamic = "force-dynamic";
```

That line is load-bearing. Delete it and the page silently goes back to being
built once, empty, at build time. Both were checked on this exact Next version.

They read through `backend` (the ordinary anon-key client), **not** `admin()`.
That keeps the `listings_public_read` policy in force, so an unapproved listing
cannot leak out of a page even if a filter is forgotten.

## Moderation only works because writes go through the route

`listings` has exactly one policy: anyone may READ rows where `published` is
true. There is no insert or update policy at all, and `/api/listings` is the
only door.

The trap to avoid: giving the table a `user_id` column so `create-table`
generates its owner policy and submitters can manage their own rows from the
browser. `published` is a column on that row, so a submitter could set it and
approve themselves. The column is `submitter_id` for exactly that reason, and
the route never reads `published` from the request when creating a listing.

## Files you must not rewrite

Four files are regenerated on every build turn. Editing them is wasted work,
because the next turn overwrites what you wrote.

| File | Why it is generated |
| --- | --- |
| `lib/backend.ts` | Carries this workspace's analytics and support ids |
| `components/analytics.tsx` | Mounted in the root layout, starts pageview tracking |
| `.env.local` | Backend URL and keys, rotated outside this tree |
| `RESULT.md` | The backend reference, updated when the platform is |

`lib/admin.ts` bypasses row-level security and belongs only in route handlers.

## The owner is one row in `site`

Anyone with a Google account can sign in to an app on the open internet, so
"signed in" is not "the owner". `site` holds exactly one row (a check constraint
and a unique index make a second impossible) and its `user_id` defaults to the
session. `components/owner-gate.tsx` is the gate, and `isOwner` in
`lib/caller.ts` is the same check on the server.

## One look everywhere

This app is light and has ONE palette, in `app/globals.css`. Change a color
there and it changes for everyone.

Never make how the app looks depend on the viewer's machine. No
`@media (prefers-color-scheme: ...)`, and no second set of colors behind it.
`dark:` utilities are gated on a `.dark` class that nothing adds.

## Schema changes

```
npx @resultdev/cli db create-table reviews -c "listing_id:uuid" -c "body:string"
npx @resultdev/cli db migrate --name reviews-read --sql "create policy ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Money is whole cents in an `integer`, never a float.

## Making money from it

The usual order, and all three are already possible:

1. **Paid featured placement.** Add a recurring product in Finance, check
   `payments.hasAccess()` when someone submits, and set `featured` for
   subscribers. `lib/caller.ts` already has the server-side pieces.
2. **Paid listings.** Same thing, one-time: `hasPurchased(slug)` rather than
   `hasAccess()`, because a purchase never expires and a subscription does.
3. **A submission fee.** Charge before the listing enters the queue.

## What to build next

Usually: a listing image (there is a storage bucket one CLI line away), an email
to the submitter when their listing goes live, and a sitemap so the pages that
render on the server actually get indexed.
