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
import { resolveSpin as resolvePawSpin } from "./paw-engine.mjs";
import { spin as resolveBassSpin } from "./bass-engine.mjs";
import {
  NUMBERS as WHEEL_NUMBERS,
  outcome as wheelOutcome,
  settle as settleWheel,
} from "./grand-engine.mjs";
import { tableRound, tablePublic } from "./table-round.mjs";
export const IDS = [
  "velvet-vault",
  "velvet-roulette",
  "velvet-candy",
  "velvet-thunder",
  "velvet-sugar",
  "velvet-paw",
  "velvet-bass",
  "velvet-grand",
  "velvet-blackjack",
  "velvet-baccarat",
];
const requireValue = (ok, message) => {
  if (!ok) throw new Error(message);
};
export function publicState(state) {
  if (!state) return null;
  if (state.kind === "blackjack" || state.kind === "baccarat") return tablePublic(state);
  const { prizes, ...rest } = state;
  return rest;
}
export function resolveRound(game, input, state = null, balance = 0) {
  requireValue(IDS.includes(game), "Unknown game");
  if (game === "velvet-blackjack" || game === "velvet-baccarat")
    return tableRound(game, input, state, balance);
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
  if (game === "velvet-paw") {
    const pawInFeature = state?.kind === "paw" && state.remaining > 0;
    const pawStake = pawInFeature ? state.stake : input.stake;
    requireValue([10, 20, 50, 100, 200, 500].includes(pawStake), "Invalid stake");
    const spin = resolvePawSpin(pawStake, pawInFeature ? state : null);
    const nextRaw = spin.next && spin.next.remaining > 0 ? spin.next : null;
    const next = nextRaw ? { kind: "paw", stake: pawStake, ...nextRaw } : null;
    return {
      stake: pawInFeature ? 0 : pawStake,
      payout: spin.total / 100,
      result: spin,
      state: next,
    };
  }
  if (game === "velvet-bass") {
    const bassInFeature = state?.kind === "bass" && state.remaining > 0;
    const bassStake = bassInFeature ? state.stake : input.stake;
    requireValue([10, 20, 50, 100, 200, 500].includes(bassStake), "Invalid stake");
    const spin = resolveBassSpin(bassStake, bassInFeature ? state : null);
    const nextRaw = spin.next && spin.next.remaining > 0 ? spin.next : null;
    const next = nextRaw ? { kind: "bass", stake: bassStake, ...nextRaw } : null;
    return {
      stake: bassInFeature ? 0 : bassStake,
      payout: spin.total / 100,
      result: spin,
      state: next,
    };
  }
  if (game === "velvet-grand") {
    requireValue(
      input.bets && typeof input.bets === "object" && !Array.isArray(input.bets),
      "Invalid bets",
    );
    const entries = Object.entries(input.bets);
    requireValue(entries.length > 0 && entries.length <= 6, "Place 1-6 bets");
    const bets = {};
    for (const [k, v] of entries) {
      const n = Number(k),
        amt = Number(v);
      requireValue(WHEEL_NUMBERS.includes(n), "Invalid number");
      requireValue(Number.isInteger(amt) && amt > 0, "Invalid bet amount");
      bets[n] = amt;
    }
    const result = wheelOutcome();
    const settled = settleWheel(bets, result);
    return {
      stake: settled.stake,
      payout: settled.payout,
      result: { ...result, ...settled, bets },
      state: null,
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
