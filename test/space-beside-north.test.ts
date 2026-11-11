// North stays up in the view from beside a moon, for every moon the package has: the places are the ones the space view gives `besideMoon` (the same pure functions, no element and no browser), at moments
// spread through one whole orbit of each moon, in both scales. North here is the planet's own north pole (the scene hands it to `besideMoon` as `north`): a regular moon keeps the camera near its planet's equator,
// so that pole stays near square to the line of sight at every point of the orbit, where the scene's +y leans towards and away from the camera once a lap for the tilted and the sideways systems.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BODIES, MOONS_OF, type MoonId } from "../src/facts.ts";
import { moonOffset, orientation } from "../src/scene/orient.ts";
import { besideMoon, frameAt, moonDistance, placeBodies, radiusIn, type BesideCamera, type BesideInput, type ScaleMode, type SpaceDwarf, type SpacePlanet } from "../src/space/index.ts";
import { cross, dot, length, RAD, type Vec3 } from "../src/vec.ts";

type Host = "earth" | SpacePlanet | SpaceDwarf;
type Places = Omit<BesideInput, "aspect" | "zoom" | "yaw" | "tilt"> & { north: Vec3 };

const SCALES: readonly ScaleMode[] = ["compressed", "true"];
/** Inside this many degrees of looking straight along the pole there is no north to lay across the picture: such a frame is counted and left out. */
const CONE = 5;
/** How far the laid-out north may be from straight up in the picture, in degrees. */
const LIMIT = 5;
/** How far the line of sight may turn in one step of 1/1440 of an orbit, in degrees. */
const JUMP = 3;
const START = Date.UTC(2026, 10, 12, 0, 16, 35);
const MOONS = (Object.entries(MOONS_OF) as [Host, readonly MoonId[]][]).flatMap(([host, moons]) => moons.map((moon) => ({ host, moon })));

const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const angle = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (length(a) * length(b))))) / RAD;

/** What the space view hands `besideMoon` for a moon at a moment: the places relative to the moon (the view moves its origin to the body ridden), the moon drawn where the scale puts it. */
function placesOf(moon: MoonId, host: Host, mode: ScaleMode, ms: number): Places {
  const pos = placeBodies(mode, frameAt(ms));
  const north = orientation(host, ms).pole;
  if (moon === "moon") return { moon: [0, 0, 0], moonRadius: radiusIn("moon", mode), host: minus(pos.earth, pos.moon), hostRadius: radiusIn("earth", mode), sun: minus(pos.sun, pos.moon), north };
  const real = moonOffset(moon, ms);
  const d = length(real);
  const k = d === 0 ? 1 : moonDistance(mode, host as SpacePlanet | SpaceDwarf, d) / d;
  const hostRadius = radiusIn(host, mode);
  const offset: Vec3 = [real[0] * k * hostRadius, real[1] * k * hostRadius, real[2] * k * hostRadius];
  const centre = pos[host];
  return { moon: [0, 0, 0], moonRadius: Math.max(1e-6, (BODIES[moon].radiusKm / BODIES[host].radiusKm) * hostRadius), host: [-offset[0], -offset[1], -offset[2]], hostRadius, sun: minus(pos.sun, [centre[0] + offset[0], centre[1] + offset[1], centre[2] + offset[2]]), north };
}

/** How long the moon takes to go once round its planet from `ms`, in milliseconds: the angle it sweeps, added up in small steps until it is a whole turn. */
function periodOf(moon: MoonId, ms: number): number {
  const probe = 60_000;
  const first = angle(moonOffset(moon, ms), moonOffset(moon, ms + probe));
  const step = (probe * 0.5) / Math.max(1e-9, first);
  let swept = 0;
  let before = moonOffset(moon, ms);
  for (let i = 1; i <= 200_000; i += 1) {
    const now = moonOffset(moon, ms + i * step);
    const turned = angle(before, now);
    if (swept + turned >= 360) return (i - 1 + (360 - swept) / Math.max(1e-12, turned)) * step;
    swept += turned;
    before = now;
  }
  throw new Error(`${moon} did not go once round`);
}

/** How far the planet's north, laid across the line of sight, is from straight up in the picture, in degrees (signed: positive is north leaning to the picture's right); `null` inside the cone about the pole. */
function northOff(camera: BesideCamera, north: Vec3): number | null {
  const along = dot(north, camera.forward);
  if (Math.abs(along) > Math.cos(CONE * RAD)) return null;
  const right = cross(camera.forward, camera.up);
  return Math.atan2(dot(north, right), dot(north, camera.up)) / RAD;
}

function assertSound(camera: BesideCamera, where: string): void {
  for (const n of [...camera.position, ...camera.forward, ...camera.up, camera.fov]) assert.ok(Number.isFinite(n), `${where}: a number that is not finite`);
  assert.ok(Math.abs(length(camera.up) - 1) < 1e-9 && Math.abs(length(camera.forward) - 1) < 1e-9, `${where}: up and forward are unit vectors`);
  assert.ok(Math.abs(dot(camera.up, camera.forward)) < 1e-9, `${where}: up is square to the line of sight`);
}

test("the list of moons is the package's own, and every one has a planet", () => {
  assert.ok(MOONS.length >= 28, `${MOONS.length} moons`);
  for (const { moon, host } of MOONS) assert.equal(BODIES[moon].parent, host);
});

for (const { moon, host } of MOONS) {
  test(`beside ${moon} (${host}): north is within ${LIMIT} degrees of straight up at 16 moments through one orbit, in both scales, however the view is turned`, () => {
    const period = periodOf(moon, START);
    let skipped = 0;
    let seen = 0;
    for (const mode of SCALES) {
      for (let i = 0; i < 16; i += 1) {
        const ms = START + (i / 16) * period;
        const places = placesOf(moon, host, mode, ms);
        for (const [yaw, tilt] of [[0, 0], [90, 0], [180, 0], [270, 0], [45, 30], [200, -15]] as const) {
          for (const aspect of [1.78, 0.46]) {
            const where = `${moon}, ${mode}, moment ${i} of 16 (${new Date(ms).toISOString()}), yaw ${yaw}, tilt ${tilt}, shape ${aspect}`;
            const camera = besideMoon({ ...places, aspect, zoom: 1, yaw, tilt });
            assertSound(camera, where);
            const off = northOff(camera, places.north);
            // looking along the pole: there is no north to lay across the picture, so there is nothing to measure
            if (off === null) skipped += 1;
            else {
              seen += 1;
              assert.ok(Math.abs(off) <= LIMIT, `${where}: north is ${off.toFixed(2)} degrees from straight up`);
            }
          }
        }
      }
    }
    assert.ok(seen > 0 && skipped <= seen / 10, `${moon}: ${skipped} frames along the pole against ${seen} measured`);
  });

  // Up may follow the line of sight as the camera goes round, but the picture must not roll on its own: in one small step up turns by no more than the line of sight did, with a degree to spare. A view that
  // passes close to looking along its north fails this: north swings round the middle of the picture there.
  test(`beside ${moon} (${host}): the picture does not roll on its own as the moon goes once round (up turns no faster than the line of sight), in both scales`, () => {
    const period = periodOf(moon, START);
    const steps = 1440;
    for (const mode of SCALES) {
      let before: BesideCamera | null = null;
      let worst = 0;
      let note = "";
      for (let i = 0; i <= steps; i += 1) {
        const ms = START + (i / steps) * period;
        const places = placesOf(moon, host, mode, ms);
        const camera = besideMoon({ ...places, aspect: 1.78, zoom: 1, yaw: 0, tilt: 0 });
        assertSound(camera, `${moon}, ${mode}, step ${i}`);
        if (before !== null) {
          const rolled = angle(before.up, camera.up) - angle(before.forward, camera.forward);
          if (rolled > worst) {
            worst = rolled;
            note = `up turned ${angle(before.up, camera.up).toFixed(2)} degrees while the line of sight turned ${angle(before.forward, camera.forward).toFixed(2)}, at step ${i} of ${steps} (${new Date(ms).toISOString()}), looking ${Math.min(angle(camera.forward, places.north), 180 - angle(camera.forward, places.north)).toFixed(1)} degrees from the pole`;
          }
        }
        before = camera;
      }
      assert.ok(worst < 1, `${moon}, ${mode}: ${note}`);
    }
  });

  // The camera sits on the Sun's side of the line from the planet through the moon; as the moon crosses the line from the Sun through its planet that side swings round, and the camera must go round over
  // the planet's north side a little at a time, never hop to the other side in one step.
  test(`beside ${moon} (${host}): the line of sight never jumps as the moon goes once round (under ${JUMP} degrees in a step of 1/1440 of the orbit), in both scales`, () => {
    const period = periodOf(moon, START);
    const steps = 1440;
    for (const mode of SCALES) {
      let before: BesideCamera | null = null;
      let worst = 0;
      let note = "";
      for (let i = 0; i <= steps; i += 1) {
        const ms = START + (i / steps) * period;
        const camera = besideMoon({ ...placesOf(moon, host, mode, ms), aspect: 1.78, zoom: 1, yaw: 0, tilt: 0 });
        if (before !== null) {
          const turned = angle(before.forward, camera.forward);
          if (turned > worst) {
            worst = turned;
            note = `the line of sight turned ${turned.toFixed(2)} degrees at step ${i} of ${steps} (${new Date(ms).toISOString()})`;
          }
        }
        before = camera;
      }
      assert.ok(worst < JUMP, `${moon}, ${mode}: ${note}`);
    }
  });
}

test("beside the Moon at 17:16:35 on 11 November 2026, seven hours behind UTC: north is up, the Earth's north pole at the top", () => {
  const ms = Date.UTC(2026, 10, 12, 0, 16, 35);
  for (const mode of SCALES) {
    const places = placesOf("moon", "earth", mode, ms);
    const camera = besideMoon({ ...places, aspect: 1.78, zoom: 1, yaw: 0, tilt: 0 });
    const off = northOff(camera, places.north);
    assert.ok(off !== null && Math.abs(off) < 0.01, `${mode}: north is ${String(off)} degrees from straight up`);
    assert.ok(camera.up[1] > 0.9, `${mode}: up is ${camera.up.map((n) => n.toFixed(3)).join(",")}`);
  }
});

test("beside Enceladus at three moments over half its orbit (12:43, 17:53 and 04:31 the next day, seven hours behind UTC): north is up at each, and up does not turn over between them", () => {
  const moments = [Date.UTC(2026, 10, 11, 19, 43), Date.UTC(2026, 10, 12, 0, 53), Date.UTC(2026, 10, 12, 11, 31)];
  for (const mode of SCALES) {
    const ups = moments.map((ms) => {
      const places = placesOf("enceladus", "saturn", mode, ms);
      const camera = besideMoon({ ...places, aspect: 1.78, zoom: 1, yaw: 0, tilt: 0 });
      const off = northOff(camera, places.north);
      assert.ok(off !== null && Math.abs(off) < 0.01, `${mode}, ${new Date(ms).toISOString()}: north is ${String(off)} degrees from straight up`);
      assert.ok(camera.up[1] > 0.9, `${mode}: up is ${camera.up.map((n) => n.toFixed(3)).join(",")}`);
      return camera.up;
    });
    assert.ok(angle(ups[0]!, ups[1]!) < 30 && angle(ups[1]!, ups[2]!) < 30 && angle(ups[0]!, ups[2]!) < 30, `${mode}: up at the three moments stays the same way up`);
  }
});
