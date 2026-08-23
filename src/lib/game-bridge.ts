// Bridges a self-hosted HTML5 game running in a sandboxed iframe to the
// wallet. The game posts { type: "CASINO_ROUND_FINISH", bet, win } when a
// round ends; this settles it server-side (play_html5_casino_round, which
// debits the stake, caps and credits the win, and logs the round) and
// echoes the new balance back into the iframe so the game's own UI can
// update.
//
// KNOWN LIMITATION: unlike the old in-house games (where the server rolled
// the outcome itself), a self-hosted game's win amount is decided by its
// own client-side code and only reported to us after the fact - we have no
// way to verify it's a legitimate result of that game's real logic. The RPC
// enforces a hard per-game max-win-multiplier as a backstop against a
// forged postMessage, but that's a cap on the damage, not real trust. Don't
// treat this balance as tamper-proof the way the sports/native-casino
// wallet was.

import { supabase } from "./supabase";

interface RoundFinishMessage {
  type: "CASINO_ROUND_FINISH";
  bet: number;
  win: number;
}

function isRoundFinishMessage(data: unknown): data is RoundFinishMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "CASINO_ROUND_FINISH"
  );
}

export function setupGameBridge(
  gameId: string,
  iframe: HTMLIFrameElement,
  onBalanceSync: (newBalance: number) => void,
  onError: (message: string) => void,
): () => void {
  const handleMessage = async (event: MessageEvent) => {
    // Only accept messages from this specific game's iframe, not any frame
    // or window that happens to be able to reach postMessage.
    if (event.source !== iframe.contentWindow) return;
    if (!isRoundFinishMessage(event.data)) return;

    const bet = Number(event.data.bet) || 0;
    const win = Number(event.data.win) || 0;

    try {
      const { data, error } = await supabase.rpc("play_html5_casino_round", {
        _game_id: gameId,
        _stake: bet,
        _claimed_win: win,
      });
      if (error) throw error;

      const balance = Number((data as { balance_after: number }).balance_after);
      onBalanceSync(balance);
      iframe.contentWindow?.postMessage({ type: "SUPABASE_BALANCE_ACK", newBalance: balance }, "*");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Round settlement failed");
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}
