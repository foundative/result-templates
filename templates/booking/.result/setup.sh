#!/usr/bin/env bash
# Schema for the booking template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
#
# ONE `db migrate` call, on purpose. The CLI stamps a migration version from the
# wall clock to the second, so two that run inside the same second collide and
# the second is rejected with "must be newer than the latest applied migration",
# failing the whole create. This template had four and hit it.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the business AND the owner, in one row.
#
# time_zone is load-bearing, not decoration. Availability is written in the
# business's local time ("I open at nine") and a booking is an absolute moment,
# so without the zone every appointment moves by an hour twice a year.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "business_name:string" \
  -c "tagline:string" \
  -c "time_zone:string" \
  -c "notify_email:string"

# services: what can be booked. Public, because the page lists them.
cli db create-table services \
  -c "user_id:uuid" \
  -c "name:string:required" \
  -c "minutes:integer" \
  -c "price_cents:integer" \
  -c "published:boolean"

# availability: which hours the business is open, per weekday. Public read,
# because the page has to draw them, and there is nothing private in it: it is
# the same information as a sign on the door.
cli db create-table availability \
  -c "user_id:uuid" \
  -c "weekday:integer" \
  -c "start_minute:integer" \
  -c "end_minute:integer"

# bookings: names, emails and notes. NO public policy in either direction.
#
# Row-level security is per row, not per column, so there is no policy that
# would let a visitor see which slots are taken without also showing them who
# took them. The page never reads this table: /api/slots answers "what is free"
# with the admin key and returns times only.
cli db create-table bookings \
  -c "service_id:uuid" \
  -c "starts_at:datetime:required" \
  -c "minutes:integer" \
  -c "name:string:required" \
  -c "email:string:required" \
  -c "note:string"

cli db migrate --name booking-schema --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);

alter table public.services alter column minutes set default 30;
alter table public.services alter column minutes set not null;
alter table public.services alter column published set default true;
alter table public.services alter column published set not null;

-- The generated owner policy says 'your own rows', which sounds right and is
-- not enough here. This page is on the open internet, so anyone with a Google
-- account can sign in, insert THEIR own service, and have it published. The
-- read policies are not scoped by user (they cannot be: visitors are
-- anonymous), so a stranger's service would appear on the owner's booking page
-- and take real appointments, and stranger availability would open hours on a
-- calendar nobody agreed to. Writes are restricted to the site owner instead.
drop policy if exists \"services_owner\" on public.services;
create policy services_owner on public.services for all to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()))
  with check (exists (select 1 from public.site where site.user_id = auth.uid()));
create policy services_public_read on public.services for select using (published);

alter table public.availability alter column weekday set not null;
alter table public.availability alter column start_minute set not null;
alter table public.availability alter column end_minute set not null;
drop policy if exists \"availability_owner\" on public.availability;
create policy availability_owner on public.availability for all to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()))
  with check (exists (select 1 from public.site where site.user_id = auth.uid()));
create policy availability_public_read on public.availability for select using (true);

alter table public.bookings alter column minutes set default 30;
alter table public.bookings alter column minutes set not null;
create index if not exists bookings_starts_at_idx on public.bookings (starts_at);
create policy bookings_owner_read on public.bookings for select to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));
create policy bookings_owner_write on public.bookings for delete to authenticated
  using (exists (select 1 from public.site where site.user_id = auth.uid()));

-- The double-booking guarantee, and it has to live HERE rather than in the
-- route. The route checks a slot is free and then inserts, and those are two
-- statements: two requests a millisecond apart both see a free slot and both
-- write. No amount of care in application code closes that, only the database
-- can.
--
-- Wrapped in a fallback because the constraint needs the btree_gist extension
-- and a backend that will not install it must not fail project creation. The
-- unique index it falls back to is narrower (identical start times only, not
-- overlaps) but it is always available, and identical starts are what the race
-- actually produces: slots are discrete.
do \$\$
begin
  begin
    create extension if not exists btree_gist;
    alter table public.bookings add constraint bookings_no_overlap
      exclude using gist (
        tstzrange(starts_at, starts_at + make_interval(mins => minutes)) with &&
      );
  exception when others then
    create unique index if not exists bookings_one_per_start
      on public.bookings (starts_at);
  end;
end \$\$;
"
