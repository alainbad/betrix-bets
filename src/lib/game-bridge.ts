// Bridges a self-hosted HTML5 game running in a sandboxed iframe to the
// wallet. The game posts { type: "CASINO_SPIN_REQUEST", bet } to ask for a
// round; this settles it server-side (play_html5_casino_round, which debits
// the stake, rolls the outcome itself, credits any win, and logs the round)
// and posts the result back into the iframe so the game's own UI can
// animate to it and update its balance.
//
// The server rolls the outcome (not the game) so a target win rate can
// actually be enforced - see the RTP engine migration for the current
// calibration. The game is only ever told what happened after the fact.

import { supabase } from "./supabase";

interface SpinRequestMessage {
  type: "CASINO_SPIN_REQUEST";
  bet: number;
}

function isSpinRequestMessage(data: unknown): data is SpinRequestMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { type?: unknown }).type === "CASINO_SPIN_REQUEST"
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
    if (!isSpinRequestMessage(event.data)) return;

    const bet = Number(event.data.bet) || 0;

    try {
      const { data, error } = await supabase.rpc("play_html5_casino_round", {
        _game_id: gameId,
        _stake: bet,
      });
      if (error) throw error;

      const result = data as { payout: number; multiplier: number; balance_after: number };
      const win = Number(result.payout);
      const balance = Number(result.balance_after);

      onBalanceSync(balance);
      iframe.contentWindow?.postMessage(
        {
          type: "CASINO_SPIN_RESULT",
          win,
          multiplier: Number(result.multiplier),
          balanceAfter: balance,
        },
        "*",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Round settlement failed";
      onError(message);
      iframe.contentWindow?.postMessage({ type: "CASINO_SPIN_ERROR", message }, "*");
    }
  };

  window.addEventListener("message", handleMessage);
  return () => window.removeEventListener("message", handleMessage);
}
