// Shared props for every casino game stage animation. The server has
// already decided win/lose/payout (play_casino_round) before any of these
// components render a result - "outcome" here is what the animation reveals,
// never what determines it.
export type CasinoStagePhase = "idle" | "spinning" | "revealed";

export interface CasinoStageProps {
  phase: CasinoStagePhase;
  outcome: "win" | "lose" | null;
}
