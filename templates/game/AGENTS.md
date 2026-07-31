<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# A browser game with a leaderboard, running on Result

The backend is already provisioned. Postgres, auth, file storage, email,
realtime and AI are live before you write a line. There are no keys to ask the
user for and no backend to choose.

`RESULT.md` in this directory is the full backend reference. Read it before
writing anything that touches data, sign-in or uploads.

## What this is for

A game is not a business. This template is a **marketing asset**: something
worth sharing that ends on the owner's call to action, with a leaderboard that
gives people a reason to come back and send it to a friend.

So the button under the leaderboard is the point. `/admin` sets its label and
where it goes. A version of this page without one is a toy.

`game_over` and `game_cta_click` are already tracked, so how many people played,
how far they got, and how many clicked through show up in Analytics with nothing
else to build.

## What is already working

- `/` is the game, the leaderboard, and the call to action.
- `/admin` is branding (headline, accent, button) and leaderboard moderation.
- The schema exists. `site` and `scores` were created when this project was.

## The game itself

`components/game.tsx` is one file, no engine, no dependency. Two things in it
are load-bearing and easy to break:

1. **The world lives in a ref, not in state.** Re-rendering React sixty times a
   second is the slowest possible way to run a game. The canvas is drawn
   imperatively; React only hears about the score and the game ending.
2. **The frame delta is clamped.** A backgrounded tab hands back a delta of
   several seconds, and without the clamp the bird teleports through a pipe on
   the first frame after you come back.

The playfield is a fixed 360x560 and the canvas is scaled to fit, so the game
plays the same on a phone and a monitor rather than being easier on a big
screen. Keep that if you change the layout.

To make it a different game, replace the physics in the `step` function and the
`draw` below it. The leaderboard, the route and the branding do not care what
the game is.

## Scores can be faked, and that is a decision

The game runs on the player's machine, so anyone determined can send a number
they did not earn. Nothing short of running the simulation on the server changes
that, and for a marketing toy it is not worth building.

What `/api/score` does stop is the cheap version: it clamps to a plausible
maximum and rate limits by address, so a one-line fetch cannot write 999999999
and ruin the board. `scores` has a public read policy (a leaderboard nobody can
see is not a leaderboard) and no public insert policy.

If the score ever needs to be trustworthy, replay the inputs on the server and
score it there. Do not add a signature to the client: the client holds the key.

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

## The owner is one row in `site`

Anyone with a Google account can sign in to an app on the open internet, so
"signed in" is not "the owner". `site` holds exactly one row (a check constraint
and a unique index make a second impossible) and its `user_id` defaults to the
session. `components/owner-gate.tsx` is the gate.

## One look everywhere

This app is dark and has ONE palette, in `app/globals.css`. The accent is the
exception: the owner sets it from `/admin`, it is stored on the `site` row, and
it is applied at runtime as a CSS variable. It also paints the pipes.

Never make how the app looks depend on the viewer's machine. No
`@media (prefers-color-scheme: ...)`, and no second set of colors behind it.

## Schema changes

```
npx @resultdev/cli db create-table rounds -c "score:integer:required"
npx @resultdev/cli db migrate --name rounds-read --sql "create policy ..."
```

Column types are `string`, `integer`, `float`, `boolean`, `datetime`, `date`,
`json` and `uuid`.

## What to build next

Usually in this order: an email field on the leaderboard so a high score becomes
a lead, a weekly board that resets, and a share image with the player's score
baked in.
