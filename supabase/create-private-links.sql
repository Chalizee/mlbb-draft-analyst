-- Run after private-workspace-schema.sql.
-- The result contains one editor link and one read-only management link.
-- Save them somewhere private: plain tokens are not stored in the database.

update public.workspace_access_links
set revoked_at = now()
where label in ('Team editor link', 'Management viewer link')
  and revoked_at is null;

with existing_workspace as materialized (
  select workspace.id
  from public.workspaces as workspace
  order by workspace.created_at asc
  limit 1
),
created_workspace as (
  insert into public.workspaces (name)
  select 'Chalize Team Workspace'
  where not exists (select 1 from existing_workspace)
  returning id
),
target_workspace as (
  select id from existing_workspace
  union all
  select id from created_workspace
  limit 1
),
private_secrets as materialized (
  select
    'editor'::public.workspace_role as role,
    'Team editor link'::text as label,
    encode(extensions.gen_random_bytes(32), 'hex') as token
  union all
  select
    'viewer'::public.workspace_role,
    'Management viewer link'::text,
    encode(extensions.gen_random_bytes(32), 'hex')
),
inserted_links as (
  insert into public.workspace_access_links (
    workspace_id,
    token_hash,
    role,
    label
  )
  select
    target.id,
    extensions.digest(secret.token, 'sha256'),
    secret.role,
    secret.label
  from target_workspace as target
  cross join private_secrets as secret
  returning workspace_id, role, label
)
select
  inserted.role::text as access_role,
  inserted.label,
  'https://chalize.site/scrims#access=' || secret.token as private_link
from inserted_links as inserted
join private_secrets as secret
  on secret.role = inserted.role
  and secret.label = inserted.label
order by inserted.role::text;
