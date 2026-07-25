-- Chalize secure workspace
-- Run once in Supabase SQL Editor before adding team members.

create extension if not exists pgcrypto;
create schema if not exists private;

do $$
begin
  create type public.workspace_role as enum ('owner', 'editor', 'viewer');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.workspace_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);

create table if not exists public.scrim_sessions (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  opponent text not null default '',
  session_date date,
  status text not null
    check (status in ('Draft', 'Complete', 'Reviewed', 'Shared')),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scrim_sessions_workspace_updated_idx
  on public.scrim_sessions(workspace_id, updated_at desc);

create index if not exists scrim_sessions_workspace_status_idx
  on public.scrim_sessions(workspace_id, status);

create or replace function private.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role::text
  from public.workspace_members as member
  where member.workspace_id = target_workspace_id
    and member.user_id = (select auth.uid())
  limit 1
$$;

revoke all on function private.workspace_role(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.scrim_sessions enable row level security;

revoke all on public.workspaces from anon;
revoke all on public.workspace_members from anon;
revoke all on public.scrim_sessions from anon;

grant select on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.scrim_sessions to authenticated;

drop policy if exists "Members can view their workspace" on public.workspaces;
create policy "Members can view their workspace"
on public.workspaces
for select
to authenticated
using (private.workspace_role(id) is not null);

drop policy if exists "Members can view workspace membership" on public.workspace_members;
create policy "Members can view workspace membership"
on public.workspace_members
for select
to authenticated
using (private.workspace_role(workspace_id) is not null);

drop policy if exists "Owners can add workspace members" on public.workspace_members;
create policy "Owners can add workspace members"
on public.workspace_members
for insert
to authenticated
with check (private.workspace_role(workspace_id) = 'owner');

drop policy if exists "Owners can update workspace members" on public.workspace_members;
create policy "Owners can update workspace members"
on public.workspace_members
for update
to authenticated
using (private.workspace_role(workspace_id) = 'owner')
with check (private.workspace_role(workspace_id) = 'owner');

drop policy if exists "Owners can remove workspace members" on public.workspace_members;
create policy "Owners can remove workspace members"
on public.workspace_members
for delete
to authenticated
using (private.workspace_role(workspace_id) = 'owner');

drop policy if exists "Team members can view allowed scrims" on public.scrim_sessions;
create policy "Team members can view allowed scrims"
on public.scrim_sessions
for select
to authenticated
using (
  private.workspace_role(workspace_id) in ('owner', 'editor')
  or (
    private.workspace_role(workspace_id) = 'viewer'
    and status = 'Shared'
  )
);

drop policy if exists "Owners and editors can create scrims" on public.scrim_sessions;
create policy "Owners and editors can create scrims"
on public.scrim_sessions
for insert
to authenticated
with check (
  private.workspace_role(workspace_id) in ('owner', 'editor')
  and created_by = (select auth.uid())
);

drop policy if exists "Owners and editors can update scrims" on public.scrim_sessions;
create policy "Owners and editors can update scrims"
on public.scrim_sessions
for update
to authenticated
using (private.workspace_role(workspace_id) in ('owner', 'editor'))
with check (private.workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists "Owners and editors can delete scrims" on public.scrim_sessions;
create policy "Owners and editors can delete scrims"
on public.scrim_sessions
for delete
to authenticated
using (private.workspace_role(workspace_id) in ('owner', 'editor'));
