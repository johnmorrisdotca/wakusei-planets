// /sky moonPhases() and nextMoonPhase() against the US Naval Observatory's table of the Moon's phases for 2026 (UT, to the minute), with this package's own Moon as the second, independent check.
// Source: USNO Astronomical Applications Department, "Phases of the Moon" data service, https://aa.usno.navy.mil/api/moon/phases/year?year=2026, read on 2026-11-17 in one page and typed in by hand below
// (50 phases); nothing was saved or downloaded. The table is to the minute, so its own rounding is up to 30 seconds.
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonPhases, nextMoonPhase, type MoonPhaseName } from "../src/sky.ts";
import { getMoonIllumination } from "../src/suncalc.ts";

const NAMES: Record<string, MoonPhaseName> = { N: "new", F: "firstQuarter", U: "full", L: "lastQuarter" };
/** phase letter, month, day, hour, minute (UT) of every phase of 2026. */
const USNO = `U 1 3 10 03,L 1 10 15 48,N 1 18 19 52,F 1 26 04 47,U 2 1 22 09,L 2 9 12 43,N 2 17 12 01,F 2 24 12 27,U 3 3 11 38,L 3 11 09 38,N 3 19 01 23,F 3 25 19 18,
U 4 2 02 12,L 4 10 04 51,N 4 17 11 52,F 4 24 02 32,U 5 1 17 23,L 5 9 21 10,N 5 16 20 01,F 5 23 11 11,U 5 31 08 45,L 6 8 10 00,N 6 15 02 54,F 6 21 21 55,
U 6 29 23 56,L 7 7 19 29,N 7 14 09 43,F 7 21 11 05,U 7 29 14 36,L 8 6 02 21,N 8 12 17 37,F 8 20 02 46,U 8 28 04 18,L 9 4 07 51,N 9 11 03 27,F 9 18 20 44,
U 9 26 16 49,L 10 3 13 25,N 10 10 15 50,F 10 18 16 12,U 10 26 04 12,L 11 1 20 28,N 11 9 07 02,F 11 17 11 48,U 11 24 14 53,L 12 1 06 08,N 12 9 00 52,
F 12 17 05 42,U 12 24 01 28,L 12 30 18 59`.replace(/\s*\n\s*/g, "").split(",").map((row) => {
  const [letter, month, day, hour, minute] = row.trim().split(" ");
  return { phase: NAMES[letter!]!, at: Date.UTC(2026, Number(month) - 1, Number(day), Number(hour), Number(minute)) };
});
/** The table gives the minute with the seconds dropped (the engine is 11 to 80 s after the stamp, never before it, over the 50), so a stamp stands for the minute and the half after it: held to 90 seconds of the stamp. */
const TOLERANCE_MS = 90_000;

test("the 50 phases of 2026 are the USNO table's, in order and within 90 seconds, and the worst miss is reported", () => {
  assert.equal(USNO.length, 50);
  const got = moonPhases(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1));
  assert.equal(got.length, 50);
  let worst = 0;
  const signed: number[] = [];
  got.forEach((event, i) => {
    assert.equal(event.phase, USNO[i]!.phase, `phase ${i + 1}`);
    const miss = Math.abs(event.time.getTime() - USNO[i]!.at);
    signed.push((event.time.getTime() - USNO[i]!.at) / 1000);
    worst = Math.max(worst, miss);
    assert.ok(miss <= TOLERANCE_MS, `${event.phase} ${event.time.toISOString()} is ${miss / 1000} s from the USNO table`);
  });
  console.log(`moon phases: worst miss against USNO ${worst / 1000} s over 50 phases (${Math.min(...signed).toFixed(1)} to ${Math.max(...signed).toFixed(1)} s after the stamp)`);
});

test("this package's own Moon agrees: its cycle fraction at each found phase is 0, 0.25, 0.5 or 0.75 to within 0.016 (suncalc's phase is the angle between the Sun and the Moon on the sky, so the Moon's latitude, up to 5.1 degrees or 0.0142 of the cycle, shows at new and full)", () => {
  const target = { new: 0, firstQuarter: 0.25, full: 0.5, lastQuarter: 0.75 };
  for (const event of moonPhases(Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1))) {
    const miss = Math.abs((((getMoonIllumination(event.time).phase - target[event.phase]) % 1) + 1.5) % 1 - 0.5);
    assert.ok(miss < 0.016, `${event.phase} ${event.time.toISOString()}: own cycle fraction is ${miss} off`);
  }
});

test("the start of the interval is included and the end is not, and an end before the start throws", () => {
  const full = moonPhases(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 5))[0]!.time.getTime();
  assert.equal(moonPhases(full, full + 1).length, 1, "the start moment itself is included");
  assert.equal(moonPhases(full - 86_400_000, full).length, 0, "the end moment itself is not");
  assert.equal(moonPhases(full + 1, full + 86_400_000).length, 0);
  assert.deepEqual(moonPhases(full, full), []);
  assert.throws(() => moonPhases(full, full - 1), (e: Error) => e instanceof RangeError && /to/.test(e.message));
  assert.throws(() => moonPhases(Number.NaN, full), (e: Error) => e instanceof RangeError && /from/.test(e.message));
});

test("nextMoonPhase gives the next one of the kind, null outside its window, and the same answer for a Date and its milliseconds", () => {
  const from = Date.UTC(2026, 10, 7);
  const want = USNO.find((row) => row.phase === "full" && row.at > from)!.at;
  const found = nextMoonPhase(from, { phase: "full" });
  assert.ok(found instanceof Date && Math.abs(found.getTime() - want) <= TOLERANCE_MS);
  assert.equal(nextMoonPhase(new Date(from), { phase: "full" })!.getTime(), found!.getTime());
  assert.equal(nextMoonPhase(from, { phase: "full", within: { days: 3 } }), null);
  assert.ok(nextMoonPhase(from, { phase: "full", within: { days: 30 } }) !== null);
  for (const days of [0, -1, Number.NaN]) assert.throws(() => nextMoonPhase(from, { phase: "full", within: { days } }), RangeError);
  assert.throws(() => nextMoonPhase(from, { phase: "gibbous" as MoonPhaseName }), (e: Error) => e instanceof RangeError && /gibbous/.test(e.message));
});
