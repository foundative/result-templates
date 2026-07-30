<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# This app runs on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## Files you must not rewrite

Four files are regenerated on every build turn. Editing them is wasted work,
because the next turn overwrites what you wrote.

| File | Why it is generated |
| --- | --- |
| `lib/backend.ts` | Carries this workspace's analytics and support ids |
| `components/analytics.tsx` | Mounted in the root layout, starts pageview tracking |
| `.env.local` | Backend URL and keys, rotated outside this tree |
| `RESULT.md` | The backend reference, updated when the platform is |

Import the client from `@/lib/backend`. Never call `createClient` yourself and
never hand-roll HTTP against the backend.

## Everything else is yours

`app/`, `components/` (apart from `analytics.tsx`), `lib/` (apart from
`backend.ts`), styles, config and dependencies are all fair game. Replace
`app/page.tsx` entirely: it is a starting page, not a design to preserve.

`components/sign-in.tsx` is the one piece worth reading before you delete it.
It is the correct shape for auth in this app: `getCurrentUser()` on mount to
redeem the stored session, `onAuthStateChange()` in addition for later changes,
and three states so a reload never flashes the signed-out UI at a member.

## Schema changes

Use the `result` CLI. It is installed and authenticated.

```
result db create-table posts -c "title:string:required" -c "body:text"
result db migrate --name posts-policies --sql "create policy ..."
```

Do not write migration files by hand and do not reach for another ORM or
database. This app already has one.
