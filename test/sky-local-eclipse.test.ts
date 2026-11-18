// /sky localSolarEclipse() for the total solar eclipse of 12 August 2026 against NASA's table of cities, https://science.nasa.gov/eclipses/future-eclipses/total-solar-eclipse-on-august-12-2026/ (NASA Science), read on 2026-11-17 in one page and typed in by hand below; nothing was saved or downloaded.
// The page gives "All times are local" to the whole minute (Spain on CEST, UT+2; the U.K. on BST, UT+1), the contacts of the cities in the path of totality (partial begins, totality begins, totality ends, partial ends) and, for cities outside it, partial begins, maximum, coverage and partial ends.
// A star after a partial-ends time means the eclipse ends after sunset and the time shown is the sunset time.
// The page has no coordinates: the cities below are placed at their centres to 0.01 degree (about a kilometre), typed in by hand from the cities' well-known positions, not from a source; a shift of 0.05 degrees moves a contact by under 10 seconds (checked), which is within the tolerance.
// NASA stamps the whole minute, and not by one rule that the engine's seconds show (some stamps drop the seconds, others round), so a contact is taken as right when it is within 60 seconds of the stamp; the worst measured is printed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { localSolarEclipse, riseSetTimes } from "../src/sky.ts";

const DAY = Date.UTC(2026, 7, 12);
/** A local stamp "H:MM" (24-hour) on 12 August 2026 at a UT offset in hours, as a UT moment in ms. */
const at = (hhmm: string, offsetHours: number): number => DAY + (Number(hhmm.split(":")[0]) * 60 + Number(hhmm.split(":")[1])) * 60_000 - offsetHours * 3_600_000;

/** Cities in the path of totality: latitude, longitude, partial begins, totality begins, totality ends, partial ends (sunset: the time is the sunset). */
const TOTAL = [
  { city: "Valencia", latitude: 39.47, longitude: -0.38, zone: "Europe/Madrid", c1: "19:38", c2: "20:32", c3: "20:33", c4: "21:01", sunset: true },
  { city: "Zaragoza", latitude: 41.65, longitude: -0.89, zone: "Europe/Madrid", c1: "19:34", c2: "20:29", c3: "20:30", c4: "21:07", sunset: true },
  { city: "Leon", latitude: 42.6, longitude: -5.57, zone: "Europe/Madrid", c1: "19:32", c2: "20:28", c3: "20:30", c4: "21:22", sunset: false },
];
/** Cities outside it: partial begins, maximum, coverage in percent, partial ends. */
const PARTIAL = [
  { city: "Barcelona", latitude: 41.39, longitude: 2.17, offset: 2, c1: "19:35", max: "20:29", percent: 99, c4: "20:54", sunset: true },
  { city: "London", latitude: 51.51, longitude: -0.13, offset: 1, c1: "18:17", max: "19:13", percent: 91, c4: "20:06", sunset: false },
];

let worst = 0;
const check = (label: string, found: Date, stamp: number): void => {
  const seconds = (found.getTime() - stamp) / 1000;
  worst = Math.max(worst, Math.abs(seconds));
  assert.ok(Math.abs(seconds) <= 60, `${label}: ${found.toISOString()} is ${seconds.toFixed(1)} s from NASA's stamp`);
};

test("the contacts of three cities in the path of totality are in NASA's minutes: the eclipse is total, the contacts are in order, and the Sun's altitude is the one the star says (below the horizon at the end where NASA's time is sunset)", () => {
  for (const c of TOTAL) {
    const e = localSolarEclipse(Date.UTC(2026, 7, 1), { observer: { latitude: c.latitude, longitude: c.longitude } })!;
    assert.equal(e.kind, "total", c.city);
    assert.equal(e.obscuration, 1);
    check(`${c.city} C1`, e.partialBegin.time, at(c.c1, 2));
    check(`${c.city} C2`, e.centralBegin!.time, at(c.c2, 2));
    check(`${c.city} C3`, e.centralEnd!.time, at(c.c3, 2));
    assert.ok(e.partialBegin.time < e.centralBegin!.time && e.centralBegin!.time < e.peak.time && e.peak.time < e.centralEnd!.time && e.centralEnd!.time < e.partialEnd.time);
    // the Sun is up at every contact but the last: totality is within an hour of sunset
    for (const contact of [e.partialBegin, e.centralBegin!, e.peak, e.centralEnd!]) assert.ok(contact.altitude > 0 && contact.altitude < 20, `${c.city}: Sun at ${contact.altitude} degrees`);
    const sunset = riseSetTimes("sun", DAY + 12 * 3_600_000, { observer: { latitude: c.latitude, longitude: c.longitude }, timeZone: c.zone }).set!;
    if (c.sunset) {
      check(`${c.city} sunset is NASA's partial end`, sunset, at(c.c4, 2));
      assert.ok(e.partialEnd.time > sunset && e.partialEnd.altitude < 0, `${c.city}: the eclipse ends after sunset, the Sun at ${e.partialEnd.altitude} degrees`);
    } else {
      check(`${c.city} C4`, e.partialEnd.time, at(c.c4, 2));
      assert.ok(e.partialEnd.time < sunset && e.partialEnd.altitude > 0, `${c.city}: the eclipse ends before sunset, the Sun at ${e.partialEnd.altitude} degrees`);
    }
  }
  console.log(`local total eclipse, 3 cities, 12 contacts and 2 sunsets: worst ${worst.toFixed(1)} s from NASA's whole-minute stamp`);
});

test("two cities outside the path see a partial eclipse: no C2 or C3, NASA's partial begin, maximum and partial end, and its coverage to a percent", () => {
  for (const c of PARTIAL) {
    const e = localSolarEclipse(Date.UTC(2026, 7, 1), { observer: { latitude: c.latitude, longitude: c.longitude } })!;
    assert.equal(e.kind, "partial", c.city);
    assert.equal(e.centralBegin, null);
    assert.equal(e.centralEnd, null);
    check(`${c.city} C1`, e.partialBegin.time, at(c.c1, c.offset));
    check(`${c.city} maximum`, e.peak.time, at(c.max, c.offset));
    if (c.sunset) assert.ok(e.partialEnd.altitude < 0 && e.peak.altitude > 0, `${c.city}: ends after sunset`);
    else check(`${c.city} C4`, e.partialEnd.time, at(c.c4, c.offset));
    assert.ok(Math.abs(e.obscuration * 100 - c.percent) <= 1, `${c.city}: ${e.obscuration * 100} percent, NASA ${c.percent}`);
  }
  console.log(`local eclipse, all 5 cities' contacts and maxima: worst ${worst.toFixed(1)} s from NASA's whole-minute stamp`);
});

test("a Date and its milliseconds agree, the start is included, a second after the peak the next eclipse is found, the window is respected, and bad input throws", () => {
  const observer = { latitude: 41.65, longitude: -0.89 };
  const first = localSolarEclipse(Date.UTC(2026, 7, 1), { observer })!;
  assert.deepEqual(localSolarEclipse(new Date(Date.UTC(2026, 7, 1)), { observer }), first);
  assert.deepEqual(localSolarEclipse(first.peak.time.getTime(), { observer }), first, "the start is included");
  const after = localSolarEclipse(first.peak.time.getTime() + 1000, { observer })!;
  assert.ok(after.peak.time.getTime() > Date.UTC(2026, 8, 1), "a second after the peak, the next eclipse seen from there");
  assert.equal(localSolarEclipse(Date.UTC(2026, 7, 1), { observer, within: { days: 5 } }), null, "none in five days");
  assert.equal(localSolarEclipse(Date.UTC(2026, 7, 1), { observer, within: { days: 12 } })!.kind, "total");
  assert.throws(() => localSolarEclipse(Date.UTC(2026, 7, 1), { observer: { latitude: 100, longitude: 0 } }), RangeError);
  assert.throws(() => localSolarEclipse(Date.UTC(2026, 7, 1), { observer: { latitude: 0, longitude: 0 }, within: { days: 0 } }), (e: Error) => e instanceof RangeError && /within/.test(e.message));
  assert.throws(() => localSolarEclipse(Number.NaN, { observer: { latitude: 0, longitude: 0 } }), RangeError);
});
