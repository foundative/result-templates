#!/usr/bin/env bash
# Schema for the digital-store template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the store AND the owner, in one row.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "store_name:string" \
  -c "tagline:string"

cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"

# ---------------------------------------------------------------------------
# product_files: which file a buyer gets for which product.
#
# The products themselves are NOT here. They live in Finance, and the store
# reads them with payments.plans(), so a price change never means a code change
# and a price id never gets hardcoded into an app that then breaks going live.
# This table only maps our plan slug to an object in the bucket.
#
# No policy at all, which denies everything. The storage path is the one thing
# in this app that must never reach a browser that has not paid.
# ---------------------------------------------------------------------------
cli db create-table product_files \
  -c "plan_slug:string:required:unique" \
  -c "storage_path:string:required" \
  -c "label:string"

# ---------------------------------------------------------------------------
# downloads: a PRIVATE bucket. Files are handed out as expiring signed links by
# /api/download, and only after the purchase has been checked. A public bucket
# here would mean one leaked URL is the product, forever.
# ---------------------------------------------------------------------------
cli storage create-bucket downloads --private
