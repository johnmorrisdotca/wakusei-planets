import assert from "node:assert/strict";
import { test } from "node:test";
import { moonSizeFactor } from "../src/space/scale.ts";

test("true distances ignore moon size, and a squeezed view keeps the real order while it clamps", () => {
  assert.deepEqual(moonSizeFactor("true", "jupiter", 8, [{ radius: 0.04, orbit: 6 }]), { factor: 1, clamped: false });
  const open = moonSizeFactor("compressed", "jupiter", 4, [
    { radius: 0.02, orbit: 6 },
    { radius: 0.04, orbit: 10 },
  ]);
  assert.equal(open.factor, 4);
  assert.equal(open.clamped, false);
  assert.ok(0.04 * open.factor > 0.02 * open.factor);
  const tight = moonSizeFactor("compressed", "jupiter", 8, [
    { radius: 0.1, orbit: 1.7 },
    { radius: 0.02, orbit: 3 },
  ]);
  assert.ok(tight.factor < 8 && tight.factor >= 1);
  assert.equal(tight.clamped, true);
  assert.ok(0.1 * tight.factor <= 0.25 + 1e-9, "no moon larger than a quarter of the planet");
  assert.ok(0.1 * tight.factor <= 1.7 - 1.05 + 1e-9, "the moon does not reach the planet");
  assert.ok(0.02 * tight.factor < 0.1 * tight.factor);
});
