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
executable `.result/setup.sh`, run once after the project is created with the
`result` CLI already authenticated:

```sh
#!/usr/bin/env bash
set -euo pipefail

result db create-table products \
  -c "name:string:required" \
  -c "price_cents:int:required" \
  --no-rls
```

`blank` ships none. Keep it that way: a blank app should add nothing to a
user's database that they did not ask for.

## Rules

1. **No vendor names.** The backend is "Result Backend". CI greps for the
   vendor name and fails the build.
2. **No em-dashes** in anything a user reads.
3. **Commit the lockfile.** The builder runs `npm ci`, which needs one.
4. **Keep it lean.** Every dependency is install time a user waits through on
   their first screen.
