// Eros is drawn as the mesh NASA published, with that model's own picture on its faces.
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { test } from "node:test";
import { EROS_CRAFT } from "../src/data/shapes/eros-craft.ts";
import { craftArrays, craftMaterial } from "../src/scene/craft.ts";
import { lookOf } from "../src/scene/look.ts";
import "../src/bodies/all.ts";

test("Eros's mesh is the published model, and its picture is the file the mesh names", async () => {
  const mesh = await lookOf("eros")!.craft!();
  assert.equal(mesh, EROS_CRAFT);
  const arrays = craftArrays(mesh);
  assert.equal(arrays.positions.length, 839 * 3);
  assert.equal(arrays.normals.length, 839 * 3);
  assert.equal(arrays.uvs.length, 839 * 2);
  assert.equal(arrays.indices.length, 1536 * 3);
  assert.equal(mesh.map, "eros-craft-512.webp");
  assert.ok(existsSync(`textures/${mesh.map}`));
  assert.ok(statSync(`textures/${mesh.map}`).size < 40_000, "the picture stays small");
  let farthest = 0;
  for (let i = 0; i < arrays.positions.length; i += 3) {
    const r = Math.hypot(arrays.positions[i]!, arrays.positions[i + 1]!, arrays.positions[i + 2]!);
    if (r > farthest) farthest = r;
  }
  // the long axis is about twice the mean radius, and the whole body fits the picture's frame (2.2 radii)
  assert.ok(farthest > 1.8 && farthest < 2.2, farthest.toFixed(3));
});

test("the craft material keeps the uniforms the body page writes on every material", () => {
  let uniforms: Record<string, unknown> = {};
  const three = {
    ShaderMaterial: class {
      constructor(options: { uniforms: Record<string, unknown> }) {
        uniforms = options.uniforms;
      }
    },
    Vector3: class {
      x: number;
      y: number;
      z: number;
      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
    },
  };
  craftMaterial(three as never, 0.12);
  for (const key of ["uMap", "uLight", "uAmbient", "uWrap", "uRimBase", "uScale", "uRingN", "uOccN", "uOcc"]) {
    assert.ok(Object.hasOwn(uniforms, key), key);
  }
});
