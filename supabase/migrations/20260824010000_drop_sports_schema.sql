-- Drops the sports-betting schema entirely. The site has been casino-only
-- since PR #30 - confirmed via grep that nothing in src/ references any of
-- these tables or functions anymore. Removed in dependency order so no
-- CASCADE is needed:
--  - bet settlement/placement functions (sports-specific, unreachable from
--    the app since the bet-slip and admin settlement UI were removed)
--  - bet_selections, bets - existing wallet_transactions rows referencing a
--    settled bet are untouched: reference_id there is a plain uuid column,
--    not a foreign key, so the immutable wallet ledger stays intact
--  - odds_history, selections, markets, event_participants, events
--  - seasons, competitions, participants, countries, sports
--  - provider_mappings, providers
--
-- wallet_transaction_type keeps its now-unused 'wager_stake'/'wager_return'
-- enum values - Postgres can't cheaply drop enum values, and leaving them is
-- harmless since nothing will ever insert them again.

drop function if exists public.settle_event(uuid, int, int);
drop function if exists public.place_simulated_bet(jsonb);
drop function if exists public.evaluate_selection_result(text, text, numeric, int, int);

drop table if exists public.bet_selections;
drop table if exists public.bets;
drop table if exists public.odds_history;
drop table if exists public.selections;
drop table if exists public.markets;
drop table if exists public.event_participants;
drop table if exists public.events;
drop table if exists public.seasons;
drop table if exists public.competitions;
drop table if exists public.participants;
drop table if exists public.countries;
drop table if exists public.sports;
drop table if exists public.provider_mappings;
drop table if exists public.providers;
