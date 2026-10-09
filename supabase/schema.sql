-- ============================================================
-- Pushers – database
-- Plak dit hele bestand in Supabase > SQL Editor > New query > Run.
-- Pas eerst de uitnodigingscode hieronder aan.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Uitnodigingscode (alleen jullie crew kan een account maken) ----------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.config (
  key text primary key,
  value text not null
);

insert into private.config (key, value)
values ('invite_code', 'VERANDER-MIJ')
on conflict (key) do update set value = excluded.value;

-- ---------- Profielen ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  level text not null default 'beginner' check (level in ('beginner', 'gevorderd')),
  bodyweight_kg numeric(5,1) not null default 75,
  water_goal_ml int not null default 3000 check (water_goal_ml between 500 and 10000),
  glass_ml int not null default 250 check (glass_ml between 50 and 2000),
  creatine_g numeric(4,1) not null default 5,
  created_at timestamptz not null default now()
);

-- Nieuw account: check uitnodigingscode en maak profiel aan.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  expected text;
begin
  select value into expected from private.config where key = 'invite_code';
  if coalesce(new.raw_user_meta_data ->> 'invite_code', '') <> coalesce(expected, '') then
    raise exception 'Ongeldige uitnodigingscode';
  end if;

  insert into public.profiles (id, display_name, level)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'level' = 'gevorderd' then 'gevorderd' else 'beginner' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Trainingen ----------
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day_type text not null check (day_type in ('push', 'pull', 'legs', 'upper', 'cardio')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  quick_check boolean not null default false, -- afgevinkt zonder sets te loggen
  cardio_description text,
  cardio_minutes int check (cardio_minutes is null or cardio_minutes between 1 and 600),
  notes text
);
create index if not exists workouts_user_started on public.workouts (user_id, started_at desc);

-- ---------- Sets ----------
create table if not exists public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  exercise_id text not null,
  set_number int not null check (set_number between 1 and 20),
  weight_kg numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps int not null check (reps between 0 and 100),
  rir int check (rir between 0 and 3), -- 3 betekent "3 of meer"
  is_drop boolean not null default false,
  drop_weight_kg numeric(6,2),
  drop_reps int,
  created_at timestamptz not null default now()
);
create index if not exists sets_user_exercise on public.sets (user_id, exercise_id, created_at);
create index if not exists sets_workout on public.sets (workout_id);

-- ---------- Water & creatine ----------
create table if not exists public.habit_logs (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null,
  water_ml int not null default 0 check (water_ml between 0 and 20000),
  creatine boolean not null default false,
  primary key (user_id, day)
);

-- ---------- AI-coach ----------
create table if not exists public.coach_advice (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('weekly', 'today')),
  day_type text,
  summary text not null,
  adjustments jsonb not null default '[]'::jsonb,
  valid_until date not null
);
create index if not exists coach_user_created on public.coach_advice (user_id, created_at desc);

-- ---------- Beveiliging (RLS) ----------
-- Iedereen in de crew mag alles van elkaar zíen, maar alleen zijn eigen dingen aanpassen.
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.sets enable row level security;
alter table public.habit_logs enable row level security;
alter table public.coach_advice enable row level security;

drop policy if exists "crew leest profielen" on public.profiles;
create policy "crew leest profielen" on public.profiles for select to authenticated using (true);
drop policy if exists "eigen profiel aanpassen" on public.profiles;
create policy "eigen profiel aanpassen" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "crew leest trainingen" on public.workouts;
create policy "crew leest trainingen" on public.workouts for select to authenticated using (true);
drop policy if exists "eigen trainingen" on public.workouts;
create policy "eigen trainingen" on public.workouts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "crew leest sets" on public.sets;
create policy "crew leest sets" on public.sets for select to authenticated using (true);
drop policy if exists "eigen sets" on public.sets;
create policy "eigen sets" on public.sets for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  );

drop policy if exists "crew leest streaks" on public.habit_logs;
create policy "crew leest streaks" on public.habit_logs for select to authenticated using (true);
drop policy if exists "eigen streaks" on public.habit_logs;
create policy "eigen streaks" on public.habit_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "eigen coach" on public.coach_advice;
create policy "eigen coach" on public.coach_advice for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workouts, public.sets, public.habit_logs, public.coach_advice to authenticated;
grant select, update on public.profiles to authenticated;
