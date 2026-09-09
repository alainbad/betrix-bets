import { rand, makeGrid, evaluate, bonusPrizes } from "./vault-engine.mjs";
import { WHEEL, settle, isValidCornerBet } from "./roulette-engine.mjs";
import {
  CONFIG,
  makeBoard,
  evaluateBoard,
  collapse,
  drawCell,
  roundMultiplier,
  scatterCount,
} from "./cascade-engine.mjs";
import { resolveSpin as resolveSugarSpin } from "./sugar-engine.mjs";
export const IDS = [
  "velvet-vault",
  "velvet-roulette",
  "velvet-candy",
  "velvet-thunder",
  "velvet-sugar",
];
const requireValue = (ok, message) => {
  if (!ok) throw new Error(message);
};
export function publicState(state) {
  if (!state) return null;
  const { prizes, ...rest } = state;
  return rest;
}
export function resolveRound(game, input, state = null) {
  requireValue(IDS.includes(game), "Unknown game");
  if (game === "velvet-vault" && state?.kind === "vault") {
    requireValue(input.action === "pick", "Finish your vault bonus first");
    const index = input.index;
    requireValue(
      Number.isInteger(index) &&
        index >= 0 &&
        index < 6 &&
        !state.picks.some((p) => p.index === index),
      "Choose an unopened safe",
    );
    const prize = state.prizes[index],
      cents = prize * state.stake * 100;
    const next = {
      ...state,
      picks: [...state.picks, { index, prize }],
      total: state.total + cents,
    };
    return {
      stake: 0,
      payout: cents / 100,
      result: { prize, index, bonusTotal: next.total, complete: next.picks.length === 3 },
      state: next.picks.length === 3 ? null : next,
    };
  }
  requireValue(input.action === "spin", "Invalid game action");
  const inFeature = state?.kind === "cascade";
  const stake = inFeature ? state.stake : input.stake;
  if (game === "velvet-roulette") {
    requireValue(
      Array.isArray(input.bets) && input.bets.length > 0 && input.bets.length <= 200,
      "Place 1–200 chips",
    );
    for (const b of input.bets) {
      requireValue(
        typeof b.key === "string" &&
          (/^(red|black|odd|even|low|high)$/.test(b.key) ||
            /^n:([0-9]|[12][0-9]|3[0-6])$/.test(b.key) ||
            /^(dozen|column):[1-3]$/.test(b.key) ||
            isValidCornerBet(b.key)),
        "Invalid roulette bet",
      );
      requireValue([10, 25, 50, 100, 500].includes(b.amount), "Invalid chip");
    }
    const total = input.bets.reduce((s, b) => s + b.amount, 0);
    requireValue(total <= 100000, "Table limit exceeded");
    const number = WHEEL[rand(37)];
    return {
      stake: total,
      payout: settle(number, input.bets),
      result: { number, bets: input.bets },
      state: null,
    };
  }
  if (game === "velvet-sugar") {
    const sugarInFeature = state?.kind === "sugar";
    const sugarStake = sugarInFeature ? state.stake : input.stake;
    requireValue([10, 20, 50, 100, 200, 500].includes(sugarStake), "Invalid stake");
    const priorMarks = sugarInFeature ? state.marks : Array(49).fill(0);
    const spin = resolveSugarSpin(sugarStake, priorMarks);
    let next = null;
    if (sugarInFeature && state.remaining > 1) {
      next = {
        kind: "sugar",
        stake: sugarStake,
        remaining: state.remaining - 1,
        total: state.total + spin.total,
        marks: spin.marks,
      };
    } else if (!sugarInFeature && spin.scatters >= 4) {
      next = { kind: "sugar", stake: sugarStake, remaining: 10, total: 0, marks: spin.marks };
    }
    return {
      stake: sugarInFeature ? 0 : sugarStake,
      payout: spin.total / 100,
      result: {
        initial: spin.initial,
        steps: spin.steps,
        scatters: spin.scatters,
        marks: spin.marks,
        total: spin.total,
      },
      state: next,
    };
  }
  requireValue([10, 20, 50, 100, 200, 500].includes(stake), "Invalid stake");
  if (game === "velvet-vault") {
    const grid = makeGrid(),
      evaluation = evaluate(grid, stake);
    const next = evaluation.bonus
      ? {
          kind: "vault",
          stake,
          lineWin: evaluation.cents,
          prizes: bonusPrizes(),
          picks: [],
          total: 0,
        }
      : null;
    return { stake, payout: evaluation.cents / 100, result: { grid, evaluation }, state: next };
  }
  const theme = game === "velvet-candy" ? "candy" : "thunder",
    cfg = CONFIG[theme];
  let board = makeBoard(theme),
    base = 0,
    collected = 0;
  const initial = board,
    scatters = scatterCount(board),
    steps = [];
  for (let i = 0; i < 20; i++) {
    const evaluation = evaluateBoard(board, stake);
    if (!evaluation.wins.length) break;
    base += evaluation.cents;
    collected += evaluation.multiplier;
    const next = i < 19 ? collapse(board, evaluation.remove, () => drawCell(theme)) : null;
    steps.push({ evaluation: { ...evaluation, remove: [...evaluation.remove] }, next });
    if (next) board = next.grid;
  }
  const multiplier = roundMultiplier(theme, inFeature, state?.charge || 0, collected),
    cents = base * multiplier;
  let next = null;
  if (inFeature && state.remaining > 1)
    next = {
      ...state,
      remaining: state.remaining - 1,
      total: state.total + cents,
      charge: theme === "thunder" ? state.charge + collected : 0,
    };
  if (!inFeature && scatters >= 4)
    next = { kind: "cascade", stake, remaining: cfg.free, total: 0, charge: 0 };
  return {
    stake: inFeature ? 0 : stake,
    payout: cents / 100,
    result: {
      initial,
      initialScatters: scatters,
      steps,
      base,
      collected,
      multiplier,
      cents,
      inFeature,
    },
    state: next,
  };
}
