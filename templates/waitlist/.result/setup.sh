#!/usr/bin/env bash
# Schema for the waitlist template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: who owns this app.
#
# Anyone with a Google account can sign in to an app on the open internet, so
# "signed in" is not "the owner". This table holds exactly ONE row, and its
# user_id is the owner. Every owner-only policy below is written against it.
#
# create-table gives it the standard owner policy for free: reads and writes
# scoped to the signed-in user, with user_id defaulting to the session, so the
# claim cannot be forged from the client.
# ---------------------------------------------------------------------------
cli db create-table site -c "user_id:uuid"

# The lock column plus the unique index is what makes "exactly one row" a
# database rule rather than a promise. Without it a second person could sign in,
# insert their own row, and become an owner too.
#
# The public read is deliberate: the sign-in screen has to know whether this app
# has been claimed before anyone signs in.
cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"

# ---------------------------------------------------------------------------
# signups: the list itself.
#
# No user_id, so create-table leaves it with row-level security on and no
# policies, which denies everything. That is the correct starting point for a
# table full of other people's email addresses: visitors write through
# /api/signup with the admin key, and the one policy below lets the owner read.
# ---------------------------------------------------------------------------
cli db create-table signups \
  -c "email:string:required:unique" \
  -c "source:string"

cli db migrate --name signups-owner-read --sql "
create policy signups_owner_read on public.signups for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
"
