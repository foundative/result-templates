#!/usr/bin/env bash
# Schema for the game template. Runs once, when the project is created, after
# .env.local exists so the CLI can find its own credentials.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the branding AND the owner, in one row.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "title:string" \
  -c "tagline:string" \
  -c "accent:string" \
  -c "cta_label:string" \
  -c "cta_url:string"

cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"

# ---------------------------------------------------------------------------
# scores: the leaderboard.
#
# Public READ, because a leaderboard nobody can see is not a leaderboard, and a
# row holds only a name somebody typed and a number.
#
# No public INSERT. Scores arrive through /api/score, which clamps them and
# rate limits by address. That does not make a score honest (nothing can: the
# game runs on the player's own machine) but it does stop a one-line fetch from
# writing 999999999 straight into the table.
# ---------------------------------------------------------------------------
cli db create-table scores \
  -c "name:string:required" \
  -c "score:integer:required"

cli db migrate --name scores-public-read --sql "
create index if not exists scores_score_idx on public.scores (score desc);
create policy scores_public_read on public.scores for select using (true);
create policy scores_owner_delete on public.scores for delete to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
"
