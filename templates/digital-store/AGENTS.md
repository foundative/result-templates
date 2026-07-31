<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A digital product shop, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What is already working

- `/` is the shop, `/p/[slug]` is one product, both priced from Finance.
- `/library` is what a buyer owns, with a download button that works forever.
- `/admin` attaches a file to each product.
- The schema exists, and so does a PRIVATE `downloads` bucket.

Two things the owner has to do: claim the shop at `/admin`, and add a product in
Finance. Then attach the file it delivers.

## Digital goods only. This is not negotiable.

The payment provider behind this does not allow physical products, and an
account that sells one gets shut down. Files, licences, tickets and access are
fine. Anything that ships in a box is not, and no amount of code changes that.

If the owner wants to sell something physical, they need a different payment
route entirely. Say so plainly rather than building a cart that cannot take
money.

## Delivery is granted by the payment, never by the page

This is the rule everything here is built on.

A buyer can close the tab before the payment finishes, and a thank-you URL is a
URL anyone can type. So `successUrl` only decides where somebody LANDS. What
they own comes from `billing_purchases`, a table in this app's own database that
the platform's webhook receiver writes when the payment event actually arrives.

`lib/purchases.ts` is the only place that reads it. Two details in there matter:

- **Renewals are filtered out.** A subscription rebill fires the same event and
  lands in the same table with `subscription_id` set. A library is what someone
  bought, not a list of receipts.
- **Both `completed` and `paid` count.** One sale emits both and the order is
  not guaranteed, so waiting for `completed` alone would hold a download back
  for the gap between them.

## The download path, in order

`/api/download` does three things and the order is the security model:

1. Who is asking, from their own access token. Never an id in the body.
2. Did they pay for THIS product, from `billing_purchases`.
3. Only then, look up the file and sign a link that expires in five minutes.

The bucket is **private** and `product_files` has **no policy at all**, so the
storage path never reaches a browser. A public bucket here would mean one
leaked URL is the product, forever.

That has a consequence worth stating, because getting it wrong breaks the whole
template silently: **the admin page cannot query `product_files` either.** No
policy means no policy for anybody, the owner included. Attaching a file goes
through `/api/files`, which checks ownership and then writes with the admin key.
A browser-side insert there looks reasonable, is rejected, and leaves every
product showing "no file attached" while the uploads pile up in the bucket.

## Products live in Finance, not in a table here

`payments.plans()` is the catalogue. Do not build a `products` table: a price id
differs between test and live, so a hardcoded one works in test and 404s on the
first real sale. `product_files` maps a plan slug to a file and nothing else.

Prices are read in the **browser** on purpose. There, `plans()` comes back
localized, with the right currency and the right tax for wherever the visitor
is. That is what being a merchant of record buys you, and rendering the price on
the server throws it away.

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
session. `components/owner-gate.tsx` is the gate.

## One look everywhere

This app is light and has ONE palette, in `app/globals.css`. Change a color
there and it changes for everyone.

Never make how the app looks depend on the viewer's machine. No
`@media (prefers-color-scheme: ...)`, and no second set of colors behind it.

## Schema changes

```
npx @resultdev/cli db create-table reviews -c "plan_slug:string" -c "body:string"
npx @resultdev/cli db migrate --name reviews-read --sql "create policy ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Money is whole cents in an `integer`, never a float.

## What to build next

Usually in this order: an email with the download link when a sale lands, a
free sample of each product, and a bundle (a plan whose file is a zip, or one
that unlocks several).
