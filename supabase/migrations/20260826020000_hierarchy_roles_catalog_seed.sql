-- public.user_roles.role has a foreign key to public.roles(role)
-- (20260816000000_foundation_auth_wallet.sql). agent_hierarchy_schema.sql
-- added ultra_admin/super_agent/agent to the app_role enum but never
-- registered them here, so every insert into user_roles for these tiers -
-- promote_to_super_agent, promote_to_agent, the ultra_admin bootstrap and
-- ultra_admin_set_hierarchy_role RPC below - would fail with a FK
-- violation the first time any of them actually ran. Same
-- on-conflict-do-nothing style as supabase/seed.sql's existing role rows;
-- seed.sql is updated to match so local `supabase db reset` stays in sync.
insert into public.roles (role, description) values
  ('ultra_admin', 'Platform owner: mints coin supply and appoints super agents/agents'),
  ('super_agent', 'Buys/receives coin batches from the platform and manages a network of agents'),
  ('agent', 'Cashier: tops up and cashes out players in their book')
on conflict (role) do nothing;
