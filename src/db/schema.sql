create extension if not exists "pgcrypto";

drop table if exists public.event_responses cascade;
drop table if exists public.event_status_messages cascade;
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
  invite_token text not null unique,
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
  required_players integer,
  status text not null default 'open' check (status in ('open', 'full', 'cancelled')),
  start_notified boolean not null default false,
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

create table if not exists public.event_status_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  chat_id bigint not null,
  message_id bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

drop trigger if exists event_status_messages_set_updated_at on public.event_status_messages;
create trigger event_status_messages_set_updated_at
before update on public.event_status_messages
for each row execute function public.set_updated_at();

drop trigger if exists feedback_set_updated_at on public.feedback;
create trigger feedback_set_updated_at
before update on public.feedback
for each row execute function public.set_updated_at();

create index if not exists group_members_user_id_idx on public.group_members(user_id);
create index if not exists events_group_id_idx on public.events(group_id);
create index if not exists event_responses_event_id_idx on public.event_responses(event_id);
create index if not exists event_status_messages_event_id_idx on public.event_status_messages(event_id);
create index if not exists feedback_user_id_idx on public.feedback(user_id);

-- ============================================
-- Row Level Security (RLS) for Mini App safety
-- ============================================

-- Users: readable by all (names in events), insertable by all (upsert via telegram_id)
alter table public.users enable row level security;

drop policy if exists "Users readable by all" on public.users;
create policy "Users readable by all" on public.users for select using (true);

drop policy if exists "Users insertable by all" on public.users;
create policy "Users insertable by all" on public.users for insert with check (true);

drop policy if exists "Users updatable by all" on public.users;
create policy "Users updatable by all" on public.users for update using (true) with check (true);

-- Groups: readable by all, insertable by all, deletable by creator
alter table public.groups enable row level security;

drop policy if exists "Groups readable by all" on public.groups;
create policy "Groups readable by all" on public.groups for select using (true);

drop policy if exists "Groups insertable by all" on public.groups;
create policy "Groups insertable by all" on public.groups for insert with check (true);

drop policy if exists "Groups deletable by creator" on public.groups;
create policy "Groups deletable by creator"
  on public.groups for delete
  using (creator_id = (select id from public.users where telegram_id = current_setting('app.current_telegram_id', true)::bigint));

-- Group members: readable/insertable by all
alter table public.group_members enable row level security;

drop policy if exists "Group members readable by all" on public.group_members;
create policy "Group members readable by all" on public.group_members for select using (true);

drop policy if exists "Group members insertable by all" on public.group_members;
create policy "Group members insertable by all" on public.group_members for insert with check (true);

-- Events: readable/insertable/updatable by all (filtered in app by group membership)
alter table public.events enable row level security;

drop policy if exists "Events readable by all" on public.events;
create policy "Events readable by all" on public.events for select using (true);

drop policy if exists "Events insertable by all" on public.events;
create policy "Events insertable by all" on public.events for insert with check (true);

drop policy if exists "Events updatable by all" on public.events;
create policy "Events updatable by all" on public.events for update using (true) with check (true);

-- Event responses: readable/insertable/updatable by all
alter table public.event_responses enable row level security;

drop policy if exists "Event responses readable by all" on public.event_responses;
create policy "Event responses readable by all" on public.event_responses for select using (true);

drop policy if exists "Event responses insertable by all" on public.event_responses;
create policy "Event responses insertable by all" on public.event_responses for insert with check (true);

drop policy if exists "Event responses updatable by all" on public.event_responses;
create policy "Event responses updatable by all" on public.event_responses for update using (true) with check (true);

-- Feedback: insertable by all, not readable via API
alter table public.feedback enable row level security;

drop policy if exists "Feedback insertable by all" on public.feedback;
create policy "Feedback insertable by all" on public.feedback for insert with check (true);
