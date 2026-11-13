-- Motion UF — topplista med vänner. Allt går via funktioner (security definer), klienten når inte tabellerna direkt.
-- Visas bara: visningsnamn + veckans och totala poäng, och bara för användare som lagt till varandra med vänkod.

create table if not exists public.leaderboard (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  friend_code  text not null unique,
  week_start   date not null,
  week_points  int  not null default 0,
  total_points int  not null default 0,
  updated_at   timestamptz not null default now()
);
create table if not exists public.friends (
  user_id    uuid not null references auth.users(id) on delete cascade,
  friend_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
alter table public.leaderboard enable row level security;
alter table public.friends     enable row level security;
alter table public.leaderboard force row level security;
alter table public.friends     force row level security;
revoke all on public.leaderboard from anon, authenticated;
revoke all on public.friends     from anon, authenticated;

create or replace function public.lb_publish(p_name text, p_week date, p_week_points int, p_total int)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); code text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select friend_code into code from leaderboard where user_id = me;
  if code is null then
    loop
      code := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 6);
      exit when not exists (select 1 from leaderboard where friend_code = code);
    end loop;
  end if;
  insert into leaderboard(user_id, display_name, friend_code, week_start, week_points, total_points, updated_at)
  values (me, left(trim(p_name), 20), code, p_week, greatest(0, least(p_week_points, 100000)), greatest(0, least(p_total, 10000000)), now())
  on conflict (user_id) do update set display_name = excluded.display_name, week_start = excluded.week_start,
    week_points = excluded.week_points, total_points = excluded.total_points, updated_at = now();
  return code;
end $$;

create or replace function public.lb_add_friend(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); other uuid; nm text;
begin
  if me is null then raise exception 'not signed in'; end if;
  select user_id, display_name into other, nm from leaderboard where friend_code = upper(trim(p_code));
  if other is null or other = me then raise exception 'not found'; end if;
  insert into friends(user_id, friend_id) values (me, other), (other, me) on conflict do nothing;
  return nm;
end $$;

create or replace function public.lb_board(p_week date)
returns table(user_id uuid, display_name text, week_points int, total_points int, is_me boolean)
language sql security definer set search_path = public as $$
  select l.user_id, l.display_name,
         case when l.week_start = p_week then l.week_points else 0 end,
         l.total_points, l.user_id = auth.uid()
  from leaderboard l
  where auth.uid() is not null
    and (l.user_id = auth.uid() or l.user_id in (select friend_id from friends where friends.user_id = auth.uid()))
  order by 3 desc, 2;
$$;

create or replace function public.lb_leave()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from friends where user_id = auth.uid() or friend_id = auth.uid();
  delete from leaderboard where user_id = auth.uid();
end $$;

revoke all on function public.lb_publish(text,date,int,int), public.lb_add_friend(text), public.lb_board(date), public.lb_leave() from public, anon;
grant execute on function public.lb_publish(text,date,int,int), public.lb_add_friend(text), public.lb_board(date), public.lb_leave() to authenticated;
