import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allMoonPoster, ALL_MOON_SHOW } from "../src/all-moons.ts";
import { catalogueMoonsOf } from "../src/moon-catalogue.ts";
import { estimatedRock } from "../src/scene/estimated-rock.ts";

describe("allMoonPoster", () => {
  it("counts from the catalogue and draws only moons the package can draw", () => {
    const rows = allMoonPoster();
    assert.deepEqual(rows.map((row) => row.id), ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]);
    assert.equal(rows.find((row) => row.id === "mercury")!.total, 0);
    assert.equal(rows.find((row) => row.id === "mercury")!.shown.length, 0);
    assert.equal(rows.find((row) => row.id === "earth")!.shown[0]!.id, "moon");
    const jupiter = rows.find((row) => row.id === "jupiter")!;
    assert.equal(jupiter.total, catalogueMoonsOf("jupiter").length);
    assert.equal(jupiter.more, jupiter.total - ALL_MOON_SHOW.jupiter.length);
    assert.equal(jupiter.most, false);
    const saturn = rows.find((row) => row.id === "saturn")!;
    assert.equal(saturn.most, true);
    assert.equal(saturn.total, catalogueMoonsOf("saturn").length);
    const pluto = rows.find((row) => row.id === "pluto")!;
    assert.equal(pluto.more, 0);
    const kerberos = pluto.shown.find((moon) => moon.id === "kerberos")!;
    assert.equal(kerberos.estimated, false);
    assert.equal(kerberos.line.en, "Kerberos");
    for (const row of rows) {
      for (const moon of row.shown) {
        assert.ok(catalogueMoonsOf(row.id).some((item) => item.id === moon.id), moon.id);
        if (!moon.estimated) assert.equal(estimatedRock(moon.id), null, moon.id);
      }
    }
  });
});
