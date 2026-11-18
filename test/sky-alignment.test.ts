// /sky nextAlignment() (conjunction, opposition and quadrature by ecliptic longitude) and nextPeakMagnitude() against JPL Horizons (https://ssd.jpl.nasa.gov/api/horizons.api), read on 2026-11-17 one page at a time and typed in by hand below; nothing was saved or downloaded.
// Alignments: observer ephemeris, geocentric (CENTER 500@399), QUANTITIES 31 (the observer-centred IAU76/80 ecliptic-of-date longitude and latitude), a one-day step, for the body (COMMAND 599 Jupiter, 299 Venus, 499 Mars, 699 Saturn) and for the Sun (COMMAND 10) over the same days.
// Horizons has no event search, so the moment is where the longitude difference body minus Sun crosses the target (0, 180 or 270 degrees), found on the polynomial through the rows (the difference is smooth, a few hundredths of a degree of curvature over the five days).
// Peak magnitude: COMMAND 299 (Venus), QUANTITIES 9 (the apparent magnitude, APmag), a one-day step, 14 to 30 September 2026, typed in below; the peak is the vertex of the parabola through the five rows around the minimum.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAlignment, nextMoonPhase, nextPeakMagnitude } from "../src/sky.ts";

/** Each case: the first row's date (00:00 UT, one row a day), then the body's and the Sun's longitudes on those rows. */
const CASES = [
  { name: "Jupiter opposition, January 2026", body: "jupiter", kind: "opposition", target: 180, start: Date.UTC(2026, 0, 8),
    bodyLon: [110.4265264, 110.2917190, 110.1567668, 110.0217716, 109.8868613], sunLon: [287.7005487, 288.7194354, 289.7383426, 290.7572664, 291.7761983] },
  { name: "Venus superior conjunction, January 2026", body: "venus", kind: "conjunction", target: 0, start: Date.UTC(2026, 0, 4), inferior: false,
    bodyLon: [282.9811773, 284.2393043, 285.4973870, 286.7554248, 288.0134110], sunLon: [283.6251461, 284.6439885, 285.6628313, 286.6816823, 287.7005487] },
  { name: "Venus inferior conjunction, October 2026", body: "venus", kind: "conjunction", target: 0, start: Date.UTC(2026, 9, 22), inferior: true,
    bodyLon: [212.0623184, 211.4570944, 210.8460637, 210.2334277, 209.6234354], sunLon: [208.6060094, 209.6006532, 210.5957892, 211.5914352, 212.5876139] },
  { name: "Mars opposition, February 2027", body: "mars", kind: "opposition", target: 180, start: Date.UTC(2027, 1, 17),
    bodyLon: [151.8249684, 151.4287422, 151.0312554, 150.6332320, 150.2353969, 149.8384774], sunLon: [328.0847249, 329.0939098, 330.1026010, 331.1108028, 332.1185286, 333.1257992] },
  { name: "Saturn quadrature (west), July 2026", body: "saturn", kind: "quadrature", target: 270, start: Date.UTC(2026, 6, 4), side: "west",
    bodyLon: [14.3086661, 14.3461206, 14.3819631, 14.4161870, 14.4487881], sunLon: [102.0625591, 103.0158289, 103.9691510, 104.9225485, 105.8760440] },
] as const;

/** The moment (ms) when the polynomial through the rows' longitude difference, taken to within 180 degrees of the target, crosses zero. */
function horizonsCrossing(start: number, bodyLon: readonly number[], sunLon: readonly number[], target: number): number {
  const ys = bodyLon.map((lon, i) => { const d = lon - sunLon[i]! - target; return d - 360 * Math.round(d / 360); });
  const at = (x: number): number => ys.reduce((sum, y, i) => sum + y * ys.reduce((p, _, j) => (j === i ? p : (p * (x - j)) / (i - j)), 1), 0);
  let lo = 0, hi = ys.length - 1;
  assert.ok(at(lo) * at(hi) < 0, "the rows do not bracket the crossing");
  for (let i = 0; i < 60; i += 1) { const mid = (lo + hi) / 2; if (at(lo) * at(mid) <= 0) hi = mid; else lo = mid; }
  return start + ((lo + hi) / 2) * 86_400_000;
}

test("conjunctions, oppositions and a quadrature of five events in 2026 and 2027 are within 10 minutes of where Horizons' ecliptic longitudes cross, and the details (inferior, side) are right", () => {
  let worst = 0;
  for (const c of CASES) {
    const want = horizonsCrossing(c.start, c.bodyLon, c.sunLon, c.target);
    const found = nextAlignment(c.body, c.start - 86_400_000 * 3, { kind: c.kind });
    assert.ok(found !== null, c.name);
    assert.equal(found.kind, c.kind);
    const minutes = (found.time.getTime() - want) / 60_000;
    worst = Math.max(worst, Math.abs(minutes));
    assert.ok(Math.abs(minutes) < 10, `${c.name}: ${found.time.toISOString()} is ${minutes.toFixed(2)} min from Horizons' ${new Date(want).toISOString()}`);
    assert.equal(found.inferior, "inferior" in c ? c.inferior : null, `${c.name}: inferior`);
    assert.equal(found.side, "side" in c ? c.side : null, `${c.name}: side`);
    console.log(`${c.name}: ${minutes.toFixed(2)} min from Horizons`);
  }
  console.log(`alignments: worst ${worst.toFixed(2)} min from Horizons over ${CASES.length} events`);
});

test("the Moon's alignments are the new Moon, the full Moon and the quarters of nextMoonPhase (which the USNO table holds to 80 s), to within 3 minutes: this search uses apparent longitudes, which move an opposition by about a minute", () => {
  const from = Date.UTC(2026, 10, 1);
  const check = (kind: "conjunction" | "opposition" | "quadrature", phases: ("new" | "full" | "firstQuarter" | "lastQuarter")[]) => {
    const found = nextAlignment("moon", from, { kind })!;
    const expect = phases.map((phase) => nextMoonPhase(from, { phase })!.getTime()).sort((a, b) => a - b)[0]!;
    assert.ok(Math.abs(found.time.getTime() - expect) < 180_000, `${kind} ${found.time.toISOString()} against ${new Date(expect).toISOString()}`);
    return found;
  };
  check("conjunction", ["new"]);
  check("opposition", ["full"]);
  const quarter = check("quadrature", ["firstQuarter", "lastQuarter"]);
  assert.equal(quarter.side, nextMoonPhase(from, { phase: "firstQuarter" })!.getTime() < nextMoonPhase(from, { phase: "lastQuarter" })!.getTime() ? "east" : "west");
});

test("a Date and its milliseconds agree, the start is included, a window that holds none gives null, and impossible questions throw", () => {
  const jupiter = nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition" })!;
  assert.deepEqual(nextAlignment("jupiter", new Date(Date.UTC(2026, 0, 1)), { kind: "opposition" }), jupiter);
  assert.ok(Math.abs(nextAlignment("jupiter", jupiter.time, { kind: "opposition" })!.time.getTime() - jupiter.time.getTime()) < 250, "the start itself is included, to the search's 0.1 s");
  assert.equal(nextAlignment("jupiter", Date.UTC(2026, 0, 1), { kind: "opposition", within: { days: 5 } }), null, "none in five days");
  assert.ok(nextAlignment("jupiter", jupiter.time.getTime() + 1000, { kind: "opposition" })!.time.getTime() > jupiter.time.getTime() + 390 * 86_400_000, "a second after, the next year's");
  assert.throws(() => nextAlignment("venus", 0, { kind: "opposition" }), (e: Error) => e instanceof RangeError && /venus.*opposition/.test(e.message));
  assert.throws(() => nextAlignment("mercury", 0, { kind: "quadrature" }), RangeError);
  assert.throws(() => nextAlignment("sun", 0, { kind: "conjunction" }), (e: Error) => e instanceof RangeError && /sun/.test(e.message));
  assert.throws(() => nextAlignment("mars", 0, { kind: "trine" as "opposition" }), (e: Error) => e instanceof RangeError && /trine/.test(e.message));
  assert.throws(() => nextAlignment("mars", 0, { kind: "opposition", within: { days: -1 } }), (e: Error) => e instanceof RangeError && /within/.test(e.message));
  assert.throws(() => nextAlignment("earth" as "mars", 0, { kind: "opposition" }), RangeError);
  assert.throws(() => nextAlignment("mars", Number.NaN, { kind: "opposition" }), (e: Error) => e instanceof RangeError && /from/.test(e.message));
});

test("Venus's next peak magnitude (22 September 2026) is within 2.5 days and 0.04 magnitudes of Horizons' flat peak, and only Venus is supported", () => {
  // APmag 14 to 30 September at 00:00 UT, one row a day: -4.754 -4.762 -4.769 -4.777 -4.783 -4.789 -4.794 -4.798 -4.801 -4.803 -4.804 -4.804 -4.802 -4.799 -4.794 -4.788 -4.779.
  // (rows 23, 24 and 25 September: -4.803, -4.804, -4.804, the minimum of the series)
  const vertex = (y0: number, y1: number, y2: number): [number, number] => { const x = (0.5 * (y0 - y2)) / (y0 - 2 * y1 + y2); return [x, y1 - 0.25 * (y0 - y2) * x]; };
  const [offset, peakMag] = vertex(-4.804, -4.804, -4.802);
  const horizonsTime = Date.UTC(2026, 8, 25) + offset * 86_400_000;
  const found = nextPeakMagnitude("venus", Date.UTC(2026, 0, 1));
  const days = (found.time.getTime() - horizonsTime) / 86_400_000;
  assert.ok(Math.abs(days) < 2.5, `${found.time.toISOString()} is ${days.toFixed(2)} days from Horizons' ${new Date(horizonsTime).toISOString()}`);
  assert.ok(Math.abs(found.magnitude - peakMag) < 0.04, `${found.magnitude} against Horizons' ${peakMag}`);
  console.log(`peak magnitude of Venus: ${days.toFixed(2)} days and ${(found.magnitude - peakMag).toFixed(3)} mag from Horizons' vertex (the curve is flat to 0.003 over 4 days)`);
  assert.deepEqual(nextPeakMagnitude("venus", new Date(Date.UTC(2026, 0, 1))), found);
  const after = (nextPeakMagnitude("venus", found.time.getTime() + 1000).time.getTime() - found.time.getTime()) / 86_400_000;
  assert.ok(after > 50 && after < 100, `a second after it, the next peak is the other side of the inferior conjunction (24 October), ${after.toFixed(0)} days on`);
  assert.ok(nextPeakMagnitude("venus", Date.UTC(2027, 0, 1)).time.getTime() > Date.UTC(2028, 0, 1), "from 2027, the evening peak of 2028");
  assert.throws(() => nextPeakMagnitude("mars" as "venus", 0), (e: Error) => e instanceof RangeError && /venus only/.test(e.message) && /opposition/.test(e.message));
  assert.throws(() => nextPeakMagnitude("venus", Number.NaN), RangeError);
});
