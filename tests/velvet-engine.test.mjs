import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRound, publicState } from "../supabase/functions/_shared/velvet/round.mjs";
import { settle } from "../supabase/functions/_shared/velvet/roulette-engine.mjs";
import {
  evaluateBoard,
  roundMultiplier,
} from "../supabase/functions/_shared/velvet/cascade-engine.mjs";
test("roulette pays zero correctly and validates bet instructions", () => {
  assert.equal(
    settle(0, [
      { key: "n:0", amount: 10 },
      { key: "red", amount: 10 },
      { key: "even", amount: 10 },
    ]),
    360,
  );
  assert.equal(
    settle(1, [
      { key: "red", amount: 10 },
      { key: "odd", amount: 10 },
      { key: "n:1", amount: 10 },
    ]),
    400,
  );
  for (const bets of [
    [{ key: "n:37", amount: 10 }],
    [{ key: "red", amount: -10 }],
    [{ key: "red", amount: 0 }],
    [],
  ])
    assert.throws(() => resolveRound("velvet-roulette", { action: "spin", bets }));
  for (let i = 0; i < 100; i++) {
    const bets = [
      { key: "red", amount: 50 },
      { key: "n:0", amount: 10 },
    ];
    const r = resolveRound("velvet-roulette", { action: "spin", bets });
    assert.equal(r.payout, settle(r.result.number, bets));
    assert.equal(r.stake, 60);
  }
});
test("vault bonus preserves choices across reload and hides unopened values", () => {
  let state = {
    kind: "vault",
    stake: 10,
    lineWin: 100,
    prizes: [2, 3, 5, 8, 12, 20],
    picks: [],
    total: 0,
  };
  assert.equal(publicState(state).prizes, undefined);
  assert.throws(() => resolveRound("velvet-vault", { action: "spin", stake: 10 }, state));
  const one = resolveRound("velvet-vault", { action: "pick", index: 5 }, state);
  assert.equal(one.stake, 0);
  assert.equal(one.payout, 200);
  assert.equal(one.state.total, 20000);
  assert.throws(() => resolveRound("velvet-vault", { action: "pick", index: 5 }, one.state));
  const two = resolveRound("velvet-vault", { action: "pick", index: 0 }, one.state),
    three = resolveRound("velvet-vault", { action: "pick", index: 2 }, two.state);
  assert.equal(three.payout, 50);
  assert.equal(three.state, null);
  assert.equal(three.result.complete, true);
});
test("free spins use stored stake and decrement once; storm charge persists", () => {
  for (const game of ["velvet-candy", "velvet-thunder"]) {
    let state = { kind: "cascade", remaining: 2, stake: 20, total: 0, charge: 7 };
    const r = resolveRound(game, { action: "spin", stake: 500, payout: 999999 }, state);
    assert.equal(r.stake, 0);
    assert.equal(r.state.remaining, 1);
    assert.equal(r.state.stake, 20);
    assert.equal(r.result.cents, r.result.base * r.result.multiplier);
    assert.equal(r.payout * 100, r.result.cents);
    assert.equal(resolveRound(game, { action: "spin" }, r.state).state, null);
  }
  assert.equal(roundMultiplier("thunder", true, 7, 3), 10);
  assert.equal(roundMultiplier("candy", true, 7, 3), 3);
});
test("server tumble boards explain every paid group", () => {
  for (const game of ["velvet-candy", "velvet-thunder"])
    for (let i = 0; i < 100; i++) {
      const r = resolveRound(game, { action: "spin", stake: 10 });
      let grid = r.result.initial,
        base = 0;
      assert.ok(r.result.steps.length <= 20);
      for (const step of r.result.steps) {
        const calculated = evaluateBoard(grid, 10);
        assert.equal(calculated.cents, step.evaluation.cents);
        assert.deepEqual([...calculated.remove], step.evaluation.remove);
        base += calculated.cents;
        if (step.next) grid = step.next.grid;
      }
      assert.equal(base, r.result.base);
      assert.equal(r.payout * 100, base * r.result.multiplier);
    }
});
