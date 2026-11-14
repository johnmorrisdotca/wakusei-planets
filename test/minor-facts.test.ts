// The public facts for the minor bodies and dwarf planets (MODULES-1353): typed from NASA/JPL's Small-Body Database lookup API as plain facts, each with the source and read date it comes from, the uncertainty and
// epoch the database gives, and the discovery where it gives one. The tests hold the figures together (the ellipse's numbers agree with each other and with Kepler's third law) and the sources to NOTICE.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BODIES, MINOR_IDS } from "../src/facts.ts";
import { MINOR_FACT_IDS, MINOR_FACTS, minorFacts, periodYears } from "../src/minor-facts.ts";

const notice = readFileSync(new URL("../NOTICE.md", import.meta.url), "utf8");
/** The Gaussian gravitational constant: the Sun's pull in au, days and solar masses (k = 0.01720209895). */
const K = 0.01720209895;

test("the facts are for the five minor bodies and the nine dwarf planets the view places, by the ids the package uses", () => {
  assert.equal(MINOR_FACT_IDS.length, 14);
  for (const id of MINOR_IDS) assert.ok((MINOR_FACT_IDS as readonly string[]).includes(id), id);
  for (const id of ["ceres", "pluto", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna"]) assert.ok((MINOR_FACT_IDS as readonly string[]).includes(id), id);
  for (const id of MINOR_FACT_IDS) {
    assert.ok(id in BODIES, `${id} is a body of the package`);
    assert.equal(MINOR_FACTS[id].id, id);
    assert.equal(minorFacts(id), MINOR_FACTS[id]);
    assert.equal(minorFacts(id.toUpperCase()), MINOR_FACTS[id]);
  }
  assert.equal(minorFacts("earth"), undefined);
});

test("every record says where it comes from and when it was read, and NOTICE.md says the same", () => {
  for (const id of MINOR_FACT_IDS) {
    const { source } = MINOR_FACTS[id];
    assert.equal(source.name, "NASA/JPL Small-Body Database lookup API");
    assert.equal(source.read, "2026-11-13");
    assert.match(source.url, /^https:\/\/ssd-api\.jpl\.nasa\.gov\/sbdb\.api\?sstr=[0-9A-Za-z]+&discovery=1&full-prec=true$/, id);
  }
  assert.ok(notice.includes("sbdb.api") && notice.includes("2026-11-13") && /minor bodies and dwarf planets/i.test(notice), "NOTICE.md names the source, the day and the bodies");
});

test("the ellipse's figures agree: perihelion and aphelion from the semi-major axis and eccentricity, and the period from Kepler's third law, within what the database's own uncertainty and rounding allow", () => {
  for (const id of MINOR_FACT_IDS) {
    const { orbit } = MINOR_FACTS[id];
    const a = orbit.semiMajorAxisAu.value;
    const e = orbit.eccentricity.value;
    assert.ok(Math.abs(orbit.perihelionAu.value - a * (1 - e)) < 1e-9 * a, `${id}: q = a(1 - e)`);
    assert.ok(Math.abs(orbit.aphelionAu.value - a * (1 + e)) < 1e-9 * a, `${id}: Q = a(1 + e)`);
    const period = (2 * Math.PI * a ** 1.5) / K;
    assert.ok(Math.abs(orbit.periodDays.value - period) / period < 2e-6, `${id}: period ${orbit.periodDays.value} against ${period.toFixed(3)} from a`);
    assert.ok(Math.abs(periodYears(MINOR_FACTS[id]) - orbit.periodDays.value / 365.25) < 1e-12);
  }
});

test("the uncertainty and the epoch the database gives are kept: a sigma for every figure but Pluto's, and the epoch of each solution", () => {
  for (const id of MINOR_FACT_IDS) {
    const { orbit } = MINOR_FACTS[id];
    for (const figure of [orbit.semiMajorAxisAu, orbit.eccentricity, orbit.perihelionAu, orbit.aphelionAu, orbit.periodDays]) {
      if (id === "pluto") assert.equal(figure.sigma, null, "the database gives Pluto's orbit no uncertainty");
      else assert.ok(figure.sigma !== null && figure.sigma > 0, `${id} has a sigma`);
    }
  }
  assert.equal(MINOR_FACTS.pluto.orbit.epoch, 2457588.5);
  assert.equal(MINOR_FACTS.halley.orbit.epoch, 2439875.5);
  for (const id of MINOR_FACT_IDS) if (id !== "pluto" && id !== "halley") assert.equal(MINOR_FACTS[id].orbit.epoch, 2461200.5, id);
});

test("known figures: Ceres 2.77 au and 4.6 years, Vesta 3.63 years, Halley 75.9 years and 17.9 au, Sedna's aphelion over a thousand au, Eris 558 years", () => {
  assert.ok(Math.abs(MINOR_FACTS.ceres.orbit.semiMajorAxisAu.value - 2.7656) < 1e-4);
  assert.ok(Math.abs(periodYears(MINOR_FACTS.ceres) - 4.5993) < 1e-3);
  assert.ok(Math.abs(periodYears(MINOR_FACTS.vesta) - 3.6288) < 1e-3);
  assert.ok(Math.abs(periodYears(MINOR_FACTS.halley) - 75.9) < 0.05 && Math.abs(MINOR_FACTS.halley.orbit.semiMajorAxisAu.value - 17.93) < 0.01);
  assert.ok(MINOR_FACTS.sedna.orbit.aphelionAu.value > 1000);
  assert.ok(Math.abs(periodYears(MINOR_FACTS.eris) - 559.9) < 1);
});

test("every body has the discovery the database states: the date as YYYY-MM-DD, the finders' names, and a place where it names one", () => {
  for (const id of MINOR_FACT_IDS) {
    const found = MINOR_FACTS[id].discovery;
    assert.ok(found, `${id} has a discovery`);
    assert.match(found.date, /^\d{4}-\d{2}-\d{2}$/, id);
    assert.ok(found.by.length > 0 && found.by.every((name) => name.length > 0), id);
    assert.ok(!Number.isNaN(Date.parse(found.date)), id);
  }
  assert.deepEqual(MINOR_FACTS.ceres.discovery, { date: "1801-01-01", by: ["Piazzi, G."], place: "Palermo" });
  assert.equal(MINOR_FACTS.halley.discovery!.place, undefined, "the database names no place for Halley");
  assert.deepEqual(MINOR_FACTS.pluto.discovery!.by, ["Tombaugh, C. W."]);
});
