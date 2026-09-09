import { IDS, publicState, resolveRound } from "../_shared/velvet/round.mjs";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
async function rest(path: string, body?: unknown) {
  const r = await fetch(url + "/rest/v1/" + path, {
    method: body ? "POST" : "GET",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || "Account service unavailable");
  return d;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = {
    "Access-Control-Allow-Origin": origin || "https://thebetrix.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };
  // CORS is not an authorization mechanism; every request verifies its JWT below.
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  try {
    const auth = req.headers.get("authorization");
    if (!auth) throw new Error("Sign in to play");
    const userResponse = await fetch(url + "/auth/v1/user", {
      headers: { apikey: key, Authorization: auth },
    });
    if (!userResponse.ok) throw new Error("Sign in to play");
    const user = await userResponse.json();
    if (!user.id) throw new Error("Sign in to play");
    const body = await req.json();
    if (!IDS.includes(body.gameId)) throw new Error("Unknown game");
    const profiles = await rest("profiles?select=status&id=eq." + user.id);
    if (profiles[0]?.status !== "active") throw new Error("Account is not active");
    const game = body.gameId;
    const sessions = await rest(
      `velvet_sessions?user_id=eq.${user.id}&game_id=eq.${game}&select=version,state`,
    );
    const session = sessions[0] || { version: 0, state: null };
    if (body.action === "init") {
      const wallets = await rest("wallets?select=available_balance&user_id=eq." + user.id);
      return new Response(
        JSON.stringify({
          balanceAfter: wallets[0]?.available_balance || 0,
          state: publicState(session.state),
          version: session.version,
        }),
        { headers },
      );
    }
    if (typeof body.requestId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.requestId))
      throw new Error("Invalid request ID");
    const previous = await rest(
      `velvet_receipts?user_id=eq.${user.id}&request_id=eq.${body.requestId}&select=response,game_id`,
    );
    if (previous.length) {
      if (previous[0].game_id !== game) throw new Error("Request ID already used");
      return new Response(JSON.stringify(previous[0].response), { headers });
    }
    if (body.version !== session.version)
      throw new Error("Game state changed in another window. Reopen the game to resume.");
    // Blackjack/baccarat validate stakes against the live balance before
    // settling (e.g. can this hand afford a double/split) - the other games
    // don't need it, so it's only fetched for those two to avoid an extra
    // round trip on every spin.
    const balance =
      game === "velvet-blackjack" || game === "velvet-baccarat"
        ? Number((await rest("wallets?select=available_balance&user_id=eq." + user.id))[0]
            ?.available_balance || 0)
        : 0;
    // Browser may supply only intent. It never supplies a payout, board or feature state.
    const round = resolveRound(game, body, session.state, balance);
    const response = await rest("rpc/settle_velvet_round", {
      p_user: user.id,
      p_request: body.requestId,
      p_game: game,
      p_version: session.version,
      p_stake: round.stake,
      p_payout: round.payout,
      p_result: round.result,
      p_state: round.state,
      p_public_state: publicState(round.state),
    });
    return new Response(JSON.stringify(response), { headers });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Round unavailable" }),
      { status: 400, headers },
    );
  }
});
