# Result templates

The starting points a new app is built from. When someone starts a project in
Result, the builder fetches one of these directories into their workspace and
the agent's first turn edits a real, working app.

`main` is live. A merge here reaches the next project created, with no deploy
of anything else.

## Layout

```
templates.json          the registry the picker reads
templates/<id>/         one template, one directory, id matches exactly
scripts/                registry validation
```

## Adding a template

1. Copy `templates/blank` to `templates/<your-id>`.
2. Build the app. Use `@resultdev/sdk` for data, auth and storage.
3. If it needs tables, add `.result/setup.sh` (see below).
4. Add an entry to `templates.json`.
5. Open a PR. CI installs, typechecks and builds every template.

Ids are lowercase words joined by hyphens, because the id is both a directory
name and a URL path segment.

## The rule that keeps templates working

**A template owns the app. The platform owns the seam.**

Four files are regenerated in the user's workspace on every build turn, so
whatever a template ships in them is overwritten:

| File | Owned by |
| --- | --- |
| `lib/backend.ts` | the platform (carries the workspace's analytics and support ids) |
| `components/analytics.tsx` | the platform |
| `.env.local` | the platform (keys, rotated outside the tree) |
| `RESULT.md` | the platform (the backend reference) |

A template still commits `lib/backend.ts` and `components/analytics.tsx`, but
only so its own CI can typecheck. Treat them as fixtures, not as code to
develop. Everything else in the directory is yours.

This is what lets a published SDK fix reach every app on every template without
touching this repo.

## Schema

There is no declarative schema file. A template that needs tables ships an
executable `.result/setup.sh`. It runs once, from the project root, after
`.env.local` is written, so the CLI resolves its own credentials:

```sh
#!/usr/bin/env bash
set -euo pipefail

npx --yes @resultdev/cli db create-table products \
  -c "name:string:required" \
  -c "price_cents:integer:required" \
  --no-rls
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`. Modifiers are `required` and `unique`. Anything else is
rejected, `int` included.

It runs exactly once, when the project is created. It is not a migration
system: a template that changes its schema later is a new template, or a change
existing users will not get.

### Who owns the app

Every template with an admin side has the same problem: anyone with a Google
account can sign in to an app on the open internet, so "signed in" is not "the
owner". The answer is one row.

```sh
cli db create-table site -c "user_id:uuid"
cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"
```

`create-table` gives `site` an owner policy whose `user_id` defaults to the
session, so the claim cannot be forged from the client. The check constraint and
the unique index are what make "exactly one row" a database rule rather than a
promise. Owner-only tables then read:

```sql
create policy <table>_owner_read on public.<table> for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
```

Copy `components/owner-gate.tsx` from `waitlist` for the UI side of this.

### Anonymous writes

A table anyone can insert into is a form anyone can point a script at. Public
submissions (signups, bookings, scores) go to a route handler that validates
them and writes with a server-only admin client, `lib/admin.ts`. The table keeps
row-level security on with no policy for anonymous callers.

`blank` ships none. Keep it that way: a blank app should add nothing to a
user's database that they did not ask for.

## Read data in the browser, not on the server

A server component that awaits a backend read is **prerendered at build time**,
when there is no database to reach. It ships whatever the build saw, which is
nothing, and there is no error anywhere. This was measured on Next 16.2, not
assumed.

So the default in every template is a client component that reads on mount. When
a page genuinely needs to be rendered on the server (a listing or product page
that has to be indexed), add `export const dynamic = "force-dynamic"` to it.
That is also checked and does work. Moving a read to the server without that
line is the bug above.

## Rules

1. **No vendor names.** The backend is "Result Backend". CI greps for the
   vendor name and fails the build.
2. **No em-dashes** in anything a user reads.
3. **Commit the lockfile.** The builder runs `npm ci`, which needs one.
4. **Keep it lean.** Every dependency is install time a user waits through on
   their first screen. Reordering is two buttons, not a drag library; icons are
   inline SVG, not a package.
5. **`npm run lint` passes.** Templates ship an eslint config, so a user running
   it should see nothing.

## Gotchas that have already cost time

- **A bulk insert needs matching keys.** Posting an array whose objects carry
  different fields fails with `PGRST102, All object keys must match`. Send one
  call per shape, or fill every key on every row.
- **`create-table` cannot express a default.** Add them in a follow-up
  `db migrate`. A nullable `boolean` used in a policy is worse than it looks:
  `using (published)` treats NULL as not-true, so a row hides for a reason
  nobody can see in the UI. Set `not null` with a default.
- **Column types are `string`, `integer`, `float`, `boolean`, `datetime`,
  `date`, `json`, `uuid`.** `int` and `text` are rejected.
- **`.result/` has to be ignored by contents, not by directory.** Use
  `.result/*` plus `!.result/setup.sh`, or git never descends into it and the
  setup script silently never reaches the tarball.
