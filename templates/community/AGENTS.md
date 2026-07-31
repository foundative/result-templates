<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A paid community, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the public page: what the community is, what members get, and the
  price, read from Finance.
- `/feed` is members only: posts, replies, and pin and delete for the owner.
- `/admin` is the owner's settings.
- The schema exists. `site`, `posts` and `comments` were created when this
  project was.

Two things the owner has to do before anyone can join: claim the community at
`/admin`, and add a recurring product in Finance. The price appears on the page
on its own once it exists.

## The paywall is in the route, not the page

This is the most important thing in this template.

`posts` and `comments` have **no row-level policies at all**, which denies
everything. `/api/feed` is the only door. It reads the caller's own access
token, checks their subscription **as them**, and only then reads with the admin
key. `lib/caller.ts` is where that happens.

Why not a database policy, which is how the other templates do it: the question
is "do they have a live subscription", and `billing_subscriptions` does not
exist until payments are set up, which happens long after `.result/setup.sh`
ran. A policy written against a table that is not there yet cannot be created,
and one added later would never reach projects created before it.

Two rules follow, and breaking either one gives the content away:

1. **Never add a read policy to `posts` or `comments`** to "simplify" the feed.
   That makes every post readable by anyone who signs in, paid or not.
2. **Never trust a user id from the request body.** Identity comes from the
   bearer token, verified in `resolveCaller`. A body field would let anyone read
   anyone's feed by typing a different one.

The owner always has access without paying. They did not buy their own
community.

## Membership is a subscription, and it expires

`subscriptionGrantsAccess` from the SDK is the one rule, applied on the server
here and in the browser on the landing page:

- A failed renewal (`past_due`) still counts. Recovery usually works, and
  cutting someone off on the first failure loses subscriptions that would have
  survived.
- A cancellation scheduled for next month does not take effect today.

If you add anything sold **once** rather than monthly, use `hasPurchased(slug)`
instead. A purchase never expires; a subscription does.

## The feed polls, it does not stream

`components/feed.tsx` refetches every 15 seconds, and only while the tab is
visible. On a feed this size that is indistinguishable from live and costs no
connection to hold open. If you want it live, `backend.realtime` is available;
publish from the client after a post lands and refetch on the other end.

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
row-level security and belongs only in route handlers, never in a component.

## Read data in the browser, not on the server

A server component that awaits a backend read is **prerendered at build time**,
when there is no database to reach. The page ships empty and stays empty, with
no error anywhere. This was measured on this exact Next version, not assumed.
If you want a page rendered on the server, add
`export const dynamic = "force-dynamic"` to it, which is checked and does work.

## The owner is one row in `site`

Anyone with a Google account can sign in to an app on the open internet, so
"signed in" is not "the owner". `site` holds exactly one row (a check constraint
and a unique index make a second impossible) and its `user_id` defaults to the
session. `components/owner-gate.tsx` is the gate.

## One look everywhere

This app is dark and has ONE palette, in `app/globals.css`. Change a color there
and it changes for everyone.

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
npx @resultdev/cli db create-table lessons -c "title:string:required"
npx @resultdev/cli db migrate --name lessons-index --sql "create index ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Note that an author column here is `author_id`, not
`user_id`: a `user_id` column makes `create-table` generate an owner policy that
scopes every row to whoever wrote it, which is the opposite of a shared feed.

## What to build next

Usually in this order: a course section with lessons gated the same way, a
leaderboard from post and comment counts (the thing Skool actually sells), and
a welcome email when a subscription starts.
