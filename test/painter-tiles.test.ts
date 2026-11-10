// The painter with a camera: a body that is big in the view reads the tile set, fetches the tiles of the part in view once each, and lays the window over its map; a body told of no camera, or a small one, does none of it.
// three.js is real; the network and the 2D canvas are faked (no tile is downloaded from anywhere).
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { createPainter } from "../src/scene/painter.ts";
import { forgetManifests } from "../src/scene/detail.ts";
import type { PaintInfo } from "../src/scene/painter.ts";

const ms = Date.UTC(2026, 10, 2, 12);
const level = (n: number) => ({ level: n, width: 2048 * 2 ** n, height: 1024 * 2 ** n, columns: 4 * 2 ** n, rows: 2 * 2 ** n });
const MANIFEST = { tileSize: 512, bodies: { mars: { levels: [1, 2, 3].map(level) } } };

// the textures arrive at once, and a tile is a picture of nothing
const three = {
  ...THREE,
  TextureLoader: class {
    setCrossOrigin(): void {}
    load(_url: string, ok: (t: THREE.Texture) => void): void {
      queueMicrotask(() => ok(new THREE.Texture()));
    }
  },
} as unknown as typeof THREE;

interface Log {
  manifests: number;
  tiles: string[];
}
function fakeNetwork(): Log {
  const log: Log = { manifests: 0, tiles: [] };
  const g = globalThis as Record<string, unknown>;
  g["document"] = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) };
  g["createImageBitmap"] = async () => ({ close() {} });
  g["fetch"] = async (url: string) => {
    if (url.endsWith("manifest.json")) {
      log.manifests += 1;
      return { ok: true, json: async () => MANIFEST };
    }
    log.tiles.push(url.split("/tiles/")[1]!.replace(".webp", ""));
    return { ok: true, blob: async () => ({}) };
  };
  return log;
}
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A perspective camera `distance` radii from the origin, looking at it, in a view 420 pixels square. */
function cameraAt(distance: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
const info = (radiusPx: number, camera?: THREE.Camera): PaintInfo => ({ toSun: [0, 0, 1], ms, radiusPx, ...(camera === undefined ? {} : { view: { camera, width: 420, height: 420 } }) });

test("a body near a camera reads the tile set and lays a window of the tiles in view over its map, each tile fetched once", async () => {
  forgetManifests();
  const log = fakeNetwork();
  let redraws = 0;
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/", tiles: "/tiles/" });
  const mars = painter.make(three, "Mars", { look: "painted", invalidate: () => (redraws += 1) });
  await sleep(20);
  const camera = cameraAt(1.1);
  const draw = (): void => mars.update(info(1455, camera));
  draw();
  for (let i = 0; i < 40 && mars.tiles?.shown !== 3; i += 1) {
    await sleep(50);
    draw();
  }
  assert.equal(mars.tiles?.shown, 3, JSON.stringify(mars.tiles));
  assert.equal(log.manifests, 1);
  assert.ok(log.tiles.length >= 1 && log.tiles.length <= 9, `${log.tiles.length} tiles for a patch a few degrees across`);
  assert.equal(new Set(log.tiles).size, log.tiles.length, "no tile twice");
  assert.ok(log.tiles.every((tile) => /^mars\/3\/\d+\/\d+$/.test(tile)));
  const material = (mars.object.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
  assert.equal(material.uniforms.uDetailOn!.value, 1, "the window is on the map");
  assert.ok(redraws >= 1, "a draw was asked for when the window was ready");
  const asked = log.tiles.length;
  for (let i = 0; i < 5; i += 1) {
    draw();
    await sleep(40);
  }
  assert.equal(log.tiles.length, asked, "no tile again while the view stays inside the window");
  // the camera backs away: the window is let go
  mars.update(info(300, cameraAt(3.4)));
  assert.equal(mars.tiles?.level, null, "the body's own picture is sharp enough from here");
  mars.dispose();
  assert.equal(material.uniforms.uDetailOn!.value, 0);
});

test("no camera, a small disc or no tile set means no tile set read and no tile fetched", async () => {
  forgetManifests();
  const log = fakeNetwork();
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/", tiles: "/tiles/" });
  const mars = painter.make(three, "Mars", { look: "painted", invalidate: () => undefined });
  await sleep(20);
  mars.update(info(1455));
  mars.update(info(100, cameraAt(1.1)));
  mars.update(info(300, cameraAt(3.4)));
  await sleep(400);
  assert.equal(log.manifests, 0, "the far view reads nothing");
  assert.deepEqual(log.tiles, []);
  mars.dispose();
  const bare = createPainter({ textureBase: "/none/", farBase: "/none/" }).make(three, "Mars", { look: "painted", invalidate: () => undefined });
  assert.equal(bare.tiles, undefined, "a painter that was given its own pictures has no tile set unless it is told where it is");
  bare.update(info(1455, cameraAt(1.1)));
  await sleep(300);
  assert.equal(log.manifests, 0);
  bare.dispose();
  const sun = createPainter({ tiles: "/tiles/" }).make(three, "Sun");
  assert.equal(sun.tiles, undefined, "a glowing body is drawn as it always was");
  sun.dispose();
});
