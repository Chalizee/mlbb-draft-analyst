-- Run after creating the owner's Auth user in Supabase.
-- Replace the email before running.

do $bootstrap$
declare
  owner_user_id uuid;
  new_workspace_id uuid;
begin
  select id
  into owner_user_id
  from auth.users
  where lower(email) = lower('YOUR_OWNER_EMAIL')
  limit 1;

  if owner_user_id is null then
    raise exception 'Owner account not found. Create the Auth user first.';
  end if;

  insert into public.workspaces (name)
  values ('Chalize Team Workspace')
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, owner_user_id, 'owner');
end
$bootstrap$;
