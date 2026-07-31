<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A link in bio page that can sell, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the public page: photo, name, tagline, bio, links, and a shop section
  that appears on its own once there are products to sell.
- `/admin` is the editor: profile, accent color, photo upload, and links you can
  add, reorder, hide and delete.
- The schema exists, and so does a public `avatars` storage bucket.

Nothing here is hardcoded copy. The owner fills the page in from `/admin`, so
the first thing to tell them is to open it and claim the page.

## The shop is free and already wired

Product cards read `payments.plans()` and render nothing when payments are not
set up, so a page with no shop is just a page. When the owner adds a product in
Finance, it appears. Buying opens a real checkout with tax handled, and the
platform receives the payment event.

The one rule: a buyer must be signed in before checkout, because a payment that
cannot be attached to an account can never be matched back to them. The card
handles this by making sign-in its own visible step rather than something
queued behind a redirect.

## Files you must not rewrite

Four files are regenerated on every build turn. Editing them is wasted work,
because the next turn overwrites what you wrote.

| File | Why it is generated |
| --- | --- |
| `lib/backend.ts` | Carries this workspace's analytics and support ids |
| `components/analytics.tsx` | Mounted in the root layout, starts pageview tracking |
| `.env.local` | Backend URL and keys, rotated outside this tree |
| `RESULT.md` | The backend reference, updated when the platform is |

Import the browser client from `@/lib/backend`. Never call `createClient`
yourself and never hand-roll HTTP against the backend.

## Read data in the browser, not on the server

A server component that awaits a backend read is **prerendered at build time**,
when there is no database to reach and nobody has set the page up yet. The
result is a page that ships empty and stays empty, with no error anywhere. This
was measured on this exact Next version, not assumed.

So every read here happens in a client component. If you do want a page rendered
on the server for search engines, add `export const dynamic = "force-dynamic"`
to it, which is checked and does work. Moving the read without that line is the
bug above.

## The two rules this template is built on

**1. The owner is one row in `site`.** Anyone with a Google account can sign in
to a public app, so "signed in" is not "the owner". `site` holds exactly one row
(a check constraint and a unique index make a second impossible), its `user_id`
defaults to the session so it cannot be forged, and it doubles as the profile.
`components/owner-gate.tsx` is the gate.

**2. Authorization lives in the database.** `links` is readable by anyone when
`published` is true and writable only by the owner, both as policies. The editor
queries with no owner filter because the policy is what restricts it. Do not add
a second check in a component and do not drop a policy in favour of one.

Owner-only tables you add should follow the same shape:

```sql
create policy <table>_owner_read on public.<table> for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
```

## One look everywhere

This app is warm and light, and has ONE palette in `app/globals.css`. The accent
is the exception: the owner sets it from `/admin`, it is stored on the `site`
row, and `components/bio.tsx` applies it as a CSS variable at runtime. The value
in `globals.css` is only the fallback for the first render.

Never make how the app looks depend on the viewer's machine. No
`@media (prefers-color-scheme: ...)`, and no second set of colors behind it.
`dark:` utilities are gated on a `.dark` class that nothing adds, so they do
nothing on their own. Two palettes driven by an OS setting means the owner sees
one of them while your edits land in the other, and your work looks like it did
nothing.

## Schema changes

Use the CLI from bash, in the project root. It reads the backend URL and admin
key out of `.env.local` on its own, so there is nothing to log into.

```
npx @resultdev/cli db create-table posts -c "title:string:required" -c "body:string"
npx @resultdev/cli db migrate --name posts-policies --sql "create policy ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Modifiers are `required` and `unique`. A table with a
`user_id:uuid` column gets an owner policy automatically; a table without one
gets no policy at all, which denies every read and write until you add one.

Do not write migration files by hand and do not reach for another ORM or
database. This app already has one.

## What to build next

Usually in this order: a section of embeds (a video, a latest post), an email
capture card in the link list, and per-link click counts on the editor. Clicks
are already tracked as a `link_click` event, so the counts exist in Analytics
before you build anything.
