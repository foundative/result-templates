#!/usr/bin/env bash
# Schema for the community template. Runs once, when the project is created,
# after .env.local exists so the CLI can find its own credentials.
set -euo pipefail

cli() { npx --yes @resultdev/cli "$@"; }

# ---------------------------------------------------------------------------
# site: the community AND the owner, in one row.
#
# Anyone with a Google account can sign in to an app on the open internet, so
# "signed in" is not "the owner". The owner is whoever holds this row.
# ---------------------------------------------------------------------------
cli db create-table site \
  -c "user_id:uuid" \
  -c "name:string" \
  -c "tagline:string" \
  -c "promise:string" \
  -c "plan_slug:string"

cli db migrate --name site-single-row --sql "
alter table public.site add column if not exists lock boolean not null default true;
alter table public.site add constraint site_one_row check (lock);
create unique index if not exists site_one_row_idx on public.site (lock);
create policy site_public_read on public.site for select using (true);
"

# ---------------------------------------------------------------------------
# posts and comments: members only, and DELIBERATELY without any policy.
#
# Row-level security with no policy denies everything, which is exactly right
# here. The question "may this person read the feed" is "do they have a live
# subscription", and a policy cannot ask that: billing_subscriptions does not
# exist until payments are set up, which happens long after this script runs.
#
# So /api/feed is the only door. It verifies the caller's own access token,
# checks their subscription as them, and only then reads with the admin key.
#
# The author column is `author_id`, not `user_id`, on purpose: a `user_id`
# column would make create-table generate an owner policy that scopes every row
# to the person who wrote it, which is the opposite of a shared feed.
# ---------------------------------------------------------------------------
cli db create-table posts \
  -c "author_id:uuid" \
  -c "author_name:string" \
  -c "title:string:required" \
  -c "body:string" \
  -c "pinned:boolean"

cli db migrate --name posts-defaults --sql "
alter table public.posts alter column pinned set default false;
alter table public.posts alter column pinned set not null;
create index if not exists posts_created_at_idx on public.posts (created_at desc);
"

cli db create-table comments \
  -c "post_id:uuid" \
  -c "author_id:uuid" \
  -c "author_name:string" \
  -c "body:string:required"

cli db migrate --name comments-index --sql "
create index if not exists comments_post_id_idx on public.comments (post_id);
"
