-- Consolidate Chalize scrim rows into the workspace used by the active
-- private editor link. This script moves rows only; it does not delete any
-- scrim session, workspace, member, or access link.

begin;

do $guard$
begin
  if not exists (
    select 1
    from public.workspace_access_links as access_link
    where access_link.workspace_id = 'edc6df76-29e6-43d1-ae0a-0e57890e33ab'::uuid
      and access_link.role = 'editor'
      and access_link.revoked_at is null
  ) then
    raise exception 'The expected active editor workspace was not found.';
  end if;
end
$guard$;

update public.scrim_sessions
set workspace_id = 'edc6df76-29e6-43d1-ae0a-0e57890e33ab'::uuid
where workspace_id in (
  '91f72020-9981-42a3-a385-375676844e2c'::uuid,
  'e72855e3-b483-485c-9ae8-d00eab8a6a52'::uuid
);

commit;

select
  workspace.id as workspace_id,
  workspace.name,
  count(session.id) as total_sessions,
  max(session.updated_at) as last_session_sync
from public.workspaces as workspace
left join public.scrim_sessions as session
  on session.workspace_id = workspace.id
group by workspace.id, workspace.name, workspace.created_at
order by workspace.created_at;
