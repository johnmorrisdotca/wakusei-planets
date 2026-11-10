import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { BODIES } from "../src/index.ts";
import { createPainter, moonOffset, orientation } from "../src/scene/painter.ts";
import { dot, length } from "../src/vec.ts";

const ms = Date.UTC(2026, 10, 2, 12);
const painter = createPainter({ textureBase: "/none/", farBase: "/none/" });

test("a planet is a radius-1 object that is turned about its real pole and lit in the scene's axes", () => {
  const mars = painter.make(THREE, "Mars", { look: "realistic" });
  mars.object.position.set(40, 3, -20);
  mars.object.scale.setScalar(0.6);
  mars.update({ toSun: [0, 0, 1], ms, radiusPx: 30 });
  const mesh = mars.object.children[0] as THREE.Mesh;
  const material = mesh.material as THREE.ShaderMaterial;
  assert.deepEqual(material.uniforms.uLight!.value.toArray(), [0, 0, 1]);
  assert.equal(material.uniforms.uScale!.value, 0.6);
  const { pole } = orientation("mars", ms);
  const up = new THREE.Vector3(0, 1, 0).applyMatrix4(mesh.matrix.clone().setPosition(0, 0, 0)).normalize();
  assert.ok(dot([up.x, up.y, up.z], pole) > 0.999);
  mars.dispose();
});

test("the poles are the IAU's: Mars leans toward the north celestial pole, Uranus lies on its side (its pole is near the ecliptic), Venus turns backwards", () => {
  const mars = orientation("mars", ms).pole;
  assert.ok(Math.abs(mars[1] - Math.sin((52.8865 * Math.PI) / 180)) < 0.01, String(mars));
  const uranus = orientation("uranus", ms).pole;
  const eclipticNorth: [number, number, number] = [0, Math.cos((23.4393 * Math.PI) / 180), Math.sin((23.4393 * Math.PI) / 180)];
  assert.ok(Math.abs(dot(uranus, eclipticNorth)) < 0.2, String(uranus));
  const a = orientation("venus", ms).meridian;
  const b = orientation("venus", ms + 3_600_000).meridian;
  const pole = orientation("venus", ms).pole;
  const turned = pole[0] * (a[1] * b[2] - a[2] * b[1]) + pole[1] * (a[2] * b[0] - a[0] * b[2]) + pole[2] * (a[0] * b[1] - a[1] * b[0]);
  assert.ok(turned < 0, "Venus turns clockwise seen from its north pole");
  const jupiter = orientation("jupiter", ms).meridian;
  const later = orientation("jupiter", ms + 3_600_000).meridian;
  assert.ok(dot(jupiter, later) < 0.9, "Jupiter turns about 36 degrees in an hour");
});

test("a moon that keeps one face to its planet shows it: the meridian points at the planet", () => {
  const io = orientation("io", ms).meridian;
  const offset = moonOffset("io", ms);
  const away = dot(io, [-offset[0] / length(offset), -offset[1] / length(offset), -offset[2] / length(offset)]);
  assert.ok(away > 0.99, String(away));
});

test("the Sun is a billboard with a glow and no ring; Saturn has a ring that the light and the pole reach", () => {
  const sun = painter.make(THREE, "sun");
  assert.equal(sun.billboard, true);
  assert.equal(sun.object.children.length, 2);
  sun.dispose();
  const saturn = painter.make(THREE, "Saturn", { look: "painted" });
  assert.equal(saturn.object.children.length, 2);
  saturn.update({ toSun: [1, 0, 0], ms, radiusPx: 20 });
  const ring = saturn.object.children[1] as THREE.Mesh;
  const pole = orientation("saturn", ms).pole;
  assert.ok(dot((ring.material as THREE.ShaderMaterial).uniforms.uRingN!.value.toArray(), pole) > 0.999);
  saturn.dispose();
});

test("every body can be made, in both looks, and let go: nothing is held after dispose", () => {
  const frees: string[] = [];
  for (const id of Object.keys(BODIES)) {
    for (const look of ["realistic", "painted"]) {
      const p = painter.make(THREE, id, { look });
      p.object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.addEventListener("dispose", () => frees.push(id));
      });
      p.update({ toSun: [1, 0, 0], ms, radiusPx: 10 });
      p.dispose();
    }
  }
  assert.ok(frees.length > 0);
  assert.throws(() => painter.make(THREE, "nibiru"), /no body called/);
});

test("the moons of a planet: the Galilean four for Jupiter, none for the Earth, nearest first, in the planet's radii", () => {
  const moons = painter.moons("Jupiter", ms);
  assert.deepEqual(moons.map((m) => m.name), ["Io", "Europa", "Ganymede", "Callisto"]);
  assert.ok(moons[0]!.offset.every(Number.isFinite));
  const io = length(moons[0]!.offset);
  assert.ok(io > 5.5 && io < 6.3, String(io));
  assert.ok(Math.abs(moons[2]!.radius - 2634.1 / 71492) < 0.005);
  assert.deepEqual(painter.moons("Earth", ms), []);
  assert.equal(painter.moons("Mercury", ms).length, 0);
  assert.equal(painter.moons("Pluto", ms).length, 3);
});

test("a time a day later moves the moon, and the same time gives the same place", () => {
  assert.deepEqual(moonOffset("europa", ms), moonOffset("europa", ms));
  assert.notDeepEqual(moonOffset("europa", ms), moonOffset("europa", ms + 86_400_000));
});

test("a painter told to map every body asks for each body's picture in the realistic look too, and asks for none of a body that has no picture", () => {
  const asked = (id: string, context: Record<string, unknown>): string[] => {
    const urls: string[] = [];
    class Recorder {
      setCrossOrigin(): void {}
      load(url: string): void {
        urls.push(url);
      }
    }
    const body = painter.make({ ...THREE, TextureLoader: Recorder } as unknown as typeof THREE, id, context);
    body.dispose();
    return urls;
  };
  for (const [id, map] of [["mars", "mars"], ["moon", "moon"], ["mercury", "mercury"], ["venus", "venus"], ["jupiter", "jupiter"], ["saturn", "saturn"], ["uranus", "uranus"], ["neptune", "neptune"], ["pluto", "pluto"], ["io", "io"], ["titan", "titan"], ["triton", "triton"], ["charon", "charon"]] as const) {
    assert.deepEqual(asked(id, { look: "realistic" }), [], `${id} is shaded in the realistic look, with no picture asked for, unless told to map`);
    const urls = asked(id, { look: "realistic", mapped: true });
    assert.ok(urls.some((url) => new RegExp(`/${map}-\\d+\\.webp$`).test(url)), `${id} asks for its map when told to map every body: ${urls.join(" ")}`);
  }
  for (const id of ["phobos", "deimos", "miranda", "dysnomia"]) assert.deepEqual(asked(id, { look: "realistic", mapped: true }), [], `${id} has no map and stays shaded`);
});
