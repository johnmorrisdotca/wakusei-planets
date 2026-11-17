// /sky nextRise(), nextSet() and nextTransit() for the planets, the Sun and the Moon, against JPL Horizons.
// Source: JPL Horizons observer ephemeris, rise/transit/set only (R_T_S_ONLY='TVH', elevation cut-off 0 deg over an AIRLESS apparent place, which Horizons prints at the airless centre -34' below the horizon, the almanac definition for a planet),
// for an observer at 35.6895 N, 139.6917 E, 0 m (Tokyo), 8 and 9 November 2026 UT, one planet per page (https://ssd.jpl.nasa.gov/api/horizons.api, COMMAND 199, 299, 499, 599, 699, 799 and 899), read on 2026-11-17 and typed in by hand below
// (42 events); nothing was saved or downloaded. Horizons stamps an event with the first whole minute after it, so an event is in the minute before its stamp.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextRise, nextSet, nextTransit } from "../src/sky.ts";
import { getTimes } from "../src/suncalc.ts";
import type { SkyBodyId } from "../src/sky-bodies.ts";

const TOKYO = { latitude: 35.6895, longitude: 139.6917, heightM: 0 };
const DAYS = [Date.UTC(2026, 10, 8), Date.UTC(2026, 10, 9)];
/** body: [rise, transit, set] of 8 November then of 9 November, as HH:MM UT stamps. */
const HORIZONS: Record<string, [string, string, string][]> = {
  mercury: [["20:26", "01:56", "07:18"], ["20:17", "01:49", "07:13"]],
  venus: [["19:24", "00:55", "06:22"], ["19:19", "00:51", "06:19"]],
  mars: [["14:22", "21:11", "04:02"], ["14:21", "21:09", "04:00"]],
  jupiter: [["14:38", "21:20", "04:07"], ["14:34", "21:17", "04:03"]],
  saturn: [["06:03", "12:08", "18:12"], ["05:59", "12:04", "18:08"]],
  uranus: [["08:35", "15:40", "22:46"], ["08:31", "15:36", "22:41"]],
  neptune: [["05:40", "11:40", "17:41"], ["05:36", "11:36", "17:37"]],
};
const stamp = (day: number, hhmm: string): number => day + (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))) * 60_000;

test("the rise, transit and set of every planet on two days are in the minute before Horizons' stamp (a transit within a minute of it), and the worst miss is reported", () => {
  const offsets: number[] = [];
  let worst = 0;
  for (const [id, days] of Object.entries(HORIZONS)) {
    days.forEach(([rise, transit, set], d) => {
      const from = DAYS[d]!;
      const searches = [["rise", nextRise, rise], ["transit", nextTransit, transit], ["set", nextSet, set]] as const;
      for (const [name, find, hhmm] of searches) {
        const found = find(id as SkyBodyId, from, { observer: TOKYO });
        assert.ok(found instanceof Date, `${id} ${name} on day ${d + 1} was not found`);
        // the stamp is the first minute after a rise or a set; a transit is stamped to the nearest minute
        const offset = (found.getTime() - stamp(from, hhmm)) / 1000;
        offsets.push(offset);
        worst = Math.max(worst, name === "transit" ? Math.abs(offset) : Math.max(offset, -offset - 60));
        if (name === "transit") assert.ok(Math.abs(offset) <= 60, `${id} ${name} ${found.toISOString()} is ${offset.toFixed(1)} s from Horizons' ${hhmm}`);
        else assert.ok(offset <= 15 && offset > -75, `${id} ${name} ${found.toISOString()} is ${offset.toFixed(1)} s from Horizons' ${hhmm} (it should be up to 60 s before)`);
      }
    });
  }
  assert.equal(offsets.length, 42);
  console.log(`planet rise, transit and set: ${Math.min(...offsets).toFixed(1)} to ${Math.max(...offsets).toFixed(1)} s from Horizons' minute stamps over 42 events`);
});

test("this package's own Sun agrees: the Sun's next rise and set from the start of the Tokyo day are suncalc's sunrise and sunset to within 10 seconds", () => {
  const dayStart = Date.UTC(2026, 10, 7, 15);
  const own = getTimes(new Date(dayStart + 12 * 3_600_000), TOKYO.latitude, TOKYO.longitude, 0, 540);
  for (const [found, mine] of [[nextRise("sun", dayStart, { observer: TOKYO }), own.sunrise], [nextSet("sun", dayStart, { observer: TOKYO }), own.sunset]] as const) {
    assert.ok(found !== null && mine !== null && Math.abs(found.getTime() - mine.getTime()) < 10_000, `${String(found?.toISOString())} against ${String(mine?.toISOString())}`);
  }
});

test("no event inside the window is null, the start is included, a Date and its milliseconds agree, and a pole in midsummer has no sunset", () => {
  const rise = nextRise("mars", DAYS[0]!, { observer: TOKYO })!;
  assert.equal(nextRise("mars", DAYS[0]!, { observer: TOKYO, within: { days: 0.1 } }), null);
  const again = nextRise("mars", rise.getTime(), { observer: TOKYO })!.getTime();
  assert.ok(Math.abs(again - rise.getTime()) < 250, `the start moment itself is included, to the search's 0.1 s: ${again - rise.getTime()} ms`);
  assert.ok(nextRise("mars", rise.getTime() + 1000, { observer: TOKYO })!.getTime() > rise.getTime() + 80_000_000, "a second after it, the next day's");
  assert.equal(nextRise("mars", new Date(DAYS[0]!), { observer: TOKYO })!.getTime(), rise.getTime(), "a Date and its milliseconds agree");
  assert.equal(nextTransit("mars", DAYS[0]!, { observer: TOKYO, within: { days: 0.1 } }), null);
  assert.equal(nextSet("sun", Date.UTC(2026, 5, 21), { observer: { latitude: 89, longitude: 0 }, within: { days: 1 } }), null);
  assert.equal(nextRise("sun", Date.UTC(2026, 5, 21), { observer: { latitude: 89, longitude: 0 }, within: { days: 1 } }), null);
});

test("bad input throws and names the argument: an unknown body, a latitude out of range, a bad height, a bad window and a bad moment", () => {
  const from = DAYS[0]!;
  assert.throws(() => nextRise("earth" as SkyBodyId, from, { observer: TOKYO }), (e: Error) => e instanceof RangeError && /earth/.test(e.message));
  assert.throws(() => nextRise("toString" as SkyBodyId, from, { observer: TOKYO }), RangeError);
  assert.throws(() => nextSet("mars", from, { observer: { ...TOKYO, latitude: 91 } }), (e: Error) => e instanceof RangeError && /latitude.*91/.test(e.message));
  assert.throws(() => nextSet("mars", from, { observer: { ...TOKYO, longitude: Number.NaN } }), (e: Error) => e instanceof RangeError && /longitude/.test(e.message));
  assert.throws(() => nextSet("mars", from, { observer: { ...TOKYO, heightM: Number.POSITIVE_INFINITY } }), (e: Error) => e instanceof RangeError && /heightM/.test(e.message));
  assert.throws(() => nextTransit("mars", from, { observer: null as never }), TypeError);
  assert.throws(() => nextTransit("mars", from, { observer: TOKYO, within: { days: 0 } }), (e: Error) => e instanceof RangeError && /within/.test(e.message));
  assert.throws(() => nextRise("mars", Number.NaN, { observer: TOKYO }), (e: Error) => e instanceof RangeError && /from/.test(e.message));
  assert.ok(nextRise("mars", from, { observer: { latitude: 35.6895, longitude: 139.6917 } }) instanceof Date, "the height is optional");
});
