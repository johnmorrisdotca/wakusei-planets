// The fact sheets: every number is held to the package's own data or to a published figure, and the moon counts to `/moon-catalogue`, which they are read from.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MOON_CATALOGUE_FETCHED, moonCounts } from "../src/moon-catalogue.ts";
import { DWARF_ELEMENTS } from "../src/data/dwarf.ts";
import { MINOR_ELEMENTS } from "../src/data/minor.ts";
import { BODIES, DWARF_IDS, MINOR_IDS } from "../src/facts.ts";
import { journeyStop } from "../src/stops.ts";
import { bodyPhysics } from "../src/body-physics.ts";
import { FACT_SHEET_IDS, MINOR_FACT_IDS, MOONS_READ_ON, SOLAR_SYSTEM_TERMS, factSheet, minorFact, solarSystemDefinition, weightOn, worldAge } from "../src/fact-sheets.ts";

test("the eight solar-system terms have their names and definitions in both languages and named sources", () => {
  assert.deepEqual([...SOLAR_SYSTEM_TERMS], ["planet", "dwarf-planet", "moon", "asteroid", "comet", "meteoroid", "meteor", "meteorite"]);
  const entries = SOLAR_SYSTEM_TERMS.map(solarSystemDefinition);
  assert.deepEqual(entries.map(({ name }) => name.ja), ["惑星", "準惑星", "衛星", "小惑星", "彗星", "流星体", "流星", "隕石"]);
  for (const [i, entry] of entries.entries()) {
    assert.equal(entry.term, SOLAR_SYSTEM_TERMS[i]);
    assert.ok(entry.name.en.length > 0 && entry.description.en.length > 40);
    assert.match(entry.description.ja, /[ぁ-ん]/u);
    assert.ok(entry.sources.length > 0);
    for (const source of entry.sources) {
      assert.ok(source.name.startsWith("IAU ") || source.name.startsWith("NASA "));
      assert.match(source.url, /^https:\/\/(www\.iau\.org|science\.nasa\.gov)\//u);
    }
  }
  assert.deepEqual(solarSystemDefinition("planet").sources, solarSystemDefinition("dwarf-planet").sources);
  assert.match(solarSystemDefinition("planet").sources[0]!.name, /Resolution 5A/u);
  for (const term of ["meteoroid", "meteor", "meteorite"] as const) {
    const { sources } = solarSystemDefinition(term);
    assert.match(sources[0]!.name, /Commission F1.*2017/u);
    assert.match(sources[1]!.url, /meteors-meteorites/u);
  }
  assert.match(solarSystemDefinition("meteoroid").description.en, /30 micrometres to 1 metre/u);
  assert.match(solarSystemDefinition("meteoroid").description.ja, /30\s*マイクロメートルから1\s*メートル/u);
});

test("definitions return independent copies and unknown keys give a RangeError", () => {
  const meteor = solarSystemDefinition("meteor");
  meteor.name.en = "changed";
  meteor.description.ja = "changed";
  meteor.sources[0]!.url = "changed";
  meteor.sources.pop();
  const next = solarSystemDefinition("meteor");
  assert.equal(next.name.en, "Meteor");
  assert.notEqual(next.description.ja, "changed");
  assert.equal(next.sources.length, 2);
  assert.equal(next.sources[0]!.url, solarSystemDefinition("meteorite").sources[0]!.url);
  assert.notEqual(next.sources[0]!.url, "changed");
  for (const key of ["sun", "__proto__"]) {
    assert.throws(() => solarSystemDefinition(key as never), { name: "RangeError", message: new RegExp(`"${key}"`) });
  }
});

test("a sheet's size, distance and spin are the package's own numbers, in km and in miles", () => {
  for (const id of FACT_SHEET_IDS) {
    const sheet = factSheet(id);
    assert.equal(sheet.radius.km, BODIES[id].radiusKm);
    assert.ok(Math.abs(sheet.radius.miles * 1.609344 - sheet.radius.km) < 1e-9, `${id} miles`);
    assert.equal(sheet.distanceFromSun.au, id === "sun" ? 0 : journeyStop(id).sunAu);
    assert.ok(Math.abs(sheet.distanceFromSun.km / 149_597_870.7 - sheet.distanceFromSun.au) < 1e-9);
    assert.equal(sheet.rotationHours, Math.abs(BODIES[id].rotationHours));
    assert.match(sheet.nasaPage, /^https:\/\/science\.nasa\.gov\/(dwarf-planets\/)?[a-z]+\/$/);
    assert.ok(sheet.description.en.length > 40 && /[ぁ-ん]/.test(sheet.description.ja), `${id} has both descriptions`);
  }
});

test("published figures: the Earth, Mars, Venus and Pluto", () => {
  const earth = factSheet("earth");
  assert.equal(Math.round(earth.distanceFromSun.miles / 1e6), 93, "93 million miles");
  assert.equal(earth.yearDays, 365.256);
  assert.ok(Math.abs(earth.rotationHours - 23.934) < 0.001);
  assert.equal(factSheet("mars").yearDays, 686.98);
  assert.equal(factSheet("venus").retrograde, true);
  assert.equal(factSheet("uranus").retrograde, true);
  assert.equal(factSheet("pluto").kind, "dwarf-planet");
  assert.equal(factSheet("sun").kind, "star");
  assert.equal(factSheet("sun").yearDays, null);
  assert.equal(factSheet("earth").retrograde, false);
});

test("the year agrees with Kepler's third law from the mean distance to 0.2 percent, so the two cannot drift apart", () => {
  for (const id of FACT_SHEET_IDS.filter((one) => one !== "sun")) {
    const sheet = factSheet(id);
    const kepler = sheet.distanceFromSun.au ** 1.5 * 365.25;
    assert.ok(Math.abs(sheet.yearDays! - kepler) / kepler < 0.002, `${id}: ${sheet.yearDays} against ${kepler}`);
  }
});

test("the moon counts are what /moon-catalogue holds, read on the same day", () => {
  assert.equal(MOONS_READ_ON, MOON_CATALOGUE_FETCHED);
  const counts = moonCounts();
  for (const id of FACT_SHEET_IDS) {
    const sheet = factSheet(id);
    assert.equal(sheet.knownMoons, (counts as Record<string, { total: number } | undefined>)[id]?.total ?? 0, id);
    assert.equal(sheet.moonsReadOn, MOON_CATALOGUE_FETCHED);
  }
});

test("a sheet is a copy: changing it does not change the next one; a body without a sheet throws naming itself", () => {
  const a = factSheet("mars");
  a.description.en = "changed";
  assert.notEqual(factSheet("mars").description.en, "changed");
  assert.throws(() => factSheet("io" as never), /"io"/);
});

test("each dwarf planet besides Pluto and each minor body carries the ellipse the package stores (MODULES-1353)", () => {
  assert.deepEqual([...MINOR_FACT_IDS], [...DWARF_IDS, ...MINOR_IDS]);
  for (const id of MINOR_FACT_IDS) {
    const fact = minorFact(id);
    const elements = (DWARF_IDS as readonly string[]).includes(id) ? DWARF_ELEMENTS[id as (typeof DWARF_IDS)[number]] : MINOR_ELEMENTS[id as (typeof MINOR_IDS)[number]];
    assert.equal(fact.aAu, elements.a, id);
    assert.equal(fact.periodDays, 360 / elements.n, id);
    assert.equal(fact.perihelionAu, elements.a * (1 - elements.e), id);
    assert.equal(fact.epochMs, elements.epoch, id);
    assert.equal(fact.name.en.length > 0, true, id);
    assert.equal(fact.name.ja.length > 0, true, id);
  }
  assert.ok(minorFact("halley").perihelionAu < 1);
  assert.ok(minorFact("halley").periodDays > 70 * 365);
  assert.equal(minorFact("ceres").kind, "dwarf-planet");
  assert.equal((MINOR_FACT_IDS as readonly string[]).includes("pluto"), false);
  const copy = minorFact("vesta");
  copy.name.en = "changed";
  assert.notEqual(minorFact("vesta").name.en, "changed");
  assert.throws(() => minorFact("mars" as never), /"mars"/);
});

test("surface gravity is NASA's fact sheet, and a weight on Earth stays itself", () => {
  const gravity: Record<string, number> = { sun: 274, mercury: 3.7, venus: 8.87, earth: 9.82, mars: 3.73, jupiter: 25.92, saturn: 11.19, uranus: 9.01, neptune: 11.27, pluto: 0.62 };
  for (const id of FACT_SHEET_IDS) {
    assert.equal(factSheet(id).gravityMs2, gravity[id], id);
    assert.equal(factSheet(id).gravityMs2, bodyPhysics(id).surfaceGravity!.value, id);
  }
  assert.equal(weightOn("earth", 40), 40);
  assert.ok(Math.abs(weightOn("mars", 40) - 40 * 3.73 / 9.82) < 1e-9);
  assert.ok(Math.abs(weightOn("moon", 40) - 40 * 1.62 / 9.82) < 1e-9);
  assert.ok(weightOn("moon", 40) < weightOn("mars", 40));
  assert.throws(() => weightOn("io" as never, 40), /"io"/);
  assert.throws(() => weightOn("earth", -1), RangeError);
  assert.throws(() => weightOn("earth", Number.NaN), RangeError);
});

test("an age is Earth days divided by that world's year, and the next birthday is the next whole year", () => {
  const born = Date.UTC(2016, 0, 1);
  const on = Date.UTC(2026, 0, 1);
  const days = (on - born) / 86_400_000;
  const mars = worldAge("mars", born, on);
  assert.ok(mars !== null && Math.abs(mars.years - days / 686.98) < 1e-9);
  assert.ok(mars.nextBirthday.getTime() > on);
  const there = worldAge("mars", born, mars.nextBirthday);
  assert.ok(there !== null && Math.abs(there.years - Math.round(there.years)) < 1e-9);
  assert.equal(there.nextBirthday.getTime(), mars.nextBirthday.getTime());
  const moon = worldAge("moon", born, on);
  assert.ok(moon !== null && Math.abs(moon.years - days / 27.3217) < 1e-9);
  assert.equal(worldAge("sun", born, on), null);
  assert.ok(weightOn("sun", 40) > 1000);
  assert.throws(() => worldAge("earth", on, born), /on must not be before born/);
});
