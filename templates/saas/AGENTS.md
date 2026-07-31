<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A subscription product, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` sells it: headline, three features, and pricing read from Finance.
- `/app` is the product, behind the paywall.
- `/account` is billing from the customer's side: plan, invoices, cancel.
- `/admin` is the owner's copy settings.
- The schema exists. `site` and `entries` were created when this project was.

The owner has to do two things: claim the site at `/admin`, and add a recurring
product in Finance. The pricing section fills itself in after that.

## `entries` is a placeholder. Rename it.

It is a three-column board so the template ships something that works, not
because a board is the product. Whatever this business actually sells, rename
the table and the route to match, and keep the rules below.

## The paywall is in the route, not the page

`entries` has **no row-level policies at all**, which denies everything.
`/api/entries` is the only door, and every call proves two things first: who is
asking (their own access token, never an id in the body) and whether they are
paying (`canRead` in `lib/caller.ts`).

The shortcut to avoid: giving the table a `user_id` column so `create-table`
generates its owner policy and the browser can query it directly. That policy
says "your own rows". It does not say "your own rows AND you are paying", so
everyone who signs up gets the product for free. The column here is `owner_id`
for exactly that reason, and the route filters on it by hand.

Two rules follow:

1. **Never add a read policy to a paywalled table.**
2. **Always filter by `owner_id` in the route.** There is no policy doing it, so
   a missing filter shows every customer everyone else's data.

## Subscriptions expire, purchases do not

`hasAccess()` is the check for anything sold monthly, and it already encodes two
rules worth keeping: a failed renewal (`past_due`) still counts, because
recovery usually works, and a cancellation scheduled for next month does not
take effect today.

If you add something sold **once**, a lifetime deal or a one-off add-on, use
`hasPurchased(slug)` instead.

## Files you must not rewrite

Four files are regenerated on every build turn. Editing them is wasted work,
because the next turn overwrites what you wrote.

| File | Why it is generated |
| --- | --- |
| `lib/backend.ts` | Carries this workspace's analytics and support ids |
| `components/analytics.tsx` | Mounted in the root layout, starts pageview tracking |
| `.env.local` | Backend URL and keys, rotated outside this tree |
| `RESULT.md` | The backend reference, updated when the platform is |

Import the browser client from `@/lib/backend`. `lib/admin.ts` bypasses
row-level security and belongs only in route handlers.

## Read data in the browser, not on the server

A server component that awaits a backend read is **prerendered at build time**,
when there is no database to reach. The page ships empty and stays empty, with
no error anywhere. This was measured on this exact Next version, not assumed.
If you want a page rendered on the server for search engines, add
`export const dynamic = "force-dynamic"` to it, which is checked and does work.

## The owner is one row in `site`

Anyone with a Google account can sign in to an app on the open internet, so
"signed in" is not "the owner". `site` holds exactly one row (a check constraint
and a unique index make a second impossible) and its `user_id` defaults to the
session. `components/owner-gate.tsx` is the gate.

## One look everywhere

This app is light and near-monochrome, with ONE palette in `app/globals.css`.
The single blue is reserved for focus, so the only colored thing on screen is
what the keyboard is pointing at.

Never make how the app looks depend on the viewer's machine. No
`@media (prefers-color-scheme: ...)`, and no second set of colors behind it.
`dark:` utilities are gated on a `.dark` class that nothing adds, so they do
nothing on their own.

## Schema changes

Use the CLI from bash, in the project root. It reads the backend URL and admin
key out of `.env.local` on its own.

```
npx @resultdev/cli db create-table projects -c "owner_id:uuid" -c "name:string:required"
npx @resultdev/cli db migrate --name projects-index --sql "create index ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Money is whole cents in an `integer`, never a float.

## What to build next

Usually in this order: a free tier with a usage cap (count rows in the route
before inserting), a second plan with more of that cap, and an email when
somebody's payment fails.
