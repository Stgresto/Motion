-- Motion UF — private planner data. Every row belongs to exactly one auth user.
-- Run in the Supabase SQL editor (or via the Supabase connector) for the Motion project.

create table if not exists public.planner_events (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  category    text not null default 'other',
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  recurrence  jsonb not null default '{"repeat":"none"}'::jsonb,
  location    text,
  notes       text,
  source      text not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists planner_events_user_idx on public.planner_events(user_id, date);

create table if not exists public.motion_state (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,   -- preferences, Motion sessions, completed cards
  updated_at  timestamptz not null default now()
);

alter table public.planner_events enable row level security;
alter table public.motion_state   enable row level security;
alter table public.planner_events force row level security;
alter table public.motion_state   force row level security;

-- planner_events: owner only
drop policy if exists "events_select_own" on public.planner_events;
drop policy if exists "events_insert_own" on public.planner_events;
drop policy if exists "events_update_own" on public.planner_events;
drop policy if exists "events_delete_own" on public.planner_events;
create policy "events_select_own" on public.planner_events for select to authenticated using (auth.uid() = user_id);
create policy "events_insert_own" on public.planner_events for insert to authenticated with check (auth.uid() = user_id);
create policy "events_update_own" on public.planner_events for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events_delete_own" on public.planner_events for delete to authenticated using (auth.uid() = user_id);

-- motion_state: owner only
drop policy if exists "state_select_own" on public.motion_state;
drop policy if exists "state_insert_own" on public.motion_state;
drop policy if exists "state_update_own" on public.motion_state;
drop policy if exists "state_delete_own" on public.motion_state;
create policy "state_select_own" on public.motion_state for select to authenticated using (auth.uid() = user_id);
create policy "state_insert_own" on public.motion_state for insert to authenticated with check (auth.uid() = user_id);
create policy "state_update_own" on public.motion_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "state_delete_own" on public.motion_state for delete to authenticated using (auth.uid() = user_id);

-- anon role gets nothing
revoke all on public.planner_events from anon;
revoke all on public.motion_state   from anon;
