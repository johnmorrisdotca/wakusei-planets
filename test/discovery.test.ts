// The discovery records (/discovery): one for every planet, dwarf planet and moon the package draws, each fact with a source that is listed, dates that are dates, and the moons' designations, numbers and years the same as /moon-catalogue's (the same JPL page).
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, BODY_IDS } from "../src/facts.ts";
import { findCatalogueMoon } from "../src/moon-catalogue.ts";
import { DISCOVERIES, DISCOVERY_IDS, DISCOVERY_METHODS, DISCOVERY_SOURCES, discoveryOf, type Discovery } from "../src/discovery.ts";

const FIELDS = ["date", "place", "by", "method", "designation", "number", "announced", "namedBy", "nameOrigin"] as const;

test("every planet, dwarf planet and moon the package draws in full has a record, and nothing else does", () => {
  const drawn = BODY_IDS.filter((id) => ["planet", "dwarf-planet", "moon"].includes(BODIES[id].kind));
  assert.deepEqual([...DISCOVERY_IDS].sort(), [...drawn].sort());
  assert.equal(new Set(DISCOVERY_IDS).size, DISCOVERY_IDS.length, "no id twice");
  for (const d of DISCOVERIES) assert.equal(d.kind, BODIES[d.id as keyof typeof BODIES].kind, d.id);
  assert.equal(discoveryOf("nowhere"), undefined);
});

test("every fact names a source that is listed, with its name and the day it was read, and a method is one of the listed methods", () => {
  for (const [key, [name, address, read]] of Object.entries(DISCOVERY_SOURCES)) {
    assert.ok(name.length > 10, key);
    assert.match(read, /^2026-\d\d-\d\d$/, key);
    if (key !== "derived") assert.match(address, /^https:\/\//, key);
  }
  for (const d of DISCOVERIES) {
    for (const field of FIELDS) {
      const fact = d[field];
      if (fact === null) continue;
      assert.ok(fact.source in DISCOVERY_SOURCES, `${d.id}.${field}: source ${fact.source}`);
      assert.ok(Array.isArray(fact.value) ? fact.value.length > 0 : String(fact.value).length > 0, `${d.id}.${field} is not empty`);
    }
    if (d.method !== null) {
      assert.ok((DISCOVERY_METHODS as readonly string[]).includes(d.method.value), `${d.id}: ${d.method.value}`);
      assert.equal(d.method.source, "derived", `${d.id}: a method is worked out here, and says so`);
    }
  }
});

test("a body known since before recorded history says so and has no date; every other body has a day or a month", () => {
  const ancient = DISCOVERIES.filter((d) => d.ancient).map((d) => d.id);
  assert.deepEqual(ancient, ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "moon"]);
  for (const d of DISCOVERIES) {
    if (d.ancient) {
      assert.equal(d.date, null, d.id);
      assert.equal(d.method?.value ?? "ancient", "ancient", d.id);
    } else {
      assert.ok(d.date !== null && /^\d{4}-\d\d(-\d\d)?$/.test(d.date.value), `${d.id}: ${d.date?.value}`);
      const [year, month, day] = d.date.value.split("-").map(Number);
      assert.ok(month! >= 1 && month! <= 12 && (day === undefined || (day >= 1 && day <= 31)), `${d.id}: ${d.date.value}`);
      assert.ok(year! >= 1600 && year! <= 2026, d.id);
    }
  }
});

test("a moon's designation, number and year are the ones /moon-catalogue holds from the same JPL page", () => {
  for (const d of DISCOVERIES.filter((x) => x.kind === "moon" && x.id !== "moon")) {
    const moon = findCatalogueMoon(d.id)!;
    assert.ok(moon !== undefined, d.id);
    assert.equal(d.designation?.value ?? null, moon.designation, `${d.id}: designation`);
    assert.equal(d.number?.value.split(" ")[1], moon.number, `${d.id}: number`);
    assert.equal(Number(d.date!.value.slice(0, 4)), moon.discovery.year, `${d.id}: year`);
    if (d.announced !== null) assert.ok((moon.discovery.reference ?? "").includes(d.announced.value.split(" (")[0]!), `${d.id}: announcement`);
  }
});

test("the records say where sources differ and what they leave out", () => {
  const find = (id: string): Discovery => discoveryOf(id)!;
  assert.equal(find("neptune").by?.value[0], "J.G. Galle");
  assert.ok(find("neptune").notes.join(" ").includes("Le Verrier") && find("neptune").notes.join(" ").includes("Adams") && find("neptune").notes.join(" ").includes("d'Arrest"));
  assert.equal(find("haumea").by, null, "the Gazetteer and JPL name no person for Haumea");
  assert.ok(find("haumea").notes.join(" ").includes("Sierra Nevada"));
  assert.equal(find("pluto").date?.value, "1930-01-23");
  assert.ok(find("pluto").notes.join(" ").includes("18 February 1930"));
  assert.equal(find("vanth").date?.source, "wikidata");
  assert.equal(find("vanth").place, null);
  assert.equal(find("proteus").date?.value, "1989-06", "a month where the source gives only that");
  assert.equal(find("ceres").designation?.value, "A801 AA");
  assert.equal(find("eris").designation?.value, "2003 UB313");
});
