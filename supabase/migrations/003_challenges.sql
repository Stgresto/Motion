-- Motion UF — utmaningar med vänner (flest kort, längst streak, gemensamt mål).
-- Kräver 002_leaderboard.sql (visningsnamnet hämtas därifrån). Allt går via funktioner; klienten når inte tabellerna.

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  title      text not null check (char_length(title) between 2 and 40),
  kind       text not null check (kind in ('cards','streak')),
  start_date date not null,
  end_date   date not null check (end_date >= start_date and end_date <= start_date + 60),
  team_goal  int check (team_goal is null or team_goal between 1 and 100000),
  creator    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  cards        int not null default 0,
  streak       int not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenges        enable row level security;
alter table public.challenge_members enable row level security;
alter table public.challenges        force row level security;
alter table public.challenge_members force row level security;
revoke all on public.challenges, public.challenge_members from anon, authenticated;

create or replace function public.ch_create(p_title text, p_kind text, p_start date, p_end date, p_goal int)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid; c text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from leaderboard where user_id = me) then raise exception 'join leaderboard first'; end if;
  if (select count(*) from challenge_members m join challenges h on h.id = m.challenge_id where m.user_id = me and h.end_date >= current_date) >= 10 then raise exception 'too many'; end if;
  loop
    c := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 6);
    exit when not exists (select 1 from challenges where code = c);
  end loop;
  insert into challenges(code, title, kind, start_date, end_date, team_goal, creator)
  values (c, left(trim(p_title), 40), p_kind, p_start, p_end, p_goal, me) returning id into cid;
  insert into challenge_members(challenge_id, user_id) values (cid, me);
  return c;
end $$;

create or replace function public.ch_join(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from leaderboard where user_id = me) then raise exception 'join leaderboard first'; end if;
  select id into cid from challenges where code = upper(trim(p_code)) and end_date >= current_date;
  if cid is null then raise exception 'not found'; end if;
  if (select count(*) from challenge_members where challenge_id = cid) >= 20 then raise exception 'full'; end if;
  insert into challenge_members(challenge_id, user_id) values (cid, me) on conflict do nothing;
  return cid;
end $$;

create or replace function public.ch_list()
returns table(id uuid, code text, title text, kind text, start_date date, end_date date, team_goal int, members bigint, is_creator boolean)
language sql security definer set search_path = public as $$
  select h.id, h.code, h.title, h.kind, h.start_date, h.end_date, h.team_goal,
         (select count(*) from challenge_members x where x.challenge_id = h.id), h.creator = auth.uid()
  from challenges h join challenge_members m on m.challenge_id = h.id
  where auth.uid() is not null and m.user_id = auth.uid() and h.end_date >= current_date - 14
  order by h.end_date;
$$;

create or replace function public.ch_publish(p_id uuid, p_cards int, p_streak int)
returns void language plpgsql security definer set search_path = public as $$
begin
  update challenge_members set cards = greatest(0, least(p_cards, 100000)), streak = greatest(0, least(p_streak, 100)), updated_at = now()
  where challenge_id = p_id and user_id = auth.uid();
end $$;

create or replace function public.ch_board(p_id uuid)
returns table(display_name text, cards int, streak int, is_me boolean)
language sql security definer set search_path = public as $$
  select l.display_name, m.cards, m.streak, m.user_id = auth.uid()
  from challenge_members m join leaderboard l on l.user_id = m.user_id
  where auth.uid() is not null
    and exists (select 1 from challenge_members me where me.challenge_id = p_id and me.user_id = auth.uid())
    and m.challenge_id = p_id
  order by m.cards desc, m.streak desc, l.display_name;
$$;

create or replace function public.ch_leave(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from challenge_members where challenge_id = p_id and user_id = auth.uid();
  delete from challenges where id = p_id and not exists (select 1 from challenge_members where challenge_id = p_id);
end $$;

revoke all on function public.ch_create(text,text,date,date,int), public.ch_join(text), public.ch_list(), public.ch_publish(uuid,int,int), public.ch_board(uuid), public.ch_leave(uuid) from public, anon;
grant execute on function public.ch_create(text,text,date,date,int), public.ch_join(text), public.ch_list(), public.ch_publish(uuid,int,int), public.ch_board(uuid), public.ch_leave(uuid) to authenticated;
