-- One-time reset of every wallet's available_balance to zero, requested by
-- the platform owner to start a clean test of the new ultra_admin top-up/
-- mint flow. Logs a normal admin_adjustment ledger entry per wallet before
-- zeroing it, same audit trail every other balance change gets - this is
-- not a special, untracked reset.
--
-- Only available_balance moves: reserved_balance is dead (defined in the
-- foundation migration, never written to by anything in this codebase -
-- casino rounds settle the stake/payout directly against available_balance,
-- no hold step), so there is nothing there to reset.

insert into public.wallet_transactions (
  user_id, wallet_id, transaction_type, amount, balance_before, balance_after, reference_type, description
)
select user_id, id, 'admin_adjustment', -available_balance, available_balance, 0,
       'balance_reset', 'Reset to zero for top-up testing'
from public.wallets
where available_balance <> 0;

update public.wallets
set available_balance = 0
where available_balance <> 0;
