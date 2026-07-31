#!/usr/bin/env bash
# Schema for the saas template. Runs once, when the project is created, after
# .env.local exists so the CLI can find its own credentials.
#
# ONE `db migrate` call, on purpose. The CLI stamps a migration version from the
# wall clock to the second, so two that run inside the same second collide and
# the second is rejected, failing the whole create intermittently.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# site: the product AND the owner, in one row.
cli db create-table site \
  -c "user_id:uuid" \
  -c "product_name:string" \
  -c "tagline:string" \
  -c "pitch:string"

# ---------------------------------------------------------------------------
# entries: the product itself. Rename this to whatever you actually sell.
#
# DELIBERATELY without any policy. Row-level security with no policy denies
# everything, and /api/entries is the only door.
#
# The column is `owner_id`, not `user_id`, and that is the whole point. A
# `user_id` column makes create-table generate a policy saying "your own rows",
# which sounds right and is not: it does not say "AND you are paying", so anyone
# who signs up would get the product for free straight from the browser.
# ---------------------------------------------------------------------------
cli db create-table entries \
  -c "owner_id:uuid" \
  -c "title:string:required" \
  -c "status:string" \
  -c "notes:string"

cli db migrate --name saas-schema --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);

alter table public.entries alter column status set default 'open';
alter table public.entries alter column status set not null;
create index if not exists entries_owner_idx on public.entries (owner_id);
"
