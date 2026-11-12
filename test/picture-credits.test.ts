import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { OWN_SOURCES } from "../src/door/own.ts";
import { mercuryTilesCredit, PICTURE_CREDITS, picturesCredit } from "../src/picture-credits.ts";
import { forgetManifests } from "../src/scene/detail.ts";
import { createPainter, type PaintInfo } from "../src/scene/painter.ts";

test("Jupiter's picture is Nestaeric's, under CC BY 4.0, and the Moon and Mars name no CC BY source", () => {
  const jupiter = picturesCredit(["Jupiter"], "en");
  assert.match(jupiter, /Nestaeric/);
  assert.match(jupiter, /CC BY 4.0/);
  assert.match(jupiter, /Changes made/);
  assert.match(jupiter, /https:\/\/sketchfab.com\/3d-models\/jupiter-6380860bdb4247b98b30643615c3afab/);
  const plain = picturesCredit(["Moon", "Mars"], "en");
  assert.match(plain, /public domain/);
  assert.match(plain, /NASA/);
  assert.doesNotMatch(plain, /CC BY/);
  assert.doesNotMatch(plain, /Nestaeric/);
  assert.doesNotMatch(plain, /Solar System Scope/);
  assert.doesNotMatch(plain, /Shady Tex/);
  assert.equal(picturesCredit(["月"], "ja"), "", "a name that is not a body id is left out");
  const marsJa = picturesCredit(["Mars"], "ja");
  assert.match(marsJa, /火星/);
  assert.match(marsJa, /パブリックドメイン/);
  assert.doesNotMatch(marsJa, /CC BY/);
});

test("every CC BY 4.0 picture names its author and the changes, and a public-domain picture does not", () => {
  const cc = PICTURE_CREDITS.filter((row) => row.licence === "CC BY 4.0").map((row) => row.id);
  assert.deepEqual(cc, ["mercury", "venus", "jupiter", "saturn", "uranus", "neptune", "sun"]);
  for (const id of cc) {
    const line = picturesCredit([id], "en");
    assert.match(line, /CC BY 4.0/, id);
    assert.match(line, /Changes made/, id);
    assert.ok(line.length > 40, id);
  }
  assert.match(picturesCredit(["mercury"], "en"), /Shady Tex/);
  assert.match(picturesCredit(["mercury"], "en"), /Solar System Scope/);
  assert.match(picturesCredit(["uranus"], "en"), /NestaEric/);
  assert.match(picturesCredit(["saturn"], "en"), /public domain/, "Saturn's rings stay public domain beside the CC BY map");
  assert.equal(picturesCredit(["halley"], "en"), "");
  assert.equal(picturesCredit([], "en"), "");
  assert.match(mercuryTilesCredit("en"), /CC BY 4.0/);
  assert.match(mercuryTilesCredit("ja"), /CC BY 4.0/);
});

test("the painter credits the pictures it has made, every picture before that, and the tile row only while tiles are shown", () => {
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/", tiles: "off" });
  assert.match(painter.credit.en, /Nestaeric/);
  assert.match(painter.credit.en, /Shady Tex/);
  assert.match(painter.credit.en, /Solar System Scope/);
  assert.doesNotMatch(painter.credit.en, /Finer map tiles/);
  assert.match(painter.credit.ja, /Nestaeric/);

  const shaded = painter.make(THREE, "Jupiter", { look: "realistic" });
  assert.doesNotMatch(painter.credit.en, /Nestaeric/, "the shaded look draws no picture");
  assert.doesNotMatch(painter.credit.en, /CC BY/);
  shaded.dispose();

  const jupiter = painter.make(THREE, "Jupiter", { look: "painted" });
  assert.match(painter.credit.en, /Nestaeric/);
  assert.doesNotMatch(painter.credit.en, /Shady Tex/);
  jupiter.dispose();
  assert.equal(painter.credit.en, "", "letting the body go drops its picture");

  const moon = painter.make(THREE, "Moon", { look: "painted" });
  const mars = painter.make(THREE, "Mars", { look: "painted" });
  assert.match(painter.credit.en, /public domain/);
  assert.doesNotMatch(painter.credit.en, /CC BY/);
  assert.equal(OWN_SOURCES.find((source) => source.id === "wakusei-tiles")!.credit.en.includes("public domain"), true);
  moon.dispose();
  mars.dispose();
});

test("finer tiles add the tile credit while they are on the body, and Mercury's tiles keep the CC BY colour", async () => {
  forgetManifests();
  const level = (n: number) => ({ level: n, width: 2048 * 2 ** n, height: 1024 * 2 ** n, columns: 4 * 2 ** n, rows: 2 * 2 ** n });
  const manifest = { tileSize: 512, bodies: { mars: { levels: [1, 2, 3].map(level) }, mercury: { levels: [1, 2].map(level) } } };
  const g = globalThis as Record<string, unknown>;
  g["document"] = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }) }) };
  g["createImageBitmap"] = async () => ({ close() {} });
  g["fetch"] = async (url: string) => {
    if (String(url).endsWith("manifest.json")) return { ok: true, json: async () => manifest };
    return { ok: true, blob: async () => ({}) };
  };
  const three = {
    ...THREE,
    TextureLoader: class {
      setCrossOrigin(): void {}
      load(_url: string, ok: (t: THREE.Texture) => void): void {
        queueMicrotask(() => ok(new THREE.Texture()));
      }
    },
  } as unknown as typeof THREE;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, 1.1);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const draw = (body: { update(info: PaintInfo): void; tiles?: { shown: number | null } }): Promise<void> => {
    const info: PaintInfo = { toSun: [0, 0, 1], ms: Date.UTC(2026, 10, 2, 12), radiusPx: 1455, view: { camera, width: 420, height: 420 } };
    return (async () => {
      for (let i = 0; i < 40 && body.tiles?.shown == null; i += 1) {
        body.update(info);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    })();
  };
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/", tiles: "/tiles/" });
  const mars = painter.make(three, "Mars", { look: "painted", invalidate: () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 20));
  await draw(mars);
  assert.equal(mars.tiles?.shown, 3);
  assert.match(painter.credit.en, /Finer map tiles/);
  assert.doesNotMatch(painter.credit.en, /CC BY/);
  mars.dispose();
  assert.doesNotMatch(painter.credit.en, /Finer map tiles/, "letting the body go drops the tile credit");

  const mercury = painter.make(three, "Mercury", { look: "painted", invalidate: () => undefined });
  await draw(mercury);
  assert.ok(mercury.tiles?.shown != null);
  assert.match(painter.credit.en, /Finer map tiles/);
  assert.match(painter.credit.en, /Shady Tex/);
  assert.ok(painter.credit.en.includes(mercuryTilesCredit("en")));
  mercury.dispose();
  assert.equal(OWN_SOURCES[1]!.id, "wakusei-tiles");
});
