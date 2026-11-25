// The numbers `space.pathOf` draws a moon's ring from (MODULES-1790): the Moon's offset from the Earth over a fortnight. Held against a reference the package did not make: the geocentric Moon from astronomy-engine (a different
// ephemeris, JPL-calibrated), which sweeps 191.8 degrees round the Earth between 2026-10-26 14:00 and 2026-11-09 14:00 UTC (the mean 360 / 27.32 a day would say 184.5: the Moon is nearer perigee and faster in this
// fortnight), at 364,397 to 398,601 km from the Earth's centre.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonOffset } from "../src/scene/orient.ts";

const DAY = 86_400_000;
const START = Date.UTC(2026, 10, 2, 14);

test("the Moon's offset sweeps the reference's 191.8 degrees in the fortnight round 2026-11-02 14:00 UTC", () => {
  let swept = 0;
  let previous: readonly number[] | null = null;
  for (let i = 0; i <= 96; i += 1) {
    const at = moonOffset("moon", START - 7 * DAY + (14 * DAY * i) / 96);
    if (previous) {
      const dot = previous[0]! * at[0] + previous[1]! * at[1] + previous[2]! * at[2];
      swept += (Math.acos(Math.min(1, dot / (Math.hypot(...previous) * Math.hypot(...at)))) * 180) / Math.PI;
    }
    previous = at;
  }
  assert.ok(Math.abs(swept - 191.8) < 1, `swept ${swept.toFixed(2)} degrees`);
});

test("a sidereal month brings the Moon back to the same place round the Earth", () => {
  const a = moonOffset("moon", START);
  const b = moonOffset("moon", START + 27.321661 * DAY);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const degrees = (Math.acos(Math.min(1, dot / (Math.hypot(...a) * Math.hypot(...b)))) * 180) / Math.PI;
  assert.ok(degrees < 8, `${degrees.toFixed(1)} degrees apart after a sidereal month`);
});
