create extension if not exists "pgcrypto";

drop table if exists public.event_responses cascade;
drop table if exists public.events cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.users cascade;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  creator_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  creator_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  required_players integer not null check (required_players > 0),
  status text not null default 'open' check (status in ('open', 'full', 'cancelled')),
  creator_status_chat_id bigint,
  creator_status_message_id bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists event_responses_set_updated_at on public.event_responses;
create trigger event_responses_set_updated_at
before update on public.event_responses
for each row execute function public.set_updated_at();

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists events_group_id_idx on public.events(group_id);
create index if not exists event_responses_event_id_idx on public.event_responses(event_id);
