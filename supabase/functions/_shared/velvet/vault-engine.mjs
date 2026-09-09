export const SYMBOLS = [
  { name: "Diamond", pay: [8, 20, 60] },
  { name: "Gold bars", pay: [6, 15, 40] },
  { name: "Crown", pay: [5, 12, 30] },
  { name: "Emerald ring", pay: [4, 10, 25] },
  { name: "Ruby", pay: [3, 8, 20] },
  { name: "Pocket watch", pay: [2, 6, 15] },
  { name: "Master key", pay: [10, 30, 100] },
  { name: "Vault lock", pay: [0, 0, 0] },
  { name: "Star coin", pay: [2, 5, 12] },
];
export const LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
];
export function rand(n) {
  const a = new Uint32Array(1);
  const max = Math.floor(4294967296 / n) * n;
  do {
    crypto.getRandomValues(a);
  } while (a[0] >= max);
  return a[0] % n;
}
const weights = [18, 16, 14, 14, 12, 10, 1, 3, 10];
export function draw() {
  let r = rand(98);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 8;
}
export function makeGrid() {
  return Array.from({ length: 5 }, () => Array.from({ length: 3 }, draw));
}
export function evaluate(original, stake) {
  const grid = original.map((c) => [...c]);
  const locks = original.flat().filter((s) => s === 7).length;
  const expanded = [];
  grid.forEach((col, i) => {
    if (col.includes(6)) {
      grid[i] = [6, 6, 6];
      expanded.push(i);
    }
  });
  const wins = [];
  let total = 0;
  LINES.forEach((rows, line) => {
    const sequence = rows.map((r, c) => grid[c][r]);
    let best = 0,
      bestCount = 0,
      bestSymbol = 0;
    for (let symbol = 0; symbol < SYMBOLS.length; symbol++) {
      if (symbol === 7) continue;
      let count = 0;
      for (const s of sequence) {
        if (s === symbol || s === 6) count++;
        else break;
      }
      if (count >= 3) {
        const win = Math.round(((stake * 100) / 10) * SYMBOLS[symbol].pay[count - 3]);
        if (win > best) {
          best = win;
          bestCount = count;
          bestSymbol = symbol;
        }
      }
    }
    if (best) {
      total += best;
      wins.push({ line, rows, count: bestCount, symbol: bestSymbol, cents: best });
    }
  });
  return { grid, expanded, locks, wins, cents: total, bonus: locks >= 3 };
}
export function bonusPrizes() {
  const a = [2, 3, 5, 8, 12, 20];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
