// The landing sites as data: every site is a real one with a source and a flag code, its point is in range and is the place table's point, the counts are the ones the guide gives, Apollo 17 leads to the standing view, and the flag code of a country.
import assert from "node:assert/strict";
import { test } from "node:test";
import { flagCode, isFlagCode } from "@johnmorrisdotca/hata";
import { findLandingSite, flagCodeOf, LANDING_SITES, landingSitesOf } from "../src/landing-sites.ts";
import { findPlace } from "../src/places.ts";
import { PLACES_MARS } from "../src/places/mars.ts";
import { PLACES_MOON } from "../src/places/moon.ts";
import { siteById } from "../src/surface/site.ts";

const RAD = Math.PI / 180;
const tables = { moon: PLACES_MOON, mars: PLACES_MARS } as const;

test("every site has a source with an address, a mission date, an agency, both names and a point in range", () => {
  assert.ok(LANDING_SITES.length >= 39);
  for (const site of LANDING_SITES) {
    const where = site.id;
    assert.match(site.id, new RegExp(`^${site.body}/[a-z0-9-]+$`), where);
    assert.match(site.source.url, /^https:\/\/[^\s]+$/, `${where}: source address`);
    assert.ok(site.source.name.length > 3, `${where}: source name`);
    if (site.checkedAgainst !== undefined) assert.match(site.checkedAgainst.url, /^https:\/\//, `${where}: check address`);
    if (site.page !== undefined) assert.match(site.page, /^https:\/\/nssdc\.gsfc\.nasa\.gov\//, `${where}: mission page`);
    assert.ok(site.lat >= -90 && site.lat <= 90, `${where}: latitude`);
    assert.ok(site.lon >= -180 && site.lon <= 180, `${where}: longitude`);
    assert.match(site.date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/, `${where}: date`);
    assert.ok(site.name.en.length > 0 && site.name.ja.length > 0 && site.agency.en.length > 0 && site.agency.ja.length > 0, `${where}: names`);
  }
  assert.equal(new Set(LANDING_SITES.map((site) => site.id)).size, LANDING_SITES.length, "ids are unique");
  assert.equal(new Set(LANDING_SITES.map((site) => site.place)).size, LANDING_SITES.length, "each is a different place");
});

test("every country is a code the flag package draws", () => {
  for (const site of LANDING_SITES) {
    assert.match(site.country, /^[A-Z]{2}$/, `${site.id}: two capital letters`);
    const code = flagCodeOf(site.country);
    assert.ok(code !== undefined && isFlagCode(flagCode(code)), `${site.id}: ${site.country} has a flag`);
  }
  assert.equal(flagCode("SU"), "SUHH", "the Soviet Union's flag is the old country's");
  assert.deepEqual(["J", "SU", "us", "cn", "ESA", "", undefined].map((c) => flagCodeOf(c)), ["JP", "SU", "US", "CN", undefined, undefined, undefined]);
});

test("each site is the place the place tables hold, at the same point, on the same day and country", () => {
  for (const site of LANDING_SITES) {
    const place = tables[site.body].find((one) => one.id === site.place);
    assert.ok(place !== undefined, `${site.id}: ${site.place} is in the tables`);
    assert.ok(["crewed", "landing", "rover"].includes(place.kind), `${site.id}: a landing or the rover that landed with it`);
    assert.ok(place.outcome === "soft" || place.outcome === "crewed", `${site.id}: touched down softly`);
    assert.equal(site.lat, place.lat, `${site.id}: latitude`);
    assert.equal(site.lon, place.lon, `${site.id}: longitude`);
    assert.equal(site.date, place.date, `${site.id}: date`);
    assert.equal(flagCodeOf(place.country), flagCodeOf(site.country), `${site.id}: country`);
    assert.equal(site.approximate === true, place.approximate === true || site.id === "mars/mars-3", `${site.id}: approximate`);
  }
});

test("the places beside a site are on the same spot and lead back to it", () => {
  for (const site of LANDING_SITES) {
    for (const id of site.alsoAt ?? []) {
      const place = tables[site.body].find((one) => one.id === id);
      assert.ok(place !== undefined && ["landing", "rover"].includes(place.kind), `${site.id}: ${id}`);
      const away = Math.acos(Math.min(1, Math.sin(site.lat * RAD) * Math.sin(place.lat * RAD) + Math.cos(site.lat * RAD) * Math.cos(place.lat * RAD) * Math.cos((site.lon - place.lon) * RAD))) / RAD;
      assert.ok(away < 0.1, `${site.id}: ${id} is ${away.toFixed(3)} degrees away`);
      assert.equal(findLandingSite(id)?.id, site.id);
    }
  }
});

test("the sites the work asked for are all there, and the ones that crashed are not", () => {
  const names = (body: "moon" | "mars"): string[] => landingSitesOf(body).map((site) => site.name.en);
  for (const want of ["Apollo 11", "Apollo 12", "Apollo 14", "Apollo 15", "Apollo 16", "Apollo 17", "Luna 9", "Luna 13", "Luna 16", "Luna 17", "Luna 20", "Luna 21", "Luna 23", "Luna 24", "Surveyor 1", "Surveyor 3", "Surveyor 5", "Surveyor 6", "Surveyor 7", "Chang'e 3", "Chang'e 4", "Chang'e 5", "Chang'e 6", "Chandrayaan-3", "SLIM", "IM-1 Odysseus"]) assert.ok(names("moon").includes(want), want);
  for (const want of ["Mars 3", "Viking 1", "Viking 2", "Mars Pathfinder", "Spirit", "Opportunity", "Phoenix", "Curiosity", "InSight", "Perseverance", "Zhurong"]) assert.ok(names("mars").includes(want), want);
  assert.equal(landingSitesOf("moon").length, 28);
  assert.equal(landingSitesOf("mars").length, 11);
  for (const crashed of ["moon/luna-5", "moon/luna-7", "moon/luna-8", "mars/mars-2-lander", "mars/beagle-2", "mars/mars-polar-lander"]) assert.ok(!LANDING_SITES.some((site) => site.place === crashed), crashed);
  for (const body of ["moon", "mars"] as const) assert.deepEqual(landingSitesOf(body).map((s) => s.date), landingSitesOf(body).map((s) => s.date).sort(), `${body}: by date`);
});

test("the lookups take an id, a place id or a name, and seven sites lead to the standing view", () => {
  assert.equal(findLandingSite("moon/apollo-11")?.place, "moon/apollo-11-lunar-module");
  assert.equal(findLandingSite("Moon/Apollo-11-Lunar-Module")?.id, "moon/apollo-11");
  assert.equal(findLandingSite("zhurong")?.country, "CN");
  assert.equal(findLandingSite("嫦娥4号")?.id, "moon/chang-e-4");
  assert.equal(findLandingSite("nowhere"), undefined);
  assert.equal(findLandingSite(undefined as unknown as string), undefined);
  const standing = LANDING_SITES.filter((site) => site.stand !== undefined);
  assert.deepEqual(standing.map((site) => site.id), ["moon/apollo-15", "moon/apollo-16", "moon/apollo-17", "moon/chang-e-3", "moon/chang-e-4", "mars/curiosity", "mars/perseverance"]);
  assert.ok(siteById(standing[0]!.stand!) !== undefined, "the standing view has that site");
  assert.ok(findPlace(PLACES_MOON, "Apollo 17 lunar module") !== undefined);
  const stand = siteById("apollo-17")!;
  assert.ok(Math.abs(stand.lat - findLandingSite("moon/apollo-17")!.lat) < 0.01 && Math.abs(stand.lon - findLandingSite("moon/apollo-17")!.lon) < 0.01, "the standing view is at the same point");
  assert.equal(stand.place, findLandingSite("moon/apollo-17")!.place);
});

test("a site whose source says 'about' is marked approximate, and a note is plain English", () => {
  assert.equal(findLandingSite("mars/mars-3")?.approximate, true);
  assert.equal(findLandingSite("moon/luna-9")?.approximate, true);
  assert.equal(findLandingSite("moon/apollo-11")?.approximate, undefined);
  for (const site of LANDING_SITES) if (site.note !== undefined) assert.match(site.note, /^[A-Z].*\.$/, site.id);
});
