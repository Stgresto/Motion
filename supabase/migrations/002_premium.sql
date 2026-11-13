-- Motion UF Premium (15 kr/mån): prenumerationsstatus, godkännande av villkor, daglig AI-gräns.
-- Körs i Supabase SQL editor. Skrivs av servern (service role) via Stripe-webhooken; användaren kan bara läsa sin egen status.

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  status                 text not null default 'none',      -- active | trialing | past_due | canceled | none
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
create table if not exists public.premium_consent (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  version     text not null,
  accepted_at timestamptz not null default now()
);
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  n       int  not null default 0,
  primary key (user_id, day)
);

alter table public.subscriptions   enable row level security;
alter table public.premium_consent enable row level security;
alter table public.ai_usage        enable row level security;
alter table public.subscriptions   force row level security;
alter table public.premium_consent force row level security;
alter table public.ai_usage        force row level security;

drop policy if exists "sub_select_own" on public.subscriptions;
create policy "sub_select_own" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "consent_select_own" on public.premium_consent;
drop policy if exists "consent_insert_own" on public.premium_consent;
drop policy if exists "consent_update_own" on public.premium_consent;
create policy "consent_select_own" on public.premium_consent for select to authenticated using (auth.uid() = user_id);
create policy "consent_insert_own" on public.premium_consent for insert to authenticated with check (auth.uid() = user_id);
create policy "consent_update_own" on public.premium_consent for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ai_usage: ingen åtkomst för klienten, bara servern (service role kringgår RLS)
revoke all on public.subscriptions   from anon;
revoke all on public.premium_consent from anon;
revoke all on public.ai_usage        from anon, authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
