// The Roadster is one of the spacecraft list: its facts, its path (the same as /roadster), and a search that finds it by its other names.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ROADSTER, roadsterPosition } from "../src/roadster.ts";
import { findSpacecraft, loadSpacecraft, SPACECRAFT, SPACECRAFT_IDS, spacecraftPosition } from "../src/spacecraft.ts";

test("the Roadster is in the list once, with its names, and every id and English name is unique", () => {
  assert.equal(new Set(SPACECRAFT_IDS).size, SPACECRAFT_IDS.length);
  assert.equal(new Set(SPACECRAFT_IDS.map((id) => SPACECRAFT[id].name.en)).size, SPACECRAFT_IDS.length);
  const car = SPACECRAFT.roadster;
  assert.equal(car.name.en, "Starman");
  assert.equal(car.name.ja, "スターマン");
  assert.equal(car.kind, "other");
  assert.deepEqual(car.otherNames, ["Tesla Roadster", "Starman", "Tesla"]);
  assert.equal(car.horizons, "-143205");
  assert.equal(car.status, "active");
  assert.equal(car.launch.date, ROADSTER.launch);
  assert.equal(car.launch.vehicle, "Falcon Heavy");
  assert.match(car.launch.site.en, /39A/);
});

test("a search finds the car by tesla and by スターマン, and voyager finds both Voyagers", async () => {
  assert.deepEqual(findSpacecraft("tesla"), ["roadster"]);
  assert.deepEqual(findSpacecraft("スターマン"), ["roadster"]);
  assert.deepEqual(findSpacecraft("voyager").slice().sort(), ["voyager1", "voyager2"]);
  await loadSpacecraft("roadster");
  assert.equal(SPACECRAFT.roadster.events[0]?.kind, "launch");
  assert.ok(SPACECRAFT.roadster.events.some((event) => event.kind === "flyby" && event.body === "mars"));
  for (const day of [Date.UTC(2019, 0, 1), Date.UTC(2020, 9, 7, 6), Date.UTC(2026, 10, 12)]) {
    const fromList = spacecraftPosition("roadster", day);
    const fromCar = roadsterPosition(day);
    assert.ok(fromList.every((n, i) => Math.abs(n - fromCar[i]!) < 1e-6), new Date(day).toISOString());
  }
});
