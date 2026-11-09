import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, MOONS_OF, PLANET_IDS } from "../src/index.ts";
import { ageOn, nextBirthdayOn, surfaceGravity, weightOn, WORLD_IDS, type WorldId } from "../src/kids.ts";

const DAY = 86_400_000;
const close = (got: number, want: number, slack: number, what: string): void => assert.ok(Math.abs(got - want) <= slack, `${what}: ${got} is not within ${slack} of ${want}`);

test("the worlds: the Sun, the eight planets and Pluto, then the moons that have a mass (Nereid has none)", () => {
  assert.deepEqual(WORLD_IDS.slice(0, 10), ["sun", ...PLANET_IDS]);
  assert.ok(!(WORLD_IDS as readonly string[]).includes("nereid"));
  assert.ok(!(WORLD_IDS as readonly string[]).includes("ceres"));
  const moons = (["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const).flatMap((host) => MOONS_OF[host]).filter((id) => id !== "nereid");
  assert.deepEqual(WORLD_IDS.slice(10), moons);
});

test("weight: the Earth is 1, the Moon about a sixth, Mars about 0.38, Jupiter about 2.53 at its cloud tops", () => {
  close(weightOn("earth", 30), 30, 1e-12, "Earth");
  close(surfaceGravity("moon").relativeToEarth, 0.165, 0.002, "Moon");
  close(weightOn("moon", 30), 30 * 0.1658, 0.05, "Moon, 30 kg");
  close(surfaceGravity("mars").relativeToEarth, 0.38, 0.002, "Mars");
  close(surfaceGravity("jupiter").relativeToEarth, 2.53, 0.01, "Jupiter");
  close(weightOn("jupiter", 40), 101.2, 0.5, "Jupiter, 40 kg");
});

test("weight: the other worlds against NASA's published surface gravity (m/s2), within 1 percent", () => {
  const nasa: Partial<Record<WorldId, number>> = { sun: 274, mercury: 3.70, venus: 8.87, earth: 9.80, moon: 1.62, mars: 3.71, jupiter: 24.79, saturn: 10.44, uranus: 8.87, neptune: 11.15, pluto: 0.62 };
  for (const [id, g] of Object.entries(nasa) as [WorldId, number][]) {
    close(surfaceGravity(id).metresPerSecondSquared, g, g * 0.01, id);
  }
});

test("weight is in the unit you give, so pounds work as well as kilograms, and a bad weight is refused", () => {
  close(weightOn("mars", 66) / weightOn("mars", 30), 66 / 30, 1e-12, "linear");
  assert.equal(weightOn("mars", 0), 0);
  assert.throws(() => weightOn("mars", -1), RangeError);
  assert.throws(() => weightOn("mars", Number.NaN), RangeError);
  assert.throws(() => weightOn("ceres" as WorldId, 30), RangeError);
});

test("every gravity says where it is measured and where it comes from", () => {
  for (const id of WORLD_IDS) {
    const gravity = surfaceGravity(id);
    assert.ok(gravity.metresPerSecondSquared > 0 && gravity.relativeToEarth > 0, id);
    assert.match(gravity.source, /^GM from (NASA's planetary fact sheet|JPL's Planetary Satellite Physical Parameters)/, id);
  }
  assert.equal(surfaceGravity("jupiter").surface, "cloud-tops");
  assert.equal(surfaceGravity("neptune").surface, "cloud-tops");
  assert.equal(surfaceGravity("sun").surface, "photosphere");
  assert.equal(surfaceGravity("titan").surface, "surface");
  assert.match(surfaceGravity("venus").source, /fact sheet/);
  assert.match(surfaceGravity("io").source, /JPL/);
});

const BORN = Date.UTC(2016, 10, 8);

test("age on the Earth is the real age, by birthdays", () => {
  const today = Date.UTC(2026, 10, 8);
  const age = ageOn("earth", BORN, today)!;
  assert.equal(age.wholeYears, 10);
  assert.equal(age.years, 10);
  assert.equal(age.days, 3652);
  assert.equal(age.dayHours, 24);
  const before = ageOn("earth", BORN, Date.UTC(2026, 10, 7))!;
  assert.equal(before.wholeYears, 9);
  assert.ok(before.years > 9.99 && before.years < 10);
  close(ageOn("earth", BORN, Date.UTC(2027, 4, 8))!.years, 10.5, 0.01, "half a year on");
});

test("age on a world is the time since birth over its year: one Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto year", () => {
  const periods: Record<string, number> = { mercury: 87.969, venus: 224.701, mars: 686.98, jupiter: 4332.589, saturn: 10759.22, uranus: 30685.4, neptune: 60189, pluto: 90560 };
  for (const [id, days] of Object.entries(periods)) {
    const age = ageOn(id as WorldId, BORN, BORN + days * DAY)!;
    close(age.years, 1, 1e-9, id);
    assert.equal(age.wholeYears, 1, id);
    assert.equal(age.yearDays, days, id);
    close(ageOn(id as WorldId, BORN, BORN + days * DAY * 2.5)!.years, 2.5, 1e-9, `${id} 2.5`);
  }
});

test("a ten-year-old on Mars is 5.3 and on Jupiter 0.84, and on Mercury 41", () => {
  const today = Date.UTC(2026, 10, 8);
  close(ageOn("mars", BORN, today)!.years, 5.316, 0.001, "Mars");
  close(ageOn("jupiter", BORN, today)!.years, 0.843, 0.001, "Jupiter");
  close(ageOn("mercury", BORN, today)!.years, 41.5, 0.1, "Mercury");
  close(ageOn("pluto", BORN, today)!.years, 0.0399, 0.001, "Pluto");
});

test("a day is the solar day: Mercury's 4,223 hours, Venus's 2,802 (backwards spin), Mars's 24.66, Jupiter's 9.93, the Moon's 29.5 Earth days", () => {
  const hours = (id: WorldId): number => ageOn(id, BORN, BORN + 400 * DAY)!.dayHours!;
  close(hours("mercury"), 4222.6, 1, "Mercury");
  close(hours("venus"), 2802, 1, "Venus");
  close(hours("earth"), 24, 0.001, "Earth");
  close(hours("mars"), 24.66, 0.01, "Mars");
  close(hours("jupiter"), 9.93, 0.01, "Jupiter");
  close(hours("uranus"), 17.24, 0.01, "Uranus");
  close(hours("pluto"), 153.3, 0.1, "Pluto");
  close(hours("moon") / 24, 29.53, 0.02, "the Moon's day in Earth days");
  const mars = ageOn("mars", BORN, BORN + 24.6597 * 100 * 3_600_000)!;
  close(mars.days!, 100, 0.01, "100 Mars days");
});

test("a moon's year is its planet's: the Moon's is the Earth's, Titan's is Saturn's", () => {
  const today = Date.UTC(2026, 10, 8);
  assert.equal(ageOn("moon", BORN, today)!.wholeYears, 10);
  assert.equal(ageOn("titan", BORN, today)!.yearDays, 10759.22);
  assert.equal(ageOn("io", BORN, today)!.yearDays, 4332.589);
  close(ageOn("io", BORN, today)!.dayHours!, 42.48, 0.02, "Io's day, locked to Jupiter");
});

test("the Sun has no year or day to count", () => {
  assert.equal(ageOn("sun", BORN, Date.UTC(2026, 10, 8)), null);
  assert.equal(nextBirthdayOn("sun", BORN, Date.UTC(2026, 10, 8)), null);
});

test("the next birthday on the Earth is the calendar's, and today if it is today", () => {
  const next = nextBirthdayOn("earth", BORN, Date.UTC(2026, 10, 9))!;
  assert.equal(next.date.toISOString(), "2027-11-08T00:00:00.000Z");
  assert.equal(next.turns, 11);
  assert.equal(next.inEarthDays, 364);
  const same = nextBirthdayOn("earth", BORN, Date.UTC(2026, 10, 8))!;
  assert.equal(same.inEarthDays, 0);
  assert.equal(same.turns, 10);
  const newborn = nextBirthdayOn("earth", BORN, BORN)!;
  assert.equal(newborn.turns, 1);
  assert.equal(newborn.date.toISOString(), "2017-11-08T00:00:00.000Z");
});

test("a 29 February birthday is kept on 28 February in a year with no 29th", () => {
  const leap = Date.UTC(2016, 1, 29);
  assert.equal(nextBirthdayOn("earth", leap, Date.UTC(2026, 0, 1))!.date.toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(nextBirthdayOn("earth", leap, Date.UTC(2027, 5, 1))!.date.toISOString(), "2028-02-29T00:00:00.000Z");
  assert.equal(ageOn("earth", leap, Date.UTC(2026, 1, 28))!.wholeYears, 10);
});

test("the next birthday on another world is a whole number of its years after birth, in the future, and the age agrees", () => {
  const today = Date.UTC(2026, 10, 8);
  for (const id of ["mercury", "venus", "mars", "jupiter", "saturn", "pluto", "titan"] as const) {
    const next = nextBirthdayOn(id, BORN, today)!;
    const age = ageOn(id, BORN, today)!;
    assert.equal(next.turns, age.wholeYears + 1, id);
    assert.ok(next.date.getTime() >= today, id);
    close(ageOn(id, BORN, next.date)!.years, next.turns, 1e-9, `${id} on its birthday`);
    close(next.inEarthDays, (next.date.getTime() - today) / DAY, 1e-9, id);
    assert.ok(next.inEarthDays <= age.yearDays + 1e-9, id);
  }
  const mars = nextBirthdayOn("mars", BORN, today)!;
  assert.equal(mars.turns, 6);
  assert.equal(mars.date.toISOString().slice(0, 10), "2028-02-20");
});

test("a Date works as well as milliseconds, and a birthday after today or a date that is not one is refused", () => {
  assert.equal(ageOn("earth", new Date(BORN), new Date(Date.UTC(2026, 10, 8)))!.wholeYears, 10);
  assert.throws(() => ageOn("mars", Date.UTC(2027, 0, 1), Date.UTC(2026, 0, 1)), RangeError);
  assert.throws(() => nextBirthdayOn("mars", Date.UTC(2027, 0, 1), Date.UTC(2026, 0, 1)), RangeError);
  assert.throws(() => ageOn("mars", Number.NaN, Date.UTC(2026, 0, 1)), RangeError);
  assert.throws(() => ageOn("eris" as WorldId, BORN, Date.UTC(2026, 0, 1)), RangeError);
});

test("every world has a year, and a day unless it tumbles (Nix and Hydra)", () => {
  for (const id of WORLD_IDS) {
    if (id === "sun") continue;
    const age = ageOn(id, BORN, BORN + 1000 * DAY)!;
    assert.ok(age.yearDays > 0, id);
    if (id === "nix" || id === "hydra") {
      assert.deepEqual([age.dayHours, age.days, BODIES[id].rotationHours], [null, null, 0], id);
    } else assert.ok(age.dayHours! > 0 && age.days! > 0, id);
  }
});
