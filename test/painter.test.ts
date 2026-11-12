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

test("the Sun is a globe with a glow and no ring; Saturn has a ring that the light and the pole reach", () => {
  const sun = painter.make(THREE, "sun");
  assert.equal(sun.billboard, undefined, "the object is not turned to the camera: the globe keeps its own orientation");
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

test("the Sun turns about its own pole with time, and the glow, not the globe, faces the camera", () => {
  const sun = painter.make(THREE, "sun");
  const meshes = sun.object.children as THREE.Mesh[];
  const glow = meshes.find((m) => m.geometry.type === "PlaneGeometry")!;
  const globe = meshes.find((m) => m !== glow)!;
  const camera = new THREE.PerspectiveCamera();
  camera.quaternion.setFromEuler(new THREE.Euler(0.4, 1.1, -0.3));
  const view = { camera, width: 400, height: 300 };
  sun.update({ toSun: [0, 0, 1], ms, radiusPx: 60, view });
  // the glow is turned to the camera: it carries the camera's own rotation
  assert.ok(glow.quaternion.angleTo(camera.quaternion) < 1e-6);
  // the globe is not: its basis is the Sun's pole and prime meridian (about 25 days a turn at the equator, 14.18 degrees a day)
  const { pole, meridian } = orientation("sun", ms);
  const up = new THREE.Vector3(0, 1, 0).applyMatrix4(globe.matrix.clone().setPosition(0, 0, 0)).normalize();
  assert.ok(dot([up.x, up.y, up.z], pole) > 0.999);
  sun.update({ toSun: [0, 0, 1], ms: ms + 86_400_000, radiusPx: 60, view });
  const later = orientation("sun", ms + 86_400_000).meridian;
  const angle = (Math.acos(Math.min(1, dot(meridian, later))) * 180) / Math.PI;
  assert.ok(Math.abs(angle - 14.18) < 0.3, `${angle} degrees in a day`);
  // and turning the camera leaves the globe's basis where it was
  const before = globe.matrix.clone();
  camera.quaternion.setFromEuler(new THREE.Euler(-1, 0.2, 0.7));
  sun.update({ toSun: [0, 0, 1], ms: ms + 86_400_000, radiusPx: 60, view });
  assert.ok(globe.matrix.equals(before), "the globe does not follow the camera");
  assert.ok(glow.quaternion.angleTo(camera.quaternion) < 1e-6, "the glow does");
  sun.dispose();
});

test("the painter asks a page's own textureBase only for the widths the npm package ships: the sharpest come from farBase, or are not asked for", async () => {
  const { BODY_IDS } = await import("../src/index.ts");
  const { lookOf } = await import("../src/scene/look.ts");
  const { TEXTURE_FAR_BASE } = await import("../src/scene/textures.ts");
  // the package ships the 512 and 1024 of each map (scripts/copy-textures.mjs); a look's `far` width and up are only in the repository
  const shipped = /-(512|1024)\.webp$/;
  /** Every picture a body asks for while it grows from small to filling the screen; each picture arrives at once. */
  const asked = async (painter: ReturnType<typeof createPainter>, id: string): Promise<string[]> => {
    const urls: string[] = [];
    class Loader {
      setCrossOrigin(): void {}
      load(url: string, done: (t: THREE.Texture) => void): void {
        urls.push(url);
        done(new THREE.Texture());
      }
    }
    const body = painter.make({ ...THREE, TextureLoader: Loader } as unknown as typeof THREE, id, { look: "painted" });
    for (const radiusPx of [20, 200, 800, 2000, 4000, 4000]) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      body.update({ toSun: [1, 0, 0], ms, radiusPx });
    }
    body.dispose();
    return urls.filter((url) => /\.webp$/.test(url) && !/-ring-/.test(url));
  };
  const own = createPainter({ textureBase: "/pkg/" });
  const withFar = createPainter({ textureBase: "/pkg/", farBase: "/far/" });
  const plain = createPainter();
  let sharpest = 0;
  for (const id of BODY_IDS as string[]) {
    const painted = lookOf(id as never)?.painted;
    if (painted === undefined) continue;
    const top = Math.max(...painted.widths);
    // only textureBase: never a width the package lacks (the 404s of moon, mars and venus 2048), and still the widest it has
    const mine = await asked(own, id);
    assert.ok(mine.length > 0, `${id} asks for a picture`);
    for (const url of mine) assert.match(url, shipped, `${id}: ${url} is not in the npm package`);
    assert.ok(mine.some((url) => url.endsWith("-1024.webp")), `${id} still gets the widest the package ships: ${mine.join(" ")}`);
    // with farBase: the far width comes from there, the rest from textureBase
    if (painted.far !== undefined && top >= painted.far) {
      sharpest += 1;
      const far = await asked(withFar, id);
      assert.ok(far.includes(`/far/${painted.map}-${top}.webp`), `${id} asks the far base for ${top}: ${far.join(" ")}`);
      for (const url of far.filter((u) => u.startsWith("/pkg/"))) assert.match(url, shipped, `${id}: ${url}`);
      // the default painter: jsDelivr's npm address for the package's widths, its GitHub address for the far one
      assert.ok((await asked(plain, id)).includes(`${TEXTURE_FAR_BASE}${painted.map}-${top}.webp`), `${id} asks the default far base for ${top}`);
    }
  }
  assert.ok(sharpest >= 10, `bodies with a far 2048: ${sharpest}`);
});
