#!/usr/bin/env bash
# Schema for the marketplace template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the directory AND the owner, in one row.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "name:string" \
  -c "tagline:string" \
  -c "categories:string"

cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"

# ---------------------------------------------------------------------------
# listings: the directory itself.
#
# ONE policy, and only for reading published rows. Every write goes through
# /api/listings.
#
# The submitter column is `submitter_id`, not `user_id`, on purpose. A `user_id`
# column would make create-table generate an owner policy letting a submitter
# UPDATE their own row, and `published` is a column on that row: anyone could
# approve their own listing and moderation would be decoration.
# ---------------------------------------------------------------------------
cli db create-table listings \
  -c "submitter_id:uuid" \
  -c "title:string:required" \
  -c "summary:string" \
  -c "url:string:required" \
  -c "category:string" \
  -c "contact_email:string" \
  -c "published:boolean" \
  -c "featured:boolean"

cli db migrate --name listings-defaults-and-read --sql "
alter table public.listings alter column published set default false;
alter table public.listings alter column published set not null;
alter table public.listings alter column featured set default false;
alter table public.listings alter column featured set not null;
create index if not exists listings_published_idx on public.listings (published, featured desc, created_at desc);
create policy listings_public_read on public.listings for select using (published);
"
