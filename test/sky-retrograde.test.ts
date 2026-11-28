// JPL Horizons observer tables, read 2026-11-28, centre 500@399 (geocentre), quantity 31 (apparent ecliptic longitude of date).
// Five samples around each extremum, two hours apart. The station comes from the vertex of an independent quadratic fit.
import assert from "node:assert/strict";
import { test } from "node:test";
import { retrogradeStations, SKY_RANGE, skyBody, type RetrogradeBodyId } from "../src/sky-bodies.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const BODIES = ["mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
const longitude = (body: RetrogradeBodyId, time: number): number => skyBody(body, time).eclipticDate.longitudeDeg;
const delta = (from: number, to: number): number => to - from - 360 * Math.round((to - from) / 360);

const HORIZONS = [
  { body: "jupiter", kind: "direct", centre: "2025-02-04T10:00Z", lon: [71.2783792, 71.2783479, 71.2783403, 71.2783565, 71.2783965] },
  { body: "mercury", kind: "retrograde", centre: "2025-03-15T07:00Z", lon: [9.5871632, 9.5885291, 9.5889079, 9.5883016, 9.5867122] },
  { body: "mercury", kind: "direct", centre: "2025-04-07T11:00Z", lon: [356.8276802, 356.8266970, 356.8263430, 356.8266169, 356.8275174] },
  { body: "neptune", kind: "retrograde", centre: "2025-07-04T21:00Z", lon: [2.1755110, 2.1755176, 2.1755205, 2.1755197, 2.1755152] },
  { body: "pluto", kind: "retrograde", centre: "2025-05-04T16:00Z", lon: [303.8186899, 303.8186956, 303.8186979, 303.8186966, 303.8186920] },
  { body: "venus", kind: "retrograde", centre: "2025-03-02T01:00Z", lon: [10.8352581, 10.8356260, 10.8357111, 10.8355132, 10.8350318] },
  { body: "venus", kind: "direct", centre: "2025-04-13T01:00Z", lon: [354.6254509, 354.6250307, 354.6248872, 354.6250199, 354.6254286] },
] as const;

test("seven 2025 stations agree with the extrema of JPL Horizons’ apparent longitude within one hour", () => {
  for (const row of HORIZONS) {
    const centre = Date.parse(row.centre);
    const offsets = [-4, -2, 0, 2, 4];
    const relative = row.lon.map((value) => delta(row.lon[2], value));
    // The five equally spaced offsets are symmetric. Subtract the mean of x² to separate a from the constant in a x² + b x + c.
    const a = relative.reduce((sum, y, i) => sum + (offsets[i]! ** 2 - 8) * y, 0) / 224;
    const b = relative.reduce((sum, y, i) => sum + offsets[i]! * y, 0) / 40;
    const expected = centre - (b / (2 * a)) * HOUR;
    assert.ok(Math.abs(expected - centre) < HOUR, row.centre);
    assert.equal(a < 0 ? "retrograde" : "direct", row.kind);
    const events = retrogradeStations(row.body, centre - DAY, centre + DAY);
    assert.equal(events.length, 1, row.centre);
    const event = events[0]!;
    assert.equal(event.kind, row.kind);
    assert.equal(event.body, row.body);
    assert.equal(event.accurate, true);
    const minutes = (event.time - expected) / 60_000;
    assert.ok(Math.abs(minutes) < 60, `${row.body} ${row.kind} is ${minutes.toFixed(2)} minutes from Horizons`);
    console.log(`${row.body} ${row.kind}: ${minutes.toFixed(2)} minutes from Horizons`);
  }
});

test("all eight bodies return chronological longitude extrema with their new direction", () => {
  for (const body of BODIES) {
    const from = Date.UTC(2025, 0, 1), to = Date.UTC(2026, 0, 1);
    const events = retrogradeStations(body, from, to);
    assert.ok(events.length > 0, body);
    for (const [index, event] of events.entries()) {
      const previous = events[index - 1];
      assert.ok(event.time >= from && event.time < to, body);
      if (previous) {
        assert.ok(previous.time < event.time, body);
        assert.notEqual(previous.kind, event.kind, body);
      }
      assert.ok(event.longitudeDeg >= 0 && event.longitudeDeg < 360, body);
      const at = longitude(body, event.time);
      assert.equal(event.longitudeDeg, at);
      const sign = event.kind === "direct" ? 1 : -1;
      assert.ok(sign * delta(longitude(body, event.time - 6 * HOUR), at) < 0, body);
      assert.ok(sign * delta(at, longitude(body, event.time + 6 * HOUR)) > 0, body);
    }
  }
});

test("a reported station belongs to exactly one of two spans split at its time", () => {
  const from = Date.UTC(2025, 2, 1), to = Date.UTC(2025, 4, 1);
  const events = retrogradeStations("mercury", from, to);
  assert.equal(events.length, 2);
  const first = events[0]!;
  assert.deepEqual(retrogradeStations("mercury", new Date(from), new Date(first.time)), []);
  assert.deepEqual(retrogradeStations("mercury", first.time, to), events);
  assert.deepEqual(retrogradeStations("mercury", first.time, first.time + 1), [first]);
  assert.deepEqual(retrogradeStations("mercury", first.time, first.time), []);
});

test("a crossing of zero longitude during a retrograde loop is not a station", () => {
  const from = Date.UTC(2025, 2, 26), to = Date.UTC(2025, 3, 2);
  assert.ok(longitude("mercury", from) < 10);
  assert.ok(longitude("mercury", to) > 350);
  assert.deepEqual(retrogradeStations("mercury", from, to), []);
});

test("the sky interval and the Pluto model accuracy are honoured", () => {
  for (const [from, to] of [[SKY_RANGE.from, SKY_RANGE.from + 365 * DAY], [SKY_RANGE.to - 365 * DAY, SKY_RANGE.to]] as const) {
    const events = retrogradeStations("pluto", from, to);
    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event.accurate === false));
  }
  for (const when of [Date.UTC(1800, 0, 1), Date.UTC(2200, 0, 1)]) {
    assert.deepEqual(retrogradeStations("pluto", when - 3 * DAY, when + 3 * DAY), []);
  }
  assert.throws(() => retrogradeStations("mars", SKY_RANGE.from - 1, SKY_RANGE.from), /1750.*2250/);
  assert.throws(() => retrogradeStations("mars", SKY_RANGE.to - DAY, SKY_RANGE.to + 1), /1750.*2250/);
  assert.throws(() => retrogradeStations("mars", SKY_RANGE.from + DAY, SKY_RANGE.from), /start.*end/);
  assert.throws(() => retrogradeStations("mars", new Date(NaN), SKY_RANGE.to), /valid Date/);
  assert.throws(() => retrogradeStations("moon" as RetrogradeBodyId, SKY_RANGE.from, SKY_RANGE.to), /moon/);
});
