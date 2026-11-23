// Estimated rocks for the moons the package does not draw in full: the slim table matches the catalogue, the shape is stable and the right size, and a full moon is left alone.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES } from "../src/facts.ts";
import { MOON_CATALOGUE, catalogueMoonsOf } from "../src/moon-catalogue.ts";
import { ESTIMATED_SURFACE, albedoTone, estimatedRock, estimatedRockLine, rockSpread } from "../src/scene/estimated-rock.ts";
import { shapeRadii } from "../src/scene/shape.ts";

const meanOf = (radii: Float32Array): number => radii.reduce((sum, value) => sum + value, 0) / radii.length;

test("a catalogue moon the package does not draw in full is a rock, and a full moon is not", () => {
  assert.equal(estimatedRock(""), null);
  assert.equal(estimatedRock("not-a-moon"), null);
  assert.equal(estimatedRock("io"), null);
  assert.equal(estimatedRock("Earth"), null);
  const himalia = estimatedRock("himalia");
  assert.ok(himalia);
  assert.equal(himalia.id, "himalia");
  assert.equal(himalia.host, "jupiter");
  assert.equal(estimatedRock("Himalia"), himalia);
  assert.equal(himalia.sizeFrom, "measured");
  assert.equal(himalia.note.en, "Shape estimated.");
  assert.equal(himalia.note.ja, "形は推定");
  assert.equal(himalia.line.en, "Himalia*");
  assert.equal(himalia.legend.en, "* shape or size estimated");
  assert.equal(himalia.legend.ja, "* 形や大きさは推定");
  const again = estimatedRock("himalia");
  assert.equal(again, himalia);
  assert.equal(again?.table, himalia.table);
});

test("Jupiter's 115 moons are the 6 full drawings plus 109 estimated rocks", () => {
  const moons = catalogueMoonsOf("jupiter");
  assert.equal(moons.length, 115);
  const rocks = moons.filter((moon) => estimatedRock(moon.id) !== null);
  const full = moons.filter((moon) => estimatedRock(moon.id) === null);
  assert.equal(rocks.length, 109);
  assert.deepEqual(full.map((moon) => moon.id).sort(), ["amalthea", "callisto", "europa", "ganymede", "io", "thebe"]);
});

test("every moon the package does not draw in full matches the catalogue, and no full moon is in the table", () => {
  const seen = new Set<string>();
  for (const moon of MOON_CATALOGUE) {
    const rock = estimatedRock(moon.id);
    if (moon.full) {
      assert.equal(rock, null, moon.id);
      assert.equal(moon.id in BODIES, true, moon.id);
      continue;
    }
    assert.ok(rock, moon.id);
    assert.equal(rock.id, moon.id);
    assert.equal(rock.host, moon.host);
    assert.equal(rock.label, moon.label);
    assert.equal(rock.look.surface, ESTIMATED_SURFACE);
    if (moon.radiusKm === null) {
      assert.equal(rock.radiusKm, 1);
      assert.equal(rock.sizeFrom, "unknown");
      assert.match(rock.note.en, /Size unknown/);
      assert.equal(rock.note.ja, "形は推定。大きさは不明");
    } else {
      assert.equal(Math.round(rock.radiusKm * 10), Math.round(moon.radiusKm * 10));
      assert.equal(rock.sizeFrom, moon.radiusFrom);
    }
    if (rock.sizeFrom === "derived") {
      assert.match(rock.note.en, /brightness/);
      assert.equal(rock.note.ja, "形は推定。大きさは明るさからの推定");
    }
    assert.equal(rock.albedo, moon.albedo);
    assert.equal(rock.tone, albedoTone(moon.albedo));
    const radii = shapeRadii(rock.table);
    assert.equal(radii.length, rock.table.lon * (rock.table.lat + 1));
    const mean = meanOf(radii);
    assert.ok(Math.abs(mean - rock.radiusKm) / rock.radiusKm < 0.02, `${moon.id}: mean ${mean} against ${rock.radiusKm}`);
    seen.add(moon.id);
  }
  assert.equal(seen.size, 422);
});

test("the shape depends on the id and the line drawing uses that rock's colour", () => {
  const himalia = estimatedRock("himalia")!;
  const elara = estimatedRock("elara")!;
  assert.notEqual(himalia.table.steps, elara.table.steps);
  assert.notEqual(himalia.look.rock?.seed, elara.look.rock?.seed);
  const line = estimatedRockLine(himalia, 480);
  assert.match(line, /^<svg/);
  assert.match(line, /fill="url\(#rock-himalia\)"/);
  assert.equal(line.split("L").length - 1, 95);
  assert.match(estimatedRockLine(himalia, 10), /viewBox="0 0 32 32"/);
  const named = estimatedRock("S/2003 J 18");
  assert.equal(named?.id, "s-2003-j-18");
});

test("a small rock is a potato and a large one is nearly round", () => {
  const seed = 0x51a7c0de;
  const small = rockSpread(seed, 1);
  const between = rockSpread(seed, 150);
  const large = rockSpread(seed, 1000);
  assert.ok(small > 1.4, `a 1 km rock spreads ${small.toFixed(2)}`);
  assert.ok(large < 1.25, `a 1000 km rock spreads ${large.toFixed(2)}`);
  assert.ok(small > between && between > large, `${small.toFixed(2)} > ${between.toFixed(2)} > ${large.toFixed(2)}`);
});

test("albedo classes: dark, mid, bright and grey", () => {
  assert.equal(albedoTone(null), "grey");
  assert.equal(albedoTone(Number.NaN), "grey");
  assert.equal(albedoTone(0.04), "dark");
  assert.equal(albedoTone(0.1), "mid");
  assert.equal(albedoTone(0.63), "bright");
  assert.equal(estimatedRock("adrastea")?.tone, "mid");
  assert.equal(estimatedRock("philophrosyne")?.sizeFrom, "unknown");
  const lum = (colour: string): number => {
    const n = Number.parseInt(colour.slice(1), 16);
    return ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255);
  };
  const rocks = catalogueMoonsOf("jupiter").map((moon) => estimatedRock(moon.id)).filter((rock) => rock !== null);
  const dark = rocks.find((rock) => rock.tone === "dark");
  const grey = rocks.find((rock) => rock.tone === "grey");
  assert.ok(dark && grey);
  assert.ok(lum(dark.colour) < lum(grey.colour), `${dark.colour} should be darker than ${grey.colour}`);
  const radii = (id: string): Float32Array => shapeRadii(estimatedRock(id)!.table);
  const himaliaRadii = radii("himalia");
  const elaraRadii = radii("elara");
  assert.ok(himaliaRadii.some((value, i) => value !== elaraRadii[i]), "two rocks face different ways");
  assert.notEqual(estimatedRock("himalia")?.facts.pole.ra, estimatedRock("elara")?.facts.pole.ra);
});
