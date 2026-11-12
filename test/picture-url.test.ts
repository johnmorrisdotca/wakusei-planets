import assert from "node:assert/strict";
import { test } from "node:test";
import "../src/bodies/all.ts";
import { lookOf } from "../src/scene/look.ts";
import { pictureUrl } from "../src/scene/picture-url.ts";

const mars = { map: "mars", widths: [512, 1024, 2048] as const, far: 2048 };

test("a width the near folder lacks is asked of the far folder, and of neither when they are the same", () => {
  assert.equal(pictureUrl("/near/", "/far/", mars, 512), "/near/mars-512.webp");
  assert.equal(pictureUrl("/near/", "/far/", mars, 1024), "/near/mars-1024.webp");
  assert.equal(pictureUrl("/near/", "/far/", mars, 2048), "/far/mars-2048.webp");
  assert.equal(pictureUrl("/pkg/", "/pkg/", mars, 2048), "/pkg/mars-1024.webp");
  assert.equal(pictureUrl("/pkg/", "/pkg/", mars, 1024), "/pkg/mars-1024.webp");
});

test("the moon, Mars and Venus cap at 1024 when there is no far folder", () => {
  for (const id of ["moon", "mars", "venus"] as const) {
    const map = lookOf(id)!.painted!;
    assert.equal(map.far, 2048);
    assert.equal(pictureUrl("/pkg/", "/pkg/", map, 2048), `/pkg/${map.map}-1024.webp`);
    assert.equal(pictureUrl("/pkg/", "/far/", map, 2048), `/far/${map.map}-2048.webp`);
  }
});
