#!/usr/bin/env bash
# Schema for the link-in-bio template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
#
# ONE `db migrate` call, on purpose. The CLI stamps a migration version from the
# wall clock to the second, so two migrations that run inside the same second
# collide and the second is rejected with "must be newer than the latest applied
# migration". That fails the whole create, intermittently. Tables first, then
# one migration for everything that alters them.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the profile AND the owner, in one row.
#
# They are the same row on purpose. This app has one page and one owner, so a
# separate profile table would only ever hold a single row keyed to the same
# person. Anyone with a Google account can sign in to an app on the open
# internet, so "signed in" is not "the owner": the owner is whoever holds this
# row, and every owner-only rule is written against it.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "display_name:string" \
  -c "tagline:string" \
  -c "bio:string" \
  -c "avatar_url:string" \
  -c "accent:string"

# ---------------------------------------------------------------------------
# links: what the page is for.
# ---------------------------------------------------------------------------
cli db create-table links \
  -c "user_id:uuid" \
  -c "label:string:required" \
  -c "url:string:required" \
  -c "position:integer" \
  -c "published:boolean"

# ---------------------------------------------------------------------------
# avatars: a public bucket, so the profile picture has a plain URL.
# Uploads still require a signed-in user, which means only the owner can write.
# ---------------------------------------------------------------------------
cli storage create-bucket avatars

cli db migrate --name link-in-bio-schema --sql "
-- Exactly one row, as a database rule rather than a promise. Without it a
-- second person could sign in, insert their own row, and become an owner too.
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);

-- The public read is the whole point of the app: a visitor has to see the
-- profile without signing in.
create policy site_public_read on public.site for select using (true);

-- Defaults are set here because create-table cannot express one. \`published\`
-- has to be NOT NULL for the read policy below to be readable: a policy of
-- \`using (published)\` treats NULL as 'not true', which would hide a link for a
-- reason nobody could see in the admin UI.
alter table public.links alter column position set default 0;
alter table public.links alter column position set not null;
alter table public.links alter column published set default true;
alter table public.links alter column published set not null;
create index if not exists links_position_idx on public.links (position);

-- The generated owner policy says 'your own rows', which sounds right and is
-- not enough here. This page is on the open internet, so anyone with a Google
-- account can sign in, insert THEIR own link, and have it published. The read
-- policy below is not scoped by user (it cannot be: visitors are anonymous), so
-- that stranger's link would appear on the owner's page. Graffiti with extra
-- steps. Writes are restricted to the person who holds the site row instead.
drop policy if exists \"links_owner\" on public.links;
create policy links_owner on public.links for all to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()))
  with check (exists (select 1 from public.site where site.user_id = auth.uid()));

create policy links_public_read on public.links for select using (published);
"
