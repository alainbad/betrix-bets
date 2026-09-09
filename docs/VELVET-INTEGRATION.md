# Velvet integration into the existing Betrix repository

Target: `alainbad/betrix-bets`, based on main commit `74044090519d4ed4109c53785b745fd5ca33a6de`.

This update extends the existing Lovable/TanStack/React application. It does not create a new repository, replace authentication, change the domain, or introduce a second wallet. Existing signup, profiles, password reset, referral codes, agent roles, allocation/reclaim controls and history remain in use.

## Included

- Midnight Vault, Royale Roulette, Candy Cascade and Temple of Thunder, including artwork, sounds, drop animations, match effects and resting roulette dealer behind the wheel.
- Large two-column game cards with free practice previews on `/casino` (the current homepage redirects there).
- Authenticated play through the existing Supabase wallet; practice previews never access that wallet.
- Game-specific server results, atomic debit/payout/ledger entries, idempotent requests, account-status checks and optimistic session versions.
- Persisted free-spin counts/stakes/storm charge and vault bonus choices. Closing and reopening resumes an unfinished feature. Unopened vault prizes never leave the server.
- Agent → Ultra Admin → test settlement withdrawal flow with reservation, rejection/refund and reviewer authorization, integrated into existing role dashboards and `/account`.
- Existing `reserved_balance` is reused; no competing locked-balance column is introduced.

All credits remain simulation credits. No cash payment is executed.

## Apply to the SAME repository

The update ZIP contains only new/changed files, with their original repository paths. Copy these files into a clean checkout of `alainbad/betrix-bets`. Review conflicts if main has moved beyond the base commit above. Commit normally; do not force-push or replace Git history. No `.env`, credentials, node_modules, build output, or complete replacement repository is included.

The work is committed locally on `feat/velvet-originals`, but the GitHub connector rejected creation of the remote branch with HTTP 403, “Resource not accessible by integration.” The remote repository and live site have NOT been updated by this work.

## Supabase rollout

The connected Lovable project reports managed database `enabled: false`. That does not mean Betrix has no database: its source already uses an external Supabase project. This session has not inspected or migrated that live database.

1. Confirm the current remote schema and migration history match the repository baseline. Back up the database. Test these additions in a staging Supabase project first. Do not replay earlier migrations: this repository includes historical balance-reset migrations.
2. Apply ONLY these new migrations in chronological order, committing each separately:
   - `20260908000000_velvet_server_rounds.sql`
   - `20260908010000_withdrawal_transaction_types.sql`
   - `20260908020000_withdrawal_review.sql`
   - `20260908030000_velvet_round_guardrails.sql`
3. Deploy `supabase/functions/velvet-round` and its `_shared/velvet` imports to the same Supabase project used by Betrix. With an authenticated Supabase CLI: `supabase functions deploy velvet-round --project-ref YOUR_EXISTING_PROJECT_REF`. The function uses Supabase's server-provided `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; never put a service-role key in browser/VITE variables.
4. The function configuration disables only the platform's legacy JWT check. The handler still verifies every bearer token via `/auth/v1/user`, checks active profile status, and derives the user ID from that verified response. The wallet settlement RPC is executable only by `service_role`. See https://supabase.com/docs/guides/functions/auth-headers.
5. Confirm the function works with the existing frontend auth session. Test base spins, free-spin resume, safe picks, insufficient balance, duplicate request IDs, another-window session conflicts, and the withdrawal approval/refund path.
6. Merge the reviewed source into the existing Lovable-connected branch and publish the existing Lovable project. Keep thebetrix.com and its DNS configuration.

Until the database migrations and Edge Function are deployed, free previews work, but wallet play and withdrawal requests report that the service is unavailable. Do not publish the frontend as fully operational before these backend steps pass.

## Validation performed

- `npm run build` passed for the existing Lovable application.
- `npx tsc --noEmit` passed after integration fixes.
- `node --test tests/velvet-engine.test.mjs` passed: roulette zero/bet validation, payout/board consistency, bonus choices, hidden prizes, free-spin progression and storm charge.
- `tests/velvet-database.test.mjs` passed against an isolated PostgreSQL-compatible PGlite instance with representative schema fixtures: all four migrations, service authorization, duplicate settlement, stale-state rollback, withdrawal stages/refunds, and old RPC isolation.
- PGlite test dependency was installed outside the repository to preserve the existing dependency manifest and Bun lockfile. To rerun, install `@electric-sql/pglite` in a temporary directory and set `PGLITE_MODULE` to its `dist/index.js` path before running `node tests/velvet-database.test.mjs`.

Live Supabase deployment and authenticated browser end-to-end testing have not been performed. These checks do not establish a particular statistical return-to-player value; outcomes follow the original game rules and payout tables, rather than the older generic 15% / 6× engine.
