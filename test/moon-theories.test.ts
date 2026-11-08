// The moon theories are optional: without them `moonVector` answers with the fitted orbit, and importing the entry point makes the moon follow the theory.
// The two ports are checked against the values their authors publish: TASS1.7's example (IMCCE, tass17.f) and L1.2's (IMCCE, TestL1.2.res).
import assert from "node:assert/strict";
import { test } from "node:test";
import { moonVector } from "../src/ephemeris.ts";
import { moonTheoryOf } from "../src/data/theories.ts";
import { galileanPosition } from "../src/theories/galilean.ts";
import { tass17Position } from "../src/theories/tass17.ts";
import { length, sub, toEcliptic, type Vec3 } from "../src/vec.ts";

const AU_KM = 149597870.7;
const jd = (day: number): number => (day - 2440587.5) * 86400000;

test("TASS1.7 gives IMCCE's published positions of Mimas, Tethys, Titan and Iapetus to within the truncation", () => {
  const cases: [number, number, Vec3][] = [
    [0, 2421677.4, [-0.001198576889, -0.00020982546, 0.000186837157]],
    [2, 2409977.4, [0.001169171754, -0.001455040893, 0.000629464516]],
    [5, 2440512.6, [-0.008312968003, 0.000590507681, 0.00049683102]],
    [6, 2443179.7, [0.0114979, 0.019131195, -0.0069865]],
  ];
  for (const [index, day, expected] of cases) {
    const mine = tass17Position(index, jd(day));
    const km = length(sub(mine, [expected[0] * AU_KM, expected[1] * AU_KM, expected[2] * AU_KM]));
    assert.ok(km < (index === 6 ? 300 : 120), `moon ${index} on JD ${day} is ${km.toFixed(0)} km from IMCCE's example`);
  }
});

test("L1.2 gives IMCCE's published positions of Io, Europa, Ganymede and Callisto to within the truncation", () => {
  // TestL1.2.res gives these in the mean equator and equinox of J2000; the package works in the ecliptic of J2000
  const cases: [number, number, Vec3][] = [
    [0, 2426855, [0.002271527767, 0.001491984142, 0.0007501112163]],
    [1, 2451545, [-0.003751376363, -0.002136181405, -0.001056765926]],
    [2, 2441669, [0.0008471345317, 0.006419261228, 0.003051764921]],
    [3, 2471297, [0.00007301099508, -0.01142729979, -0.005370459356]],
  ];
  for (const [index, day, equatorial] of cases) {
    const mine = galileanPosition(index, jd(day));
    const km = length(sub(mine, toEcliptic([equatorial[0] * AU_KM, equatorial[1] * AU_KM, equatorial[2] * AU_KM])));
    assert.ok(km < 60, `moon ${index} on JD ${day} is ${km.toFixed(1)} km from IMCCE's example`);
  }
});

test("without a theory a moon is answered by its fitted orbit, and importing the entry point moves it to the theory", async () => {
  const when = Date.UTC(2026, 10, 7, 12);
  assert.equal(moonTheoryOf("io"), undefined);
  assert.equal(moonTheoryOf("titan"), undefined);
  const fitted = moonVector("io", when);
  await import("../src/tables/galilean.ts");
  assert.ok(moonTheoryOf("io") !== undefined && moonTheoryOf("callisto") !== undefined);
  assert.equal(moonTheoryOf("titan"), undefined, "the Galilean entry point registers only its own moons");
  const theory = moonVector("io", when);
  assert.ok(length(sub(fitted, theory)) > 1, "the theory changes the answer");
  assert.ok(length(sub(fitted, theory)) < 0.2 * length(theory), "and both put Io near the same place on its orbit");
  await import("../src/tables/saturn-moons.ts");
  for (const name of ["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"]) assert.ok(moonTheoryOf(name) !== undefined, name);
  assert.equal(moonTheoryOf("hyperion"), undefined);
});
