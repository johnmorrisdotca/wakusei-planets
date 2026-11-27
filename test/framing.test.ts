import assert from "node:assert/strict";
import { test } from "node:test";
import { solveFraming, type FramingInput } from "../src/space/framing.ts";

function framing(radiusAt: (zoom: number) => number, beside = false): FramingInput {
  return {
    width: 300, height: 600, beside, host: beside ? "earth" : null,
    sample(zoom, _kind, companion) {
      const r = radiusAt(zoom);
      return { body: { x: 150, y: 300, r }, extent: r, companion: companion ? { x: 200, y: 300, r: 15 } : null };
    },
  };
}

const limits = { zoomMin: 0.1, zoomMax: 3.6 };

test("named framing sizes use the short side, accept an explicit zoom, and report the zoom limit", () => {
  const data = framing((zoom) => 100 * zoom);
  const whole = solveFraming(data, "whole", {}, limits)!;
  assert.ok(Math.abs(whole.zoom - 1) < 1e-5);
  assert.ok(Math.abs(whole.share - 2 / 3) < 1e-5);
  assert.equal(whole.clamped, false);
  const exact = solveFraming(data, "whole", { zoom: 2, companion: "sun" }, limits)!;
  assert.equal(exact.zoom, 2);
  assert.equal(exact.share, 4 / 3);
  assert.deepEqual(exact.companion, { x: 200, y: 300, r: 15 });
  const limited = solveFraming(data, "close", { share: 5 }, limits)!;
  assert.equal(limited.zoom, limits.zoomMax);
  assert.equal(limited.clamped, true);
  assert.equal(solveFraming(data, "whole", { share: -0.5 }, limits), null);
  assert.equal(solveFraming(data, "whole", { zoom: Infinity }, limits), null);
});

test("beside framing uses the first matching zoom when its field of view makes the size non-monotonic", () => {
  const data = framing((zoom) => Math.max(0, 200 - 100 * (zoom - 2) ** 2), true);
  const found = solveFraming(data, "whole", {}, limits)!;
  assert.ok(Math.abs(found.zoom - 1) < 1e-5);
  assert.equal(found.clamped, false);
  assert.notEqual(found.companion, null);
  const clamped = solveFraming(data, "close", {}, limits)!;
  assert.ok(Math.abs(clamped.zoom - 2) < 0.04);
  assert.equal(clamped.clamped, true);
});
