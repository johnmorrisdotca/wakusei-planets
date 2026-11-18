// /sky localSolarEclipse() for the total solar eclipse of 12 August 2026 against NASA GSFC's central-line table for it,
// https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2026Aug12Tpath.html (Fred Espenak, NASA's Goddard Space Flight Center), read on 2026-11-17 in one page and typed in by hand below; nothing was saved or downloaded.
// The table gives points on the central line (latitude and longitude to 0.1 arc-minute, about 185 m), the UT minute at which the shadow's centre is there (the greatest eclipse at that point), the Sun's altitude (whole degrees), the path width and the central duration to 0.1 s.
// Its predictions use delta-T 71.4 s (a UT time does not depend on it) and leave out the lunar limb profile, which NASA says can change a duration by 1 to 3 seconds. So the positions are NASA's own: no city position is used.
// The only rows used are the six at 18:22 to 18:32 UT over the Atlantic and Spain. The earlier try with city tables (https://science.nasa.gov/eclipses/future-eclipses/total-solar-eclipse-on-august-12-2026/, whole local minutes, no coordinates) was dropped for that reason.
import assert from "node:assert/strict";
import { test } from "node:test";
import { localSolarEclipse } from "../src/sky.ts";

const DAY = Date.UTC(2026, 7, 12);
/** NASA's central line: UT minute, latitude (degrees, arc-minutes) north, longitude (degrees, arc-minutes) and east-or-west, Sun altitude, central duration in seconds. */
const LINE = [
  { time: "18:22", lat: [47, 6.1], lon: [11, 42.9, -1], altitude: 16, duration: 118.8 },
  { time: "18:24", lat: [45, 56.6], lon: [10, 11.4, -1], altitude: 14, duration: 116.1 },
  { time: "18:26", lat: [44, 42.8], lon: [8, 23.9, -1], altitude: 13, duration: 113.0 },
  { time: "18:28", lat: [43, 22.3], lon: [6, 11.3, -1], altitude: 10, duration: 109.3 },
  { time: "18:30", lat: [41, 49.0], lon: [3, 11.1, -1], altitude: 8, duration: 104.6 },
  { time: "18:32", lat: [39, 24.5], lon: [2, 57.0, 1], altitude: 2, duration: 95.8 },
] as const;

const worst = { peak: 0, duration: 0, altitude: 0 };

test("at six points on NASA's central line the eclipse is total, the peak is in NASA's minute to within 10 seconds (the engine runs about 6.5 s early at all six, an offset NASA's delta-T of 71.4 s and its ephemeris account for in part), the central duration is within 3 seconds of NASA's and the Sun's altitude within 1 degree", () => {
  for (const row of LINE) {
    const observer = { latitude: row.lat[0] + row.lat[1] / 60, longitude: row.lon[2] * (row.lon[0] + row.lon[1] / 60) };
    const e = localSolarEclipse(Date.UTC(2026, 7, 1), { observer })!;
    assert.equal(e.kind, "total", row.time);
    assert.equal(e.obscuration, 1);
    assert.ok(e.partialBegin.time < e.centralBegin!.time && e.centralBegin!.time < e.peak.time && e.peak.time < e.centralEnd!.time && e.centralEnd!.time < e.partialEnd.time);
    const peak = (e.peak.time.getTime() - (DAY + (Number(row.time.slice(0, 2)) * 60 + Number(row.time.slice(3))) * 60_000)) / 1000;
    const duration = (e.centralEnd!.time.getTime() - e.centralBegin!.time.getTime()) / 1000 - row.duration;
    const altitude = e.peak.altitude - row.altitude;
    worst.peak = Math.max(worst.peak, Math.abs(peak));
    worst.duration = Math.max(worst.duration, Math.abs(duration));
    worst.altitude = Math.max(worst.altitude, Math.abs(altitude));
    assert.ok(Math.abs(peak) <= 10, `${row.time}: peak ${e.peak.time.toISOString()} is ${peak.toFixed(2)} s from NASA's`);
    assert.ok(Math.abs(duration) <= 3, `${row.time}: central duration ${duration.toFixed(2)} s from NASA's ${row.duration}`);
    assert.ok(Math.abs(altitude) <= 1, `${row.time}: Sun at ${e.peak.altitude} degrees, NASA ${row.altitude}`);
    // the Sun is up at every contact up to the peak and the central phase
    for (const contact of [e.partialBegin, e.centralBegin!, e.peak, e.centralEnd!]) assert.ok(contact.altitude > -1 && contact.altitude < 30, `${row.time}: Sun at ${contact.altitude} degrees`);
  }
  console.log(`local total eclipse on NASA's central line, 6 points: peak worst ${worst.peak.toFixed(2)} s, central duration worst ${worst.duration.toFixed(2)} s, Sun's altitude worst ${worst.altitude.toFixed(2)} degrees from NASA`);
});

test("off the central line the eclipse is partial: no central phase, a smaller coverage than at the line, and the contacts are in order (a point in Brittany north of the line, no NASA figure for it)", () => {
  const e = localSolarEclipse(Date.UTC(2026, 7, 1), { observer: { latitude: 47.6, longitude: -3.2 } })!;
  assert.equal(e.kind, "partial");
  assert.equal(e.centralBegin, null);
  assert.equal(e.centralEnd, null);
  assert.ok(e.obscuration > 0 && e.obscuration < 1);
  assert.ok(e.partialBegin.time < e.peak.time && e.peak.time < e.partialEnd.time);
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
