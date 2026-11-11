// The view from beside a moon (the camera beyond the moon and off the line to its planet): the moon is large, the planet is in view behind it and never hidden by it, in both scales and in any shape of view.
import assert from "node:assert/strict";
import { test } from "node:test";
import { besideMoon, BESIDE_RADII, type BesideInput } from "../src/space/index.ts";
import { cross, dot, length, RAD, type Vec3 } from "../src/vec.ts";

const TRUE: Omit<BesideInput, "aspect" | "zoom" | "yaw" | "tilt"> = { moon: [60.3, 3, -8], moonRadius: 0.2724, host: [0, 0, 0], hostRadius: 1, sun: [-23_000, 5000, 9000] };
const SQUEEZED: Omit<BesideInput, "aspect" | "zoom" | "yaw" | "tilt"> = { moon: [3.5, 0.4, -0.7], moonRadius: 0.273, host: [0, 0, 0], hostRadius: 1, sun: [-70, 12, 20] };
const minus = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const degrees = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (length(a) * length(b))))) / RAD;

/** Whether a disc of angular radius `radius` degrees at `centre` is whole inside a view of vertical field `fov` and the shape `aspect`. */
function fits(camera: ReturnType<typeof besideMoon>, centre: Vec3, radius: number, aspect: number): boolean {
  const direction = minus(centre, camera.position);
  const right = cross(camera.forward, camera.up);
  const z = dot(direction, camera.forward);
  if (z <= 0) return false;
  const across = Math.atan2(Math.abs(dot(direction, right)), z) / RAD + radius;
  const upward = Math.atan2(Math.abs(dot(direction, camera.up)), z) / RAD + radius;
  const halfV = camera.fov / 2;
  const halfH = Math.atan(Math.tan(halfV * RAD) * aspect) / RAD;
  return across <= halfH + 1e-6 && upward <= halfV + 1e-6;
}

for (const [name, scene] of [["true", TRUE], ["compressed", SQUEEZED]] as const) {
  for (const aspect of [1.78, 1, 0.46]) {
    test(`beside the Moon, ${name} scale, a view of shape ${aspect}: the Moon is large, the Earth is whole in view behind it, and the Moon does not hide it`, () => {
      const input: BesideInput = { ...scene, aspect, zoom: 1, yaw: 0, tilt: 0 };
      const camera = besideMoon(input);
      assert.ok(Math.abs(camera.distance - BESIDE_RADII * input.moonRadius) < 1e-9);
      const moonHalf = Math.asin(input.moonRadius / length(minus(input.moon, camera.position))) / RAD;
      const hostHalf = Math.asin(input.hostRadius / length(minus(input.host, camera.position))) / RAD;
      assert.ok(moonHalf > 8, `the Moon spans ${moonHalf.toFixed(1)} degrees across its radius`);
      assert.ok(camera.separation > moonHalf + hostHalf + 1.9, `${camera.separation.toFixed(1)} degrees apart, discs of ${moonHalf.toFixed(1)} and ${hostHalf.toFixed(1)}`);
      assert.ok(fits(camera, input.moon, moonHalf, aspect), "the Moon is whole in view");
      assert.ok(fits(camera, input.host, hostHalf, aspect), "the Earth is whole in view");
      // it is beyond the Moon: further from the Earth than the Moon is
      assert.ok(length(minus(camera.position, input.host)) > length(minus(input.moon, input.host)) * 0.99);
      assert.ok(Math.abs(length(camera.forward) - 1) < 1e-9 && Math.abs(length(camera.up) - 1) < 1e-9 && Math.abs(dot(camera.forward, camera.up)) < 1e-9);
    });
  }
}

test("in the true scale the Earth is seen at its real angular size from the Moon, about two degrees across", () => {
  const camera = besideMoon({ ...TRUE, aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 });
  const across = 2 * Math.asin(1 / length(minus(TRUE.host, camera.position))) / RAD;
  assert.ok(across > 1.7 && across < 2.2, `${across.toFixed(2)} degrees`);
});

test("zoom goes closer and further, yaw swings round the line to the Earth, tilt opens the angle, and the Earth stays clear of the Moon", () => {
  const base = besideMoon({ ...TRUE, aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 });
  assert.ok(Math.abs(besideMoon({ ...TRUE, aspect: 1.6, zoom: 2, yaw: 0, tilt: 0 }).distance - base.distance / 2) < 1e-9);
  assert.ok(Math.abs(besideMoon({ ...TRUE, aspect: 1.6, zoom: 0.5, yaw: 0, tilt: 0 }).distance - base.distance * 2) < 1e-9);
  const swung = besideMoon({ ...TRUE, aspect: 1.6, zoom: 1, yaw: 90, tilt: 0 });
  assert.ok(degrees(minus(swung.position, TRUE.moon), minus(base.position, TRUE.moon)) > 30, "a quarter turn moves the camera round the Moon");
  assert.ok(Math.abs(swung.separation - base.separation) < 1, "and the Earth stays as far from the Moon on the screen");
  const opened = besideMoon({ ...TRUE, aspect: 1.6, zoom: 1, yaw: 0, tilt: 30 });
  assert.ok(opened.separation > base.separation + 5);
  // a Sun straight behind the line (a full Moon) still gives a camera
  const full = besideMoon({ ...TRUE, sun: [-23_000, 0, 0], aspect: 1.6, zoom: 1, yaw: 0, tilt: 0 });
  assert.ok(Number.isFinite(full.position[0]) && full.separation > 20);
});

test("from beside a moon the picture is never upside down: whichever side the planet is on, up keeps to the north side of the scene, in both scales and at every yaw", () => {
  for (const scene of [TRUE, SQUEEZED]) {
    for (const sun of [scene.sun, [23_000, -5000, 9000] as Vec3, [0, 30_000, 0] as Vec3, [0, -30_000, 100] as Vec3]) {
      for (const yaw of [0, 45, 90, 135, 180, 225, 270, 315]) {
        const camera = besideMoon({ ...scene, sun, aspect: 1.78, zoom: 1, yaw, tilt: 0 });
        assert.ok(camera.up[1] >= 0, `sun ${sun.join(",")}, yaw ${yaw}: up ${camera.up.map((n) => n.toFixed(2)).join(",")}`);
        assert.ok(Math.abs(dot(camera.forward, camera.up)) < 1e-9);
      }
    }
  }
});
