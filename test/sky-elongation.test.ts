// /sky nextGreatestElongation() against JPL Horizons (observer ephemeris, geocentric, QUANTITIES 23 the Sun-observer-target angle, https://ssd.jpl.nasa.gov/api/horizons.api), read on 2026-11-17 one planet at a time and typed in by hand below; nothing was saved or downloaded.
// Horizons gives the angle at a series of moments, not the maximum: the maximum is the vertex of the parabola through the three rows around it.
//   Mercury: COMMAND 199, 6 hour step around 2026-02-19 17:00 UT.   Venus: COMMAND 299, 1 day step around 2026-08-15 06:00 UT.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextGreatestElongation } from "../src/sky.ts";

/** The vertex of the parabola through three equally spaced samples: [time offset from the middle one in steps, value]. */
const vertex = (a: number, b: number, c: number): [number, number] => {
  const offset = (0.5 * (a - c)) / (a - 2 * b + c);
  return [offset, b - 0.25 * (a - c) * offset];
};

test("Mercury's greatest elongation of February 2026 and Venus's of August 2026 are within 10 and 90 minutes of Horizons' and within 0.005 degrees, on the east side", () => {
  const [mOffset, mPeak] = vertex(18.1181, 18.1227, 18.1197);
  const mercury = Date.UTC(2026, 1, 19, 17) + mOffset * 6 * 3_600_000;
  const [vOffset, vPeak] = vertex(45.8886, 45.8923, 45.8889);
  const venus = Date.UTC(2026, 7, 15, 6) + vOffset * 86_400_000;
  const m = nextGreatestElongation("mercury", Date.UTC(2026, 0, 1));
  const v = nextGreatestElongation("venus", Date.UTC(2026, 0, 1));
  const mMin = (m.time.getTime() - mercury) / 60_000, vMin = (v.time.getTime() - venus) / 60_000;
  assert.ok(Math.abs(mMin) < 10, `Mercury ${mMin.toFixed(1)} min from Horizons`);
  assert.ok(Math.abs(vMin) < 90, `Venus ${vMin.toFixed(1)} min from Horizons (the curve is flat to 0.0004 degrees over a day)`);
  assert.ok(Math.abs(m.elongation - mPeak) < 0.005 && Math.abs(v.elongation - vPeak) < 0.005, `${m.elongation} against ${mPeak}, ${v.elongation} against ${vPeak}`);
  assert.equal(m.side, "east");
  assert.equal(v.side, "east");
  console.log(`greatest elongation: Mercury ${mMin.toFixed(1)} min and ${(m.elongation - mPeak).toFixed(4)} deg, Venus ${vMin.toFixed(1)} min and ${(v.elongation - vPeak).toFixed(4)} deg from Horizons`);
});

test("a morning elongation is west, a Date and its milliseconds agree, and a body that cannot have one, or a bad moment, throws", () => {
  const west = nextGreatestElongation("mercury", Date.UTC(2026, 2, 1));
  assert.equal(west.side, "west");
  assert.ok(west.elongation > 17 && west.elongation < 28 && west.time.getTime() > Date.UTC(2026, 2, 1));
  assert.deepEqual(nextGreatestElongation("mercury", new Date(Date.UTC(2026, 2, 1))), west);
  assert.throws(() => nextGreatestElongation("mars" as "venus", 0), (e: Error) => e instanceof RangeError && /mars/.test(e.message));
  assert.throws(() => nextGreatestElongation("venus", Number.NaN), RangeError);
});
