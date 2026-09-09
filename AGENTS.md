<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Section 1 / Section 2 split — read before touching any file

The codebase is split into two independently-changing areas. **A task scoped to
one section must never touch files in the other**, even incidentally (no
"while I'm here" cleanup, no shared-looking rename). If a task seems to need
changes on both sides, stop and confirm with the user before editing anything
in the other section.

**Section 2 — the games.** Treated as if delivered by an external game
provider. Changes here normally arrive as files the user has already had
ChatGPT produce, pasted in for direct implementation — not designed from
scratch in this repo.

- `public/games/**` — every self-hosted game's HTML/CSS/JS/assets (`velvet/`,
  `demo-slot/`, `neon-reels/`, `vault-rush/`, and any future game folder)
- `supabase/functions/velvet-round/**` and `supabase/functions/_shared/velvet/**`
  (and the equivalent dedicated function + shared engine files for any other
  game that gets its own server-authoritative settlement)
- `src/lib/blackjack-engine.ts`, `src/lib/holdem-engine.ts`, `src/lib/roulette.ts`
  (per-game client logic)
- Game-specific settlement migrations: `20260817000000_casino_engine.sql`,
  `20260818000000_blackjack_engine.sql`, `20260818010000_blackjack_search_path_fix.sql`,
  `20260818020000_holdem_engine.sql`, `20260819000000_html5_casino_engine.sql`,
  `20260823020000_html5_casino_rtp_engine.sql`, `20260908000000_velvet_server_rounds.sql`,
  `20260908030000_velvet_round_guardrails.sql`, and any future game's own
  settlement migration

**Section 1 — the website.** Everything else: site structure, the admin/agent
dashboards, auth, and the cash-flow/wallet system. This is Claude's default
domain for day-to-day requests.

- `src/routes/**`, `src/components/**` except `src/components/casino/GameModal.tsx`
  is the one casino-related file that's still Section 1 (see below)
- `src/lib/**` except the three per-game engine files listed under Section 2
  — this explicitly includes `src/components/casino/GameModal.tsx`,
  `src/lib/game-bridge.ts`, `src/lib/velvet-bridge.ts`, and `src/lib/casino-data.ts`:
  these are the site's own integration layer (iframe host/wallet chrome, the
  postMessage protocol contract, and the game catalog/manifest) — the "SDK"
  the site uses to talk to whichever games are plugged in, not game content
  itself. Claude edits these for site-side work, and also to register a new
  game's catalog entry once its Section-2 files are in place.
- All other `supabase/migrations/*.sql` and `supabase/functions/*` (auth,
  wallet, profiles, agent hierarchy, withdrawals, admin tools, etc.)

When a new game arrives from ChatGPT: implement its Section-2 files as given,
then — as a separate, clearly-called-out step — add its entry to
`casino-data.ts` so it shows up on `/casino`. That catalog edit is Section 1
and fine to do in the same task; the game's own files are not.
