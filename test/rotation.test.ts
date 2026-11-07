import assert from "node:assert/strict";
import { test } from "node:test";
import { poleOf } from "../src/ephemeris.ts";
import { BODIES, BODY_IDS, DWARF_IDS, heliocentric, PLANET_IDS, type HostId } from "../src/index.ts";
import { cross, DEG, dot, length, sub } from "../src/vec.ts";
import { ORBITS } from "../src/data/orbits.ts";

const T = Date.UTC(2026, 10, 3);

test("every body turns at the speed its rotation period says", () => {
  for (const id of BODY_IDS) {
    const f = BODIES[id];
    if (f.rotationHours === 0) continue;
    const expected = 360 / (Math.abs(f.rotationHours) / 24);
    assert.ok(Math.abs(Math.abs(f.prime.rate) - expected) / expected < 0.01, `${id}: ${f.prime.rate} degrees a day against ${expected.toFixed(3)}`);
  }
});

test("a planet or dwarf planet turns about its real axis, the way its tilt and rotation period say: backwards (against its orbit) when the axis is tipped past 90 degrees", () => {
  const hosts: readonly HostId[] = [...PLANET_IDS, ...DWARF_IDS];
  for (const id of hosts) {
    const f = BODIES[id];
    const a = heliocentric(id, T);
    const b = heliocentric(id, T + 86_400_000);
    const r = cross(a, sub(b, a));
    const normal: [number, number, number] = [r[0] / length(r), r[1] / length(r), r[2] / length(r)];
    // the way it really spins: the pole when the prime meridian turns forwards, the opposite when it turns backwards
    const spin = Math.sign(f.prime.rate);
    const pole = poleOf(id);
    const omega: [number, number, number] = [pole[0] * spin, pole[1] * spin, pole[2] * spin];
    const tilt = Math.acos(Math.max(-1, Math.min(1, dot(omega, normal)))) * DEG;
    assert.ok(Math.abs(tilt - f.tiltDeg) < 3.5, `${id}: it spins ${tilt.toFixed(2)} degrees from its orbit's pole, facts say ${f.tiltDeg}`);
    if (Math.abs(f.tiltDeg - 90) > 1) assert.equal(Math.sign(f.rotationHours), f.tiltDeg > 90 ? -1 : 1, `${id}: backwards only when tipped past 90 degrees`);
  }
});

test("a moon that turns once a trip turns at the rate its orbit goes round", () => {
  for (const id of BODY_IDS) {
    const f = BODIES[id];
    const orbit = ORBITS[id];
    if (f.synchronous !== true || orbit === undefined) continue;
    assert.ok(Math.abs(Math.abs(f.prime.rate) / Math.abs(orbit.sid) - 1) < 1e-3, `${id}: it turns ${f.prime.rate} degrees a day, its orbit goes round at ${orbit.sid}`);
  }
});
