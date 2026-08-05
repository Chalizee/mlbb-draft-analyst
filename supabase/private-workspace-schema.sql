-- Chalize private-link workspace
-- Run once in Supabase SQL Editor after supabase/schema.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Supabase projects normally install pgcrypto in `extensions`. Move older
-- installs there so the security-definer function can use an explicit schema.
do $move_pgcrypto$
declare
  extension_schema text;
begin
  select namespace.nspname
  into extension_schema
  from pg_catalog.pg_extension as extension
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = extension.extnamespace
  where extension.extname = 'pgcrypto';

  if extension_schema is distinct from 'extensions' then
    alter extension pgcrypto set schema extensions;
  end if;
end
$move_pgcrypto$;

create table if not exists public.workspace_access_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  token_hash bytea not null unique,
  role public.workspace_role not null
    check (role in ('editor'::public.workspace_role, 'viewer'::public.workspace_role)),
  label text not null default 'Private link',
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists workspace_access_links_workspace_idx
  on public.workspace_access_links(workspace_id, revoked_at);

alter table public.workspace_members
  add column if not exists access_link_id uuid
  references public.workspace_access_links(id);

create index if not exists workspace_members_access_link_idx
  on public.workspace_members(access_link_id);

alter table public.workspace_access_links enable row level security;
revoke all on public.workspace_access_links from public, anon, authenticated;

-- Existing email-based owner memberships have access_link_id = null and keep
-- working. Private devices only remain valid while their link is active.
create or replace function private.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select member.role::text
  from public.workspace_members as member
  left join public.workspace_access_links as access_link
    on access_link.id = member.access_link_id
  where member.workspace_id = target_workspace_id
    and member.user_id = (select auth.uid())
    and (
      member.access_link_id is null
      or access_link.revoked_at is null
    )
  limit 1
$$;

revoke all on function private.workspace_role(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;

create or replace function public.claim_private_workspace(private_token text)
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_role text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  requesting_user_id uuid := (select auth.uid());
  matched_link public.workspace_access_links%rowtype;
begin
  if requesting_user_id is null or length(trim(private_token)) < 32 then
    return;
  end if;

  select access_link.*
  into matched_link
  from public.workspace_access_links as access_link
  where access_link.token_hash = extensions.digest(trim(private_token), 'sha256')
    and access_link.revoked_at is null
  limit 1;

  if not found then
    return;
  end if;

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role,
    access_link_id
  )
  values (
    matched_link.workspace_id,
    requesting_user_id,
    matched_link.role,
    matched_link.id
  )
  on conflict on constraint workspace_members_pkey
  do update set
    role = case
      when public.workspace_members.role = 'owner' then public.workspace_members.role
      when public.workspace_members.role = 'editor'
        and excluded.role = 'viewer' then public.workspace_members.role
      else excluded.role
    end,
    access_link_id = case
      when public.workspace_members.role = 'owner'
        then public.workspace_members.access_link_id
      when public.workspace_members.role = 'editor'
        and excluded.role = 'viewer'
        then public.workspace_members.access_link_id
      else excluded.access_link_id
    end;

  return query
  select
    workspace.id,
    workspace.name,
    member.role::text
  from public.workspace_members as member
  join public.workspaces as workspace
    on workspace.id = member.workspace_id
  where member.workspace_id = matched_link.workspace_id
    and member.user_id = requesting_user_id
  limit 1;
end
$function$;

revoke all on function public.claim_private_workspace(text) from public;
revoke all on function public.claim_private_workspace(text) from anon;
grant execute on function public.claim_private_workspace(text) to authenticated;
