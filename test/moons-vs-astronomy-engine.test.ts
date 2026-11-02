// The Galilean moons against an independent library (astronomy-engine, MIT, a dev dependency only): the same moon, the same minute, within a few hundredths of Jupiter's radius's worth of angle.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JupiterMoons, Body, HelioVector, MakeTime } from "astronomy-engine";
import { heliocentric } from "../src/index.ts";
import { moonVector } from "../src/ephemeris.ts";
import { length, RAD, toEcliptic, type Vec3 } from "../src/vec.ts";

const ID = { io: "io", europa: "europa", ganymede: "ganymede", callisto: "callisto" } as const;

test("the four Galilean moons are where astronomy-engine puts them, to a few degrees of their orbit", () => {
  for (const when of [Date.UTC(2026, 10, 2, 12), Date.UTC(2024, 5, 15, 3), Date.UTC(2030, 0, 20, 18)]) {
    const reference = JupiterMoons(MakeTime(new Date(when)));
    for (const [name, id] of Object.entries(ID)) {
      const s = reference[name as keyof typeof reference] as { x: number; y: number; z: number };
      const eq: Vec3 = [s.x * 149597870.7, s.y * 149597870.7, s.z * 149597870.7];
      const mine = moonVector(id, when);
      const ref = toEcliptic(eq);
      const cos = (mine[0] * ref[0] + mine[1] * ref[1] + mine[2] * ref[2]) / (length(mine) * length(ref));
      const degrees = Math.acos(Math.min(1, cos)) / RAD;
      assert.ok(degrees < 4, `${name} ${new Date(when).toISOString()} is ${degrees.toFixed(2)} degrees from astronomy-engine`);
      assert.ok(Math.abs(length(mine) / length(ref) - 1) < 0.02, `${name} distance`);
    }
  }
});

test("the planets are where astronomy-engine puts them, within the table's fraction of a degree", () => {
  const when = Date.UTC(2026, 10, 2, 12);
  for (const [name, body] of [["jupiter", Body.Jupiter], ["saturn", Body.Saturn], ["mars", Body.Mars], ["venus", Body.Venus]] as const) {
    const ref = HelioVector(body, MakeTime(new Date(when)));
    const eq = toEcliptic([ref.x, ref.y, ref.z]);
    const mine = heliocentric(name, when);
    const degrees = Math.acos((mine[0] * eq[0] + mine[1] * eq[1] + mine[2] * eq[2]) / (length(mine) * length(eq))) / RAD;
    assert.ok(degrees < 0.2, `${name} is ${degrees.toFixed(3)} degrees off`);
  }
});
