-- Removes admin_topup_user and profiles.is_admin, orphaned leftovers from an
-- outside integration spec that got applied directly to this database
-- (likely via the Lovable editor) outside of this repo's migration history.
--
-- Both are dead: nothing in the app frontend references either, and the
-- function is actually broken already - it writes to profiles.virtual_coins
-- and inserts into game_transactions, neither of which exist here (this app
-- uses wallets/wallet_transactions instead, see admin_topup_wallet).
--
-- But profiles.is_admin is also a live self-escalation hole: the existing
-- "profiles update own" RLS policy lets a user update any column on their
-- own profile row except status (which has a dedicated trigger guard) -
-- is_admin had no such guard, so any signed-in user could set their own
-- profiles.is_admin to true via a normal client update. Nothing currently
-- checks that column (real admin checks go through is_admin(uuid), backed
-- by user_roles), so this had no live exploit path today, but it's a
-- privilege-escalation footgun sitting in production for no reason.

drop function if exists public.admin_topup_user(uuid, bigint, text);
alter table public.profiles drop column if exists is_admin;
