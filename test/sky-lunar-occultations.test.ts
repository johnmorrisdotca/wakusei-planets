import assert from "node:assert/strict";
import { test } from "node:test";
import { lunarOccultations } from "../src/sky.ts";
import { starByName } from "../src/stars.ts";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const antaresDate = Date.UTC(2025, 2, 20);
const antares = starByName("Antares")!;
const sydney = { latitude: -(33 + 56.8 / 60), longitude: 151 + 10.6 / 60 };

/** Degrees and decimal minutes from the station table, without a published height. */
function degrees(whole: number, minutes: number): number {
  return whole + (Math.sign(whole) * minutes) / 60;
}

/** Convert the table's UT column, recorded to a whole second, to a timestamp. */
function ut(date: number, clock: string): number {
  const seconds = clock.split(":").reduce((value, field) => 60 * value + Number(field), 0);
  return date + 1000 * seconds;
}

test("lunar occultation contacts match IOTA's UT predictions for eight stations", () => {
  // International Occultation Timing Association, archived predictions. Each row records the station's
  // E. Long and Latitude (degrees and minutes), then the Disappearance and Reappearance U.T. columns.
  const stations = [
    // https://web.archive.org/web/20250210/http://www.lunar-occultations.com/iota/bstar/0320zc2366.htm
    // SHA-256 ff23585a8382c297f4a014be108704d9fa1e525d763a401db22c0ecb9f2d78fc
    ["Antares", antaresDate, "27 AU Sydney", -33, 56.8, 151, 10.6, "14:57:04", "15:53:20"],
    ["Antares", antaresDate, "23 AU Perth", -31, 56.4, 115, 58.0, "14:40:43", "15:37:25"],
    ["Antares", antaresDate, "50 NZ Christchurch", -43, 29.4, 172, 31.9, "15:46:13", "16:43:05"],
    ["Antares", antaresDate, "22 AU Oakey", -27, 24.7, 151, 44.1, "15:05:50", "15:20:11"],
    // https://web.archive.org/web/20250115/http://www.lunar-occultations.com/iota/bstar/0111zc810.htm
    // SHA-256 b749b8653f9df812850c0d9d24a6149301df8f0c1fb512dfa8b2e73836bc482c
    ["Elnath", Date.UTC(2025, 0, 11), "34 ID Jakarta", -6, 16.0, 106, 53.5, "16:27:30", "17:44:42"],
    ["Elnath", Date.UTC(2025, 0, 11), "233 SG Singapore", 1, 21.3, 103, 59.2, "16:13:06", "17:42:45"],
    // https://web.archive.org/web/20250210/http://www.lunar-occultations.com/iota/bstar/0316zc1925.htm
    // SHA-256 e3606dd37ba2edf73305720b5b7a6922eca08852738f1962e1decdb0df524c0e
    ["Spica", Date.UTC(2025, 2, 16), "47 MG Antananarivo", -18, 47.8, 47, 28.7, "18:11:24", "18:59:14"],
    ["Spica", Date.UTC(2025, 2, 16), "68 MU Port Louis", -20, 10.0, 57, 20.9, "18:13:48", "19:20:27"],
  ] as const;
  for (const [name, date, station, lat, latMinutes, lon, lonMinutes, disappears, reappears] of stations) {
    const star = starByName(name)!;
    const observer = { latitude: degrees(lat, latMinutes), longitude: degrees(lon, lonMinutes) };
    const [event, extra] = lunarOccultations(star, date, date + DAY_MS, { observer });
    assert.ok(event, station);
    assert.equal(extra, undefined, station);
    assert.deepEqual(event.star, { hr: star.hr, name });
    assert.ok(event.disappearance.time < event.closest.time && event.closest.time < event.reappearance.time, station);
    for (const [contact, prediction] of [[event.disappearance, disappears], [event.reappearance, reappears]] as const) {
      const errorSeconds = Math.abs(contact.time.getTime() - ut(date, prediction)) / 1000;
      assert.ok(errorSeconds < 15, `${station} ${prediction} missed by ${errorSeconds} seconds`);
      assert.ok(contact.altitude > 0 && contact.altitude <= 90, station);
    }
  }
});

test("a short occultation can fall between hourly samples and a nearby observer can miss it", () => {
  const from = antaresDate + 15 * HOUR_MS;
  const to = from + HOUR_MS;
  const observer = { latitude: degrees(-27, 24.7), longitude: degrees(151, 44.1) };
  const [event] = lunarOccultations(antares, from, to, { observer });
  assert.ok(event);
  assert.ok(event.disappearance.time.getTime() > from && event.reappearance.time.getTime() < to);
  assert.deepEqual(lunarOccultations(antares, from, to, { observer: { ...observer, latitude: observer.latitude + 0.5 } }), []);
});

test("windows are half-open by closest approach and return contacts beyond their boundaries", () => {
  const options = { observer: sydney };
  const [event] = lunarOccultations(antares, antaresDate, antaresDate + DAY_MS, options);
  assert.ok(event);
  const peak = event.closest.time.getTime();
  assert.deepEqual(lunarOccultations(antares, new Date(peak), peak + 1, options), [event]);
  assert.deepEqual(lunarOccultations(antares, peak - 1, new Date(peak), options), []);
  assert.deepEqual(lunarOccultations(antares, peak, peak, options), []);
});

test("an occultation below the local horizon still gives signed altitudes", () => {
  const date = Date.UTC(2025, 2, 16);
  const [event] = lunarOccultations(starByName("Spica")!, date, date + DAY_MS, { observer: { latitude: 14.69, longitude: -17.44 } });
  assert.ok(event);
  assert.ok(event.disappearance.altitude < 0 && event.closest.altitude < 0 && event.reappearance.altitude < 0);
});

test("invalid windows and observers use the same errors as other /sky searches", () => {
  assert.throws(() => lunarOccultations(antares, 1, 0, { observer: sydney }), /to must not be before from/);
  assert.throws(() => lunarOccultations(antares, new Date(NaN), 0, { observer: sydney }), /from must be a valid Date/);
  assert.throws(() => lunarOccultations(antares, 0, Number.MAX_VALUE, { observer: sydney }), /representable as Dates/);
  assert.throws(() => lunarOccultations(antares, 0, 1, { observer: { latitude: 100, longitude: 0 } }), /latitude must be between/);
});
