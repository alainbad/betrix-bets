export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const color = (n) => (n === 0 ? "green" : REDS.has(n) ? "red" : "black");
export function betReturn(n, key, amount) {
  if (key.startsWith("n:")) return n === Number(key.slice(2)) ? amount * 36 : 0;
  if (n === 0) return 0;
  let hit = false,
    mult = 2;
  if (key === "red" || key === "black") hit = color(n) === key;
  else if (key === "odd") hit = n % 2 === 1;
  else if (key === "even") hit = n % 2 === 0;
  else if (key === "low") hit = n <= 18;
  else if (key === "high") hit = n >= 19;
  else if (key.startsWith("dozen:")) {
    hit = Math.ceil(n / 12) === Number(key.slice(6));
    mult = 3;
  } else if (key.startsWith("column:")) {
    hit = ((n - 1) % 3) + 1 === Number(key.slice(7));
    mult = 3;
  }
  return hit ? amount * mult : 0;
}
export function settle(n, bets) {
  return bets.reduce((sum, b) => sum + betReturn(n, b.key, b.amount), 0);
}
