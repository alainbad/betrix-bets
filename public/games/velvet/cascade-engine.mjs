import { rand } from "./vault-engine.mjs";
export const PAY = [
  [2, 5, 12],
  [1.5, 3, 8],
  [1, 2, 5],
  [0.8, 1.5, 4],
  [0.6, 1.2, 3],
  [0.4, 0.8, 2],
  [0, 0, 0],
  [0, 0, 0],
  [0.2, 0.5, 1],
];
export const CONFIG = {
  candy: {
    name: "Candy Cascade",
    feature: "Sugar celebration",
    free: 10,
    weights: [10, 11, 12, 13, 14, 15, 2, 1, 16],
    multipliers: [2, 3, 5, 8, 10, 20],
    symbols: [
      "Heart jelly",
      "Rainbow sweet",
      "Star gummy",
      "Citrus drop",
      "Grape gummy",
      "Cherry candy",
      "Golden lollipop",
      "Sugar potion",
      "Apple candy",
    ],
  },
  thunder: {
    name: "Temple of Thunder",
    feature: "Storm ascension",
    free: 8,
    weights: [10, 11, 12, 13, 14, 15, 2, 1, 16],
    multipliers: [2, 4, 6, 10, 25, 50],
    symbols: [
      "Sapphire",
      "Golden goblet",
      "Amethyst",
      "Emerald",
      "Ruby",
      "Winged helmet",
      "Storm medallion",
      "Lightning orb",
      "Turquoise ring",
    ],
  },
};
export function drawCell(theme, rng = rand) {
  const cfg = CONFIG[theme];
  let n = rng(cfg.weights.reduce((a, b) => a + b));
  let s = 0;
  for (; s < cfg.weights.length - 1; s++) {
    n -= cfg.weights[s];
    if (n < 0) break;
  }
  return { s, m: s === 7 ? cfg.multipliers[rng(100) < 70 ? rng(3) : 3 + rng(3)] : 0 };
}
export function makeBoard(theme, draw = () => drawCell(theme)) {
  return Array.from({ length: 6 }, () => Array.from({ length: 5 }, draw));
}
export function evaluateBoard(grid, stake) {
  const groups = new Map();
  grid.forEach((col, c) =>
    col.forEach((cell, r) => {
      if (cell.s === 6 || cell.s === 7) return;
      if (!groups.has(cell.s)) groups.set(cell.s, []);
      groups.get(cell.s).push(c + ":" + r);
    }),
  );
  const wins = [];
  const remove = new Set();
  let cents = 0;
  for (const [s, positions] of groups) {
    const count = positions.length;
    if (count < 8) continue;
    const mult = PAY[s][count >= 12 ? 2 : count >= 10 ? 1 : 0],
      amount = Math.round(stake * 100 * mult);
    wins.push({ s, count, cents: amount });
    positions.forEach((p) => remove.add(p));
    cents += amount;
  }
  let multiplier = 0;
  if (wins.length)
    grid.forEach((col, c) =>
      col.forEach((cell, r) => {
        if (cell.s === 7) {
          multiplier += cell.m;
          remove.add(c + ":" + r);
        }
      }),
    );
  return { wins, remove, cents, multiplier };
}
export function collapse(grid, remove, draw) {
  const falls = [];
  const next = grid.map((col, c) => {
    const keep = col.map((cell, r) => ({ cell, r })).filter((x) => !remove.has(c + ":" + x.r));
    const missing = 5 - keep.length;
    falls[c] = [
      ...Array.from({ length: missing }, (_, r) => missing + 1),
      ...keep.map((x, i) => missing + i - x.r),
    ];
    return [...Array.from({ length: missing }, draw), ...keep.map((x) => x.cell)];
  });
  return { grid: next, falls };
}
export function roundMultiplier(theme, inFeature, charge, collected) {
  return Math.max(1, theme === "thunder" && inFeature ? charge + collected : collected);
}
export const scatterCount = (grid) => grid.flat().filter((c) => c.s === 6).length;
