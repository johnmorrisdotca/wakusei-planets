// The freeze tests' bound on a running clock: at most one draw a screen refresh, counted in the same window (MODULES-1740). The old fixed bound, 2 x 61 draws in 2 s, was over by one on a hosted runner.
import assert from "node:assert/strict";
import { test } from "node:test";
import { atMostOnePerRefresh } from "../e2e/refresh-bound.ts";

const OLD_BOUND = (draws: number): boolean => draws <= 2 * 61;

test("a window that holds 123 refreshes may hold 123 draws, which the fixed bound of 122 refused", () => {
  // 61 refreshes a second over a window a little over two seconds (the wait and two round trips to the page): 123 ticks and a draw on each
  assert.equal(OLD_BOUND(123), false, "the old bound fails an honest run at the edge");
  assert.equal(atMostOnePerRefresh(123, 123), true);
  // the frame that straddles the start of the window is one more draw than the window's own ticks
  assert.equal(atMostOnePerRefresh(124, 123), true);
  assert.equal(atMostOnePerRefresh(125, 123), false);
});

test("two draws a refresh fail whatever the refresh rate is: at 30, 60 and 120 a second", () => {
  for (const refreshes of [61, 123, 241]) {
    assert.equal(atMostOnePerRefresh(refreshes * 2, refreshes), false, `${refreshes} refreshes, ${refreshes * 2} draws`);
    assert.equal(atMostOnePerRefresh(refreshes, refreshes), true);
    assert.equal(atMostOnePerRefresh(0, refreshes), true);
  }
  // a double request at 30 a second (about 60 draws in 2 s) is under the old fixed bound: only the refresh count can see it
  assert.equal(OLD_BOUND(2 * 61 - 1), true);
  assert.equal(atMostOnePerRefresh(2 * 61 - 1, 61), false);
});
