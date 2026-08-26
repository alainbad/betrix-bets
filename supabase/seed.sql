-- Reference data: roles + baseline permission catalog.
-- Safe to re-run: uses ON CONFLICT DO NOTHING.

insert into public.roles (role, description) values
  ('player', 'Regular platform user placing simulated bets and playing casino games'),
  ('support', 'Front-line player support: view player activity, no financial actions'),
  ('odds_manager', 'Manages sports, competitions, events, markets and odds overrides'),
  ('risk_manager', 'Views exposure/liability analytics, can suspend markets'),
  ('casino_manager', 'Manages casino game configuration and reviews casino analytics'),
  ('content_manager', 'Manages promotions, banners and non-financial site content'),
  ('administrator', 'Full operator console access, including virtual balance adjustments'),
  ('super_admin', 'Full administrator access plus role management'),
  ('ultra_admin', 'Platform owner: mints coin supply and appoints super agents/agents'),
  ('super_agent', 'Buys/receives coin batches from the platform and manages a network of agents'),
  ('agent', 'Cashier: tops up and cashes out players in their book')
on conflict (role) do nothing;

insert into public.permissions (code, description) values
  ('players.view', 'View player list and player detail pages'),
  ('players.adjust_balance', 'Issue or remove virtual simulation credits'),
  ('sportsbook.manage_events', 'Create/edit/suspend sports, competitions, events and markets'),
  ('sportsbook.override_odds', 'Override provider-derived odds and results'),
  ('sportsbook.settle_bets', 'Settle or void bets and markets'),
  ('casino.manage_games', 'Enable/disable casino games and edit game configuration'),
  ('risk.view_exposure', 'View exposure and liability analytics'),
  ('audit.view', 'View the audit log'),
  ('roles.manage', 'Grant or revoke platform roles')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_id)
select 'support', id from public.permissions where code = 'players.view'
on conflict do nothing;

insert into public.role_permissions (role, permission_id)
select r.role, p.id
from public.permissions p
cross join (values ('odds_manager'::public.app_role)) as r(role)
where p.code in ('sportsbook.manage_events', 'sportsbook.override_odds')
on conflict do nothing;

insert into public.role_permissions (role, permission_id)
select 'risk_manager', id from public.permissions where code in ('risk.view_exposure', 'sportsbook.manage_events')
on conflict do nothing;

insert into public.role_permissions (role, permission_id)
select 'casino_manager', id from public.permissions where code = 'casino.manage_games'
on conflict do nothing;

insert into public.role_permissions (role, permission_id)
select r.role, p.id
from public.permissions p
cross join (values ('administrator'::public.app_role), ('super_admin'::public.app_role)) as r(role)
on conflict do nothing;

insert into public.role_permissions (role, permission_id)
select 'super_admin', id from public.permissions where code = 'roles.manage'
on conflict do nothing;
