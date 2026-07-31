<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A waitlist, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the launch page. It collects an email, saves it, and sends a
  confirmation.
- `/admin` is the owner's side: who has signed up, and a copy-as-CSV button.
- The schema exists. `site` and `signups` were created when this project was.

## Change the copy first

Every word a visitor reads is in two files, deliberately:

- `app/page.tsx` has `BRAND`, `EYEBROW`, `HEADLINE`, `SUBHEAD` and `REASONS` at
  the top.
- `app/layout.tsx` has the page title and the link preview text, which is what
  people see before they ever visit.

Do that before anything else. The placeholder copy describes a shipping tool,
which is almost certainly not this business.

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

## The three rules this template is built on

Copy these when you add a feature. Breaking one of them is how an app leaks
data or stops accepting signups.

**1. A visitor cannot write to the database directly.** `signups` has row-level
security on and no policy for anonymous callers, so nothing on the page can
insert into it. Public submissions go to a route handler, which validates them
and writes with `admin()` from `lib/admin.ts`. Never import `lib/admin.ts` from
a component: it holds the key that bypasses row-level security.

**2. The owner is one row in `site`.** Anyone with a Google account can sign in
to a public app, so "signed in" is not "the owner". `site` holds exactly one row
(a check constraint and a unique index make a second impossible) and its
`user_id` is the owner. `components/owner-gate.tsx` is the gate; owner-only
tables use this policy:

```sql
create policy <table>_owner_read on public.<table> for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
```

**3. Authorization lives in the database, not in the page.** The admin page
queries `signups` with no filter, and that is safe because the policy above is
what restricts it. Do not add a second check in the component and do not remove
the policy in favour of one.

## One look everywhere

This app is dark and has ONE palette, in `app/globals.css`. Change a color there
and it changes for everyone. If the owner wants it light, change the six values
at the top and leave the structure alone.

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

In the order that usually matters: a referral position so someone moves up the
list by sharing, a second email when you launch (loop over `signups` with
`emails.send`), and a question or two on the form so you know who is waiting.
