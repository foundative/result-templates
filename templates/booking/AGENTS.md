<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A booking page, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the booking flow: pick a service, pick a time, leave your details. It
  emails the customer and the owner.
- `/admin` is the owner's side: upcoming bookings, services, opening hours, and
  the business details.
- The schema exists. `site`, `services`, `availability` and `bookings` were
  created when this project was.

Tell the owner to open `/admin`, claim the page, set their hours, and add one
service. Nothing is bookable until there are hours and a service.

## Time is the hard part, and it is already solved

`lib/schedule.ts` is the whole answer. Read it before touching anything that
involves a clock.

- Availability is stored as **weekday plus minutes past midnight**, in the
  business's own time zone, which lives on the `site` row.
- A booking is stored as an **absolute instant**.
- `zonedInstant()` converts between them using `Intl`, so daylight saving is
  handled without a dependency.

Storing "9am" and hoping is what moves every appointment by an hour twice a
year. Do not simplify this by dropping the time zone.

## Two rules that keep bookings honest

**1. The slot is rechecked on the server, immediately before the insert.** Two
people can open the page at the same second and see the same free slot. The
browser's opinion of what is free is a guess by the time it arrives. See
`app/api/book/route.ts`.

**2. The requested time has to be one the business actually offers.** A booking
request is a public endpoint, so it is not enough to check that a slot is free:
`3am on Sunday` is free too. The route rebuilds the day's real slots and
requires an exact match.

## Why `/api/slots` exists

Row-level security is per row, not per column. `bookings` holds names and email
addresses, so there is no policy that lets a visitor see which times are taken
without also showing them who took them. The page never reads that table. It
asks `/api/slots`, which answers with times and nothing else.

Any new "is this taken" question belongs in that route, not in a new policy.

## Files you must not rewrite

Four files are regenerated on every build turn. Editing them is wasted work,
because the next turn overwrites what you wrote.

| File | Why it is generated |
| --- | --- |
| `lib/backend.ts` | Carries this workspace's analytics and support ids |
| `components/analytics.tsx` | Mounted in the root layout, starts pageview tracking |
| `.env.local` | Backend URL and keys, rotated outside this tree |
| `RESULT.md` | The backend reference, updated when the platform is |

Import the browser client from `@/lib/backend`. `lib/admin.ts` is the
server-only client that bypasses row-level security: it belongs in route
handlers and must never be imported from a component.

## Read data in the browser, not on the server

A server component that awaits a backend read is **prerendered at build time**,
when there is no database to reach and nothing has been set up. The page ships
empty and stays empty, with no error anywhere. This was measured on this exact
Next version, not assumed.

If you do want a page rendered on the server for search engines, add
`export const dynamic = "force-dynamic"` to it, which is checked and does work.
Moving a read without that line is the bug above.

## The owner is one row in `site`

Anyone with a Google account can sign in to an app on the open internet, so
"signed in" is not "the owner". `site` holds exactly one row (a check constraint
and a unique index make a second impossible) and its `user_id` defaults to the
session, so the claim cannot be forged. `components/owner-gate.tsx` is the gate.
Owner-only tables use:

```sql
create policy <table>_owner_read on public.<table> for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
```

## One look everywhere

This app is light and has ONE palette, in `app/globals.css`. Change a color
there and it changes for everyone.

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
`json` and `uuid`. Modifiers are `required` and `unique`. Money is stored as
whole cents in an `integer`, never a float.

## What to build next

Usually in this order: a cancel or reschedule link in the confirmation email, a
buffer between appointments, blocked-out dates for holidays, and a deposit at
booking time (`payments.checkout` with the service as a plan).
