-- Fixes "Could not start the round" on Blackjack: the engine's functions
-- restrict search_path to just "public", but gen_random_bytes (the
-- crypto-secure shuffle source) lives in pgcrypto, which Supabase installs
-- into the "extensions" schema by convention - so it was never resolvable
-- and every call failed. Widening each function's search_path to include
-- "extensions" fixes it without needing to redefine any function body.

create extension if not exists pgcrypto with schema extensions;

alter function public.blackjack_start(numeric) set search_path = public, extensions;
alter function public.blackjack_hit(uuid) set search_path = public, extensions;
alter function public.blackjack_stand(uuid) set search_path = public, extensions;
alter function public.blackjack_double(uuid) set search_path = public, extensions;
