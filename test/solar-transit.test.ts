// nextSolarTransit is Mercury or Venus seen against the Sun. The closest moments are held to the minute NASA prints.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextSolarTransit } from "../src/sky.ts";

const MINUTE = 60_000;

test("Mercury's 2019 transit and Venus's 2012 transit match NASA's published minute", () => {
  const mercury = nextSolarTransit("mercury", Date.UTC(2019, 0, 1));
  const venus = nextSolarTransit("venus", Date.UTC(2010, 0, 1));
  assert.ok(mercury.start < mercury.peak && mercury.peak < mercury.finish);
  assert.ok(venus.start < venus.peak && venus.peak < venus.finish);
  assert.ok(Math.abs(mercury.peak.getTime() - Date.UTC(2019, 10, 11, 15, 19)) < 2 * MINUTE);
  assert.ok(Math.abs(venus.peak.getTime() - Date.UTC(2012, 5, 6, 1, 29)) < 2 * MINUTE);
  assert.ok(mercury.separationArcmin > 0 && mercury.separationArcmin < 16);
  assert.ok(venus.separationArcmin > 0 && venus.separationArcmin < 16);
});

test("a transit is only Mercury or Venus", () => {
  assert.throws(() => nextSolarTransit("mars" as "mercury", Date.UTC(2020, 0, 1)), /mercury or venus/);
});
