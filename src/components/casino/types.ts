// Shared props for every casino game stage animation. The server has
// already decided win/lose/payout (play_casino_round) before any of these
// components render a result - "outcome" here is what the animation reveals,
// never what determines it. "pick" is the player's pre-round choice (a coin
// side, a roulette number) - it only ever steers which cosmetic face/segment
// the reveal lands on, it is never sent to or read by the server.
export type CasinoStagePhase = "idle" | "spinning" | "revealed";

export interface CasinoStageProps {
  phase: CasinoStagePhase;
  outcome: "win" | "lose" | null;
  pick?: string | number | null | undefined;
}
