-- New enum value only. Split into its own migration/transaction because
-- Postgres won't let a newly added enum value be referenced within the
-- same transaction it was added in - the RPC that uses 'cancelled' lives
-- in the next migration.
alter type public.withdrawal_status add value 'cancelled';
