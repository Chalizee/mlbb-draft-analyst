-- Run after creating the boss/management Auth user in Supabase.
-- Replace both emails before running.

insert into public.workspace_members (workspace_id, user_id, role)
select
  owner_membership.workspace_id,
  viewer.id,
  'viewer'::public.workspace_role
from auth.users as owner_user
join public.workspace_members as owner_membership
  on owner_membership.user_id = owner_user.id
  and owner_membership.role = 'owner'
cross join auth.users as viewer
where lower(owner_user.email) = lower('YOUR_OWNER_EMAIL')
  and lower(viewer.email) = lower('BOSS_EMAIL')
on conflict (workspace_id, user_id)
do update set role = excluded.role;
