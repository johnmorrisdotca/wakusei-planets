import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogueMoonsOf } from "../src/moon-catalogue.ts";
import { moonGroupPoster } from "../src/moon-groups.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

describe("moonGroupPoster", () => {
  it("lists every moon of Jupiter once, a full drawing without a star and a rock with one", () => {
    const groups = moonGroupPoster("jupiter");
    const ids = groups.flatMap((group) => group.moons.map((moon) => moon.id));
    assert.equal(ids.length, catalogueMoonsOf("jupiter").length);
    assert.deepEqual(groups.flatMap((group) => group.moons.map((moon) => moon.number)), ids.map((_, index) => index + 1));
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(groups.find((group) => group.moons.some((moon) => moon.id === "io"))!.moons.find((moon) => moon.id === "io")!.estimated, false);
    const himalia = groups.flatMap((group) => group.moons).find((moon) => moon.id === "himalia")!;
    assert.equal(himalia.estimated, true);
    assert.equal(himalia.line.en, estimatedRock("himalia")!.line.en);
    assert.equal(himalia.line.ja, estimatedRock("himalia")!.line.ja);
  });

  it("covers Saturn, Uranus and Neptune without dropping a moon", () => {
    for (const host of ["saturn", "uranus", "neptune"] as const) {
      const ids = moonGroupPoster(host).flatMap((group) => group.moons.map((moon) => moon.id));
      assert.equal(ids.length, catalogueMoonsOf(host).length, host);
      assert.equal(new Set(ids).size, ids.length, host);
    }
  });
});
