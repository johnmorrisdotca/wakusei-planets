// /sky findEclipses() against NASA's eclipse predictions for 2021 to 2030 (Fred Espenak, NASA GSFC): the type and the time of greatest eclipse of every solar and lunar eclipse of the decade.
// Sources, each read on 2026-11-17 in one page and typed in by hand below (nothing saved or downloaded):
//   solar: https://eclipse.gsfc.nasa.gov/SEdecade/SEdecade2021.html (22 eclipses: date, TD of greatest eclipse, type, magnitude)
//   lunar: https://eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html (22 eclipses: date, TD of greatest eclipse, type, umbral magnitude, negative for a penumbral eclipse)
// NASA gives dynamical time (TD); the engine's moments are UT. TD is UT plus delta-T, taken as 69 seconds for the decade (the real figure is 69 to 70 and NASA's 2013 prediction is a little over 70).
import assert from "node:assert/strict";
import { test } from "node:test";
import { findEclipses, type SkyEclipse } from "../src/sky.ts";

const DELTA_T_S = 69;
/** The plan hoped for about a minute; the measured worst (9 and 13 s) is printed. */
const TOLERANCE_S = 30;

/** date (y-m-d), TD hh:mm:ss of greatest eclipse, NASA type letter (T total, A annular, H hybrid, P partial), magnitude. */
const SOLAR = `2021-06-10 10:43:06 A 0.943,2021-12-04 07:34:38 T 1.037,2022-04-30 20:42:36 P 0.640,2022-10-25 11:01:19 P 0.862,2023-04-20 04:17:55 H 1.013,2023-10-14 18:00:40 A 0.952,
2024-04-08 18:18:29 T 1.057,2024-10-02 18:46:13 A 0.933,2025-03-29 10:48:36 P 0.938,2025-09-21 19:43:04 P 0.855,2026-02-17 12:13:05 A 0.963,2026-08-12 17:47:05 T 1.039,
2027-02-06 16:00:47 A 0.928,2027-08-02 10:07:49 T 1.079,2028-01-26 15:08:58 A 0.921,2028-07-22 02:56:39 T 1.056,2029-01-14 17:13:47 P 0.871,2029-06-12 04:06:13 P 0.458,
2029-07-11 15:37:18 P 0.230,2029-12-05 15:03:57 P 0.891,2030-06-01 06:29:13 A 0.944,2030-11-25 06:51:37 T 1.047`;
/** date, TD of greatest eclipse, NASA type letter (T total, P partial, N penumbral), umbral magnitude. */
const LUNAR = `2021-05-26 11:19:53 T 1.009,2021-11-19 09:04:06 P 0.974,2022-05-16 04:12:42 T 1.414,2022-11-08 11:00:22 T 1.359,2023-05-05 17:24:05 N -0.046,2023-10-28 20:15:18 P 0.122,
2024-03-25 07:13:59 N -0.132,2024-09-18 02:45:25 P 0.085,2025-03-14 06:59:56 T 1.178,2025-09-07 18:12:58 T 1.362,2026-03-03 11:34:52 T 1.151,2026-08-28 04:14:04 P 0.930,
2027-02-20 23:14:06 N -0.057,2027-07-18 16:04:09 N -1.068,2027-08-17 07:14:59 N -0.525,2028-01-12 04:14:13 P 0.066,2028-07-06 18:20:57 P 0.389,2028-12-31 16:53:15 T 1.246,
2029-06-26 03:23:22 T 1.844,2029-12-20 22:43:12 T 1.117,2030-06-15 18:34:34 P 0.502,2030-12-09 22:28:51 N -0.163`;

const rows = (text: string) => text.replace(/\s*\n\s*/g, "").split(",").map((row) => {
  const [date, time, letter, magnitude] = row.trim().split(" ");
  return { utMs: Date.parse(`${date}T${time}Z`) - DELTA_T_S * 1000, letter: letter!, magnitude: Number(magnitude) };
});
const KINDS: Record<string, SkyEclipse["kind"][]> = { T: ["total"], A: ["annular"], H: ["total", "annular"], P: ["partial"], N: ["penumbral"] };

const found = findEclipses(Date.UTC(2021, 0, 1), Date.UTC(2031, 0, 1));

for (const [type, table] of [["solar", rows(SOLAR)], ["lunar", rows(LUNAR)]] as const) {
  test(`all ${table.length} ${type} eclipses of 2021 to 2030 are found, none more, each of NASA's type and within 30 seconds of its time of greatest eclipse`, () => {
    const mine = found.filter((eclipse) => eclipse.type === type);
    assert.equal(mine.length, table.length, `${mine.length} ${type} eclipses found, NASA lists ${table.length}`);
    let worst = 0;
    mine.forEach((eclipse, i) => {
      const want = table[i]!;
      const miss = Math.abs(eclipse.peak.getTime() - want.utMs) / 1000;
      worst = Math.max(worst, miss);
      assert.ok(KINDS[want.letter]!.includes(eclipse.kind), `${type} ${eclipse.peak.toISOString()} is ${eclipse.kind}, NASA says ${want.letter}`);
      assert.ok(miss <= TOLERANCE_S, `${type} ${eclipse.peak.toISOString()} is ${miss.toFixed(1)} s from NASA's greatest eclipse`);
    });
    console.log(`${type} eclipses: worst miss against NASA ${worst.toFixed(1)} s over ${table.length}`);
  });
}

test("a solar eclipse's obscuration agrees with NASA's magnitude: 1 for a total one, about the magnitude squared for an annular one, and none for a partial one", () => {
  const table = rows(SOLAR);
  found.filter((eclipse) => eclipse.type === "solar").forEach((eclipse, i) => {
    const want = table[i]!;
    if (eclipse.kind === "total") assert.equal(eclipse.obscuration, 1);
    else if (eclipse.kind === "annular") assert.ok(Math.abs(eclipse.obscuration! - want.magnitude ** 2) < 0.03, `annular ${eclipse.peak.toISOString()}: obscuration ${eclipse.obscuration}, magnitude ${want.magnitude}`);
    else assert.equal(eclipse.obscuration, undefined);
  });
});

test("the eclipses come in time order, the start is included and the end is not, a Date and its milliseconds agree, and bad bounds throw", () => {
  for (let i = 1; i < found.length; i += 1) assert.ok(found[i]!.peak > found[i - 1]!.peak);
  const first = found[0]!.peak.getTime();
  assert.equal(findEclipses(first, first + 1).length, 1);
  assert.equal(findEclipses(first - 86_400_000, first).length, 0);
  assert.equal(findEclipses(first + 1, first + 86_400_000).length, 0, "an eclipse that peaked a moment before the start is not in the interval");
  const solar = found.find((eclipse) => eclipse.type === "solar")!.peak.getTime();
  assert.equal(findEclipses(solar + 1, solar + 86_400_000).length, 0);
  assert.equal(findEclipses(solar - 60_000, solar + 60_000).length, 1, "a start a minute before the peak still finds it");
  assert.deepEqual(findEclipses(new Date(first), new Date(first + 1)), findEclipses(first, first + 1));
  assert.deepEqual(findEclipses(first, first), []);
  assert.throws(() => findEclipses(first, first - 1), RangeError);
  assert.throws(() => findEclipses("2026" as unknown as number, first), TypeError);
});
