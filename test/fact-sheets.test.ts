// The fact sheets: every number is held to the package's own data or to a published figure, and the moon counts to `/moon-catalogue`, which they are read from.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MOON_CATALOGUE_FETCHED, moonCounts } from "../src/moon-catalogue.ts";
import { DWARF_ELEMENTS } from "../src/data/dwarf.ts";
import { MINOR_ELEMENTS } from "../src/data/minor.ts";
import { BODIES, DWARF_IDS, MINOR_IDS } from "../src/facts.ts";
import { journeyStop } from "../src/stops.ts";
import { FACT_SHEET_IDS, MINOR_FACT_IDS, MOONS_READ_ON, factSheet, minorFact } from "../src/fact-sheets.ts";

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
