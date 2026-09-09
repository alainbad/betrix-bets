alter type public.wallet_transaction_type add value if not exists 'withdrawal_lock';
alter type public.wallet_transaction_type add value if not exists 'withdrawal_settlement';
alter type public.wallet_transaction_type add value if not exists 'withdrawal_refund';
