import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { createPainter } from "../src/scene/painter.ts";
import { pictureHeld, releaseBodyPicture } from "../src/space/picture-keep.ts";

const ms = Date.UTC(2026, 10, 2, 14);

test("a picture that was let go is loaded again: the look is cleared, and one never on screen is kept", () => {
  let disposed = 0;
  const slot = { drawing: { dispose: () => { disposed += 1; } }, look: "painted" as string | null };
  releaseBodyPicture(slot);
  assert.equal(disposed, 1);
  assert.equal(slot.drawing, undefined);
  assert.equal(slot.look, null, "a look left set would skip the next picture");
  assert.equal(pictureHeld(0, 10_000, 4000), true, "the opening view keeps a body that has not been on screen");
  assert.equal(pictureHeld(1000, 5000, 4000), true);
  assert.equal(pictureHeld(1000, 5001, 4000), false, "after the wait the picture is dropped, and the next visit loads it");
});

test("a closer picture that was let go is fetched again when the body is large", async () => {
  const urls: string[] = [];
  class Loader {
    setCrossOrigin(): void {}
    load(url: string, done: (texture: THREE.Texture) => void): void {
      urls.push(url);
      done(new THREE.Texture());
    }
  }
  const body = createPainter({ textureBase: "/pkg/", farBase: "/far/" }).make({ ...THREE, TextureLoader: Loader } as unknown as typeof THREE, "earth", { look: "painted" });
  const flush = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
  await flush();
  body.update({ toSun: [1, 0, 0], ms, radiusPx: 4000 });
  await flush();
  const sharp = urls.filter((url) => url.endsWith("-2048.webp"));
  assert.ok(sharp.length >= 1, `the close view fetches the sharp picture: ${urls.join(" ")}`);
  const before = urls.length;
  body.update({ toSun: [1, 0, 0], ms, radiusPx: 20 });
  await new Promise((resolve) => { setTimeout(resolve, 4200); });
  body.update({ toSun: [1, 0, 0], ms, radiusPx: 20 });
  body.update({ toSun: [1, 0, 0], ms, radiusPx: 4000 });
  await flush();
  const again = urls.slice(before).filter((url) => url.endsWith("-2048.webp"));
  assert.ok(again.length >= 1, `the sharp picture is fetched again after it was let go: ${urls.slice(before).join(" ")}`);
  body.dispose();
});
