import assert from "node:assert/strict";
import { test } from "node:test";
import { bodyHandsOn, passLineView } from "../src/body-hands.ts";
import { LINE_PORTRAIT_LIMITS, linePortraitLimits } from "../src/portrait/zoom-range.ts";

test("the line Earth takes the hands, and a shaded Earth drawn by another package does not", () => {
  assert.equal(bodyHandsOn(null, "line"), true);
  assert.equal(bodyHandsOn(null, undefined), true);
  assert.equal(bodyHandsOn("off", "line"), false);
  assert.equal(bodyHandsOn(null, "shaded"), false);
});

test("the body's camera is passed to a line globe that has setView, and ignored otherwise", () => {
  const seen: unknown[] = [];
  passLineView({ setView: (view: unknown) => seen.push(view) }, { yaw: 12, tilt: -4, zoom: 3, panX: 8, panY: -2 });
  assert.deepEqual(seen, [{ yaw: 12, tilt: -4, zoom: 3, panX: 8, panY: -2 }]);
  passLineView(undefined, { zoom: 2 });
  passLineView({}, { zoom: 2 });
  assert.equal(seen.length, 1);
});

test("a line portrait zooms to 50, the same ceiling as a body's line drawing, and a shaded look is left to its bodies", () => {
  assert.deepEqual(linePortraitLimits("line"), LINE_PORTRAIT_LIMITS);
  assert.equal(LINE_PORTRAIT_LIMITS.zoomMax, 50);
  assert.equal(linePortraitLimits("painted"), null);
  assert.equal(linePortraitLimits("realistic"), null);
});
