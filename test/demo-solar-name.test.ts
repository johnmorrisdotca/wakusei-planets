// The demo's name for the whole solar system is the region name (MODULES-1014).
import assert from "node:assert/strict";
import { test } from "node:test";
import { WORDS } from "../demo/words.js";

test("the demo names the whole solar system the way the region does", () => {
  assert.equal(WORDS.ja.sp_goto_solar, "太陽系全体");
  assert.equal(WORDS.ja.sp_goto_inner, "内側の惑星");
  assert.match(WORDS.ja.sp_help, /太陽系全体まで/);
  assert.equal(WORDS.ja.sp_help.includes("太陽系ぜんぶ"), false);
});
