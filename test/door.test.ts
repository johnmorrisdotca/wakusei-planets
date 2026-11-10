// The data door of the planets (MODULES-831): the eight things every package's door is tested for, with a fake map source of a body's tiles and a fake source of small bodies, and the package's own folder of tiles faked on the network.
// 1 no source draws what it always drew and credits only the package's own; 2 a source adds its tiles and its credit, with its licence, in English and Japanese; 3 off, removing and `ownOnly` return the first picture, abort the loads
// and free the tiles; 4 bad input is refused or counted and never drawn; 5 at rest nothing is sent; 6 the byte budget holds; 7 the package's own sources are clear to pass on; 8 `src/data-door.ts` is kazoku-ui's template.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as THREE from "three";
import { MAX_RECORDS, TILE_BUDGET_BYTES, creditLine, validateSource, type Credit, type RecordSource } from "../src/data-door.ts";
import {
  OWN_SOURCES,
  createSourceBook,
  creditsOf,
  imageBytes,
  isSmallBody,
  mapKeys,
  ownCredit,
  packSmallBodies,
  readSmallBodies,
  smallBodyAt,
  tileKeyParts,
  tilesSource,
  type BodyMapSource,
  type SmallBody,
  type SmallBodySource,
  type SourceBook,
} from "../src/door/index.ts";
import { createDoorHost } from "../src/door/host.ts";
import { forgetManifests } from "../src/scene/detail.ts";
import { createPainter, type PaintInfo, type Painting } from "../src/scene/painter.ts";

const ms = Date.UTC(2026, 10, 2, 12);
const level = (n: number) => ({ level: n, width: 2048 * 2 ** n, height: 1024 * 2 ** n, columns: 4 * 2 ** n, rows: 2 * 2 ** n });
const MANIFEST = { tileSize: 512, bodies: { mars: { levels: [1, 2, 3].map(level) } } };

const three = {
  ...THREE,
  TextureLoader: class {
    setCrossOrigin(): void {}
    load(_url: string, ok: (t: THREE.Texture) => void): void {
      queueMicrotask(() => ok(new THREE.Texture()));
    }
  },
} as unknown as typeof THREE;

/** The network of the page: the package's own folder of tiles, faked, and a count of what was asked for. */
function fakeNetwork() {
  const log = { manifests: 0, tiles: [] as string[] };
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
const sleep = (time: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, time));

function cameraAt(distance: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return camera;
}
const info = (radiusPx: number, camera?: THREE.Camera): PaintInfo => ({ toSun: [0, 0, 1], ms, radiusPx, ...(camera === undefined ? {} : { view: { camera, width: 420, height: 420 } }) });

const sourceInfo = (id: string, change: Record<string, unknown> = {}) => ({
  id,
  name: { en: `Maps of ${id}`, ja: `${id}の地図` },
  credit: { en: `Maps: ${id}, A. Person (2026)`, ja: `地図：${id}（A. Person、2026年）` },
  licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
  url: `https://example.org/${id}`,
  retrieved: "2026-11-10",
  ...change,
});

/** A source of Mars's map in tiles, in memory: the tiles of every level, whose loads the test can see. */
function fakeMap(id = "fake", change: (key: string) => unknown = () => undefined) {
  const calls: string[] = [];
  const signals = new Map<string, AbortSignal>();
  const source: BodyMapSource = {
    kind: "tiles",
    info: sourceInfo(id),
    body: "mars",
    layer: "colour",
    levels: () => MANIFEST.bodies.mars.levels,
    need: (place, detail) => mapKeys(place, detail),
    load: async (key, signal) => {
      calls.push(key);
      signals.set(key, signal);
      const odd = change(key);
      if (odd !== undefined) return odd as never;
      return { width: 512, height: 512, image: { width: 512, height: 512, close() {} } };
    },
    bytes: imageBytes,
  };
  return { source, calls, signals };
}

function fakeBodies(id = "rocks", records: () => unknown[] = () => []): SmallBodySource {
  return { kind: "records", info: sourceInfo(id, { name: { en: "Rocks", ja: "岩" } }), records: records as () => SmallBody[] };
}
const rock = (name: string, change: Partial<SmallBody> = {}): SmallBody => ({ name, a: 2.77, e: 0.08, i: 10.6, node: 80.3, peri: 73.6, M0: 10, epoch: 2461000.5, H: 3.3, ...change });

/** Mars, painted, near a camera, drawn until the window of level 3 is on it. */
async function drawn(book: SourceBook, base: string | undefined, want = true) {
  forgetManifests();
  const log = fakeNetwork();
  const painter = createPainter({ textureBase: "/none/", farBase: "/none/", ...(base === undefined ? {} : { tiles: base }), book });
  const mars = painter.make(three, "Mars", { look: "painted", invalidate: () => undefined });
  await sleep(20);
  const camera = cameraAt(1.1);
  const draw = (): void => mars.update(info(1455, camera));
  draw();
  for (let i = 0; want && i < 40 && mars.tiles?.shown !== 3; i += 1) {
    await sleep(50);
    draw();
  }
  return { log, mars, draw, painter };
}
const sourceOf = (mars: Painting): string | undefined => mars.tiles?.source?.id;
const on = (mars: Painting): number => ((mars.object.children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uDetailOn!.value as number;
const own = (book: SourceBook, mars: Painting): Credit[] => {
  const shown = mars.tiles?.source;
  const used = shown === undefined || book.get(shown.id) === undefined ? new Map<string, number>() : new Map([[shown.id, mars.tiles!.used]]);
  return creditsOf(shown !== undefined && book.get(shown.id) === undefined ? [ownCredit(shown.id, mars.tiles!.used)] : [], book, used);
};

// ----- 1: no source -----
test("1. with no source a body is drawn from the package's own folder of tiles, as it always was, and credits that alone", async () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const { log, mars } = await drawn(book, "/tiles/");
  assert.equal(mars.tiles?.shown, 3);
  assert.equal(log.manifests, 1);
  assert.ok(log.tiles.length >= 1 && log.tiles.length <= 9, `${log.tiles.length} tiles for a patch a few degrees across`);
  assert.ok(log.tiles.every((tile) => /^mars\/3\/\d+\/\d+$/.test(tile)), "the folder's own addresses");
  assert.equal(on(mars), 1);
  assert.deepEqual(own(book, mars).map((credit) => [credit.source.id, credit.own, credit.used]), [["wakusei-tiles", true, log.tiles.length]]);
  assert.match(creditLine(own(book, mars), "en"), /^Finer map tiles: maps by NASA, USGS and JPL \(public domain\), cut by Wakusei Planets \(Public domain\)\.$/);
  assert.deepEqual(book.sources, [], "the folder is not a source of the page's");
  mars.dispose();
});

// ----- 2: with a source -----
test("2. a source of a body's map is drawn in place of the folder, exactly its tiles, and its credit has its licence in both languages", async () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const baseline = await drawn(createSourceBook({ kinds: ["tiles"] }), "/tiles/");
  const baseTiles = baseline.log.tiles.length;
  baseline.mars.dispose();
  const { source, calls } = fakeMap();
  book.addSource(source);
  const { log, mars } = await drawn(book, "/tiles/");
  assert.equal(mars.tiles?.shown, 3);
  assert.equal(calls.length, baseTiles, "the same window, from the source");
  assert.deepEqual(log.tiles, [], "the folder is not asked for a tile");
  assert.deepEqual([mars.tiles?.source?.id, mars.tiles?.used], ["fake", baseTiles]);
  const credits = own(book, mars);
  assert.deepEqual(credits.map((credit) => [credit.source.id, credit.own, credit.used]), [["fake", false, baseTiles]]);
  assert.match(creditLine(credits, "en"), /^Maps: fake, A\. Person \(2026\) \(CC BY-NC 4\.0; non-commercial\)\.$/);
  assert.equal(creditLine(credits, "ja"), "地図：fake（A. Person、2026年）（CC BY-NC 4.0、非営利のみ）");
  mars.dispose();
});

test("2b. records of small bodies are read once, frozen, and the ones that cannot be drawn are counted", async () => {
  let reads = 0;
  const book = createSourceBook();
  const bad = rock("bad", { e: 1.2 });
  book.addSource(
    fakeBodies("rocks", () => {
      reads += 1;
      return [rock("a"), rock("b", { a: Number.NaN }), bad, rock("c", { H: Infinity }), null, rock("d", { a: -1 }), rock("e")];
    }),
  );
  await sleep(10);
  assert.equal(reads, 1);
  assert.deepEqual(book.smallBodies().map((one) => one.name), ["a", "e"]);
  assert.deepEqual(book.stats().records, { rocks: { status: "ok", kept: 2, skipped: 5 } });
  assert.ok(Object.isFrozen(book.smallBodies()[0]) || Object.isFrozen(book.recordReads().get("rocks")!.records));
  book.stats();
  await sleep(10);
  assert.equal(reads, 1, "never read again");
});

test("2c. a small body is where its elements put it: on its ellipse, back where it began after a period, a quarter turn on after a quarter", () => {
  const circle = rock("c", { a: 2, e: 0, i: 0, node: 0, peri: 0, M0: 0 });
  const period = (2 * Math.PI) / (0.01720209895 / 2 ** 1.5);
  const [x0, y0, z0] = smallBodyAt(circle, circle.epoch);
  assert.deepEqual([x0, y0, z0].map((v) => Math.round(v * 1e9) / 1e9), [2, 0, 0]);
  const [x1, y1] = smallBodyAt(circle, circle.epoch + period / 4);
  assert.deepEqual([x1, y1].map((v) => Math.round(v * 1e6) / 1e6), [0, 2]);
  const [x2, y2, z2] = smallBodyAt(circle, circle.epoch + period);
  assert.deepEqual([x2, y2, z2].map((v) => Math.round(v * 1e6) / 1e6), [2, 0, 0]);
  const ceres = rock("Ceres", { a: 2.7656, e: 0.0795, i: 10.588, node: 80.25, peri: 73.3, M0: 291.4 });
  for (let k = 0; k < 40; k += 1) {
    const [x, y, z] = smallBodyAt(ceres, ceres.epoch + k * 40);
    const r = Math.hypot(x, y, z);
    assert.ok(r >= 2.7656 * (1 - 0.0795) - 1e-9 && r <= 2.7656 * (1 + 0.0795) + 1e-9, `r ${r}`);
    assert.ok(Math.abs(z) <= r * Math.sin((10.588 * Math.PI) / 180) + 1e-9, "never above its inclination");
  }
  const packed = packSmallBodies([ceres, circle], ceres.epoch + 10);
  assert.equal(packed.length, 16);
  assert.equal(packed[6], 10, "the days from the epoch to the date the shader counts from");
  assert.equal(isSmallBody(ceres) && !isSmallBody({ ...ceres, e: 1 }) && !isSmallBody({ ...ceres, a: 0 }) && !isSmallBody({ ...ceres, name: 3 }), true);
});

test("2d. the credits-changed event fires when the set of credited sources changes, not at each draw, and `sources` is all or nothing", () => {
  const target = new EventTarget();
  const seen: string[][] = [];
  target.addEventListener("wakusei-creditschange", (event) => seen.push((event as CustomEvent<{ credits: Credit[] }>).detail.credits.map((credit) => credit.source.id)));
  let used = new Map<string, number>();
  let redraws = 0;
  const host = createDoorHost(target, { own: () => [ownCredit("wakusei-pictures", 1)], used: () => used }, { kinds: ["tiles"] }, () => (redraws += 1));
  for (let n = 0; n < 5; n += 1) host.announce();
  assert.deepEqual(seen, [["wakusei-pictures"]]);
  host.book.addSource(fakeMap("one").source);
  used = new Map([["one", 4]]);
  host.announce();
  host.announce();
  assert.deepEqual(seen, [["wakusei-pictures"], ["wakusei-pictures", "one"]]);
  assert.ok(redraws >= 1, "a source added asks for a draw");
  host.book.removeSource("one");
  assert.deepEqual(seen.at(-1), ["wakusei-pictures"]);
  assert.throws(() => host.setSources([fakeMap("a").source, { ...fakeMap("b").source, info: sourceInfo("b", { credit: { en: "", ja: "" } }) }]), TypeError);
  assert.deepEqual(host.sources(), [], "nothing was set");
  host.setSources([fakeMap("a").source, fakeMap("b").source]);
  assert.deepEqual(host.sources().map((one) => one.info.id), ["a", "b"]);
  host.setSources([fakeMap("c").source]);
  assert.deepEqual(host.sources().map((one) => one.info.id), ["c"], "assigning replaces");
  assert.throws(() => host.setSources([fakeMap("d").source, fakeMap("d").source]), /already used/);
  assert.deepEqual(host.sources().map((one) => one.info.id), ["c"], "and a refused list changes nothing");
});

// ----- 3: off -----
test("3. remove(), enable(false) and ownOnly() return the first picture, abort the source's loads and free its tiles, and the source can come back", async () => {
  for (const how of ["remove", "enable", "own"] as const) {
    const book = createSourceBook({ kinds: ["tiles"] });
    const { source, calls } = fakeMap("fake");
    const remove = book.addSource(source);
    const { mars, draw, log } = await drawn(book, "/tiles/");
    assert.equal(mars.tiles?.shown, 3);
    assert.ok(book.stats().held >= 1);
    if (how === "remove") remove();
    else if (how === "enable") book.enableSource("fake", false);
    else book.ownOnly(true);
    assert.equal(book.stats().held, 0, `${how}: the tiles are freed`);
    draw();
    assert.equal(on(mars), 0, `${how}: the window is off the body`);
    assert.equal(sourceOf(mars), undefined, `${how}: its credit is gone`);
    assert.deepEqual(own(book, mars), []);
    // the picture is the folder's again, once the view settles
    for (let i = 0; i < 40 && mars.tiles?.shown !== 3; i += 1) {
      await sleep(50);
      draw();
    }
    assert.equal(mars.tiles?.shown, 3, `${how}: the folder's window comes back`);
    assert.equal(sourceOf(mars), "wakusei-tiles");
    assert.ok(log.tiles.length > 0);
    if (how !== "remove") {
      if (how === "enable") book.enableSource("fake", true);
      else book.ownOnly(false);
      const before = calls.length;
      for (let i = 0; i < 40 && sourceOf(mars) !== "fake"; i += 1) {
        await sleep(50);
        draw();
      }
      assert.equal(sourceOf(mars), "fake", `${how}: back on, it draws again`);
      assert.ok(calls.length >= before);
    }
    mars.dispose();
  }
});

test("3b. switching a source off aborts the loads still running, and an abort is not a failure; records are freed too", async () => {
  const book = createSourceBook();
  const aborted: string[] = [];
  const slow: BodyMapSource = {
    ...fakeMap("slow").source,
    load: (key, signal) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => {
          aborted.push(key);
          reject(new DOMException("aborted", "AbortError"));
        });
      }),
  };
  book.addSource(slow);
  const loader = book.loader(slow, "mars");
  book.store.want(loader, ["3/1/1", "3/2/1"]);
  assert.equal(book.stats().inFlight, 2);
  book.enableSource("slow", false);
  assert.deepEqual(aborted.sort(), ["3/1/1", "3/2/1"]);
  assert.equal(book.stats().failed, 0);
  assert.equal(book.stats().inFlight, 0);
  book.addSource(fakeBodies("rocks", () => [rock("a")]));
  await sleep(10);
  assert.equal(book.smallBodies().length, 1);
  book.ownOnly(true);
  assert.equal(book.smallBodies().length, 0, "records are freed");
  book.ownOnly(false);
  await sleep(10);
  assert.equal(book.smallBodies().length, 1, "and read again when the source comes back");
  assert.equal(book.removeSource("rocks"), true);
  assert.equal(book.removeSource("rocks"), false);
  assert.equal(book.smallBodies().length, 0);
});

test("3c. a map source the page adds as the package's own folder is the package's own, whatever it is called, and ownOnly keeps it", () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const folder = tilesSource("/tiles/");
  book.addSource(folder);
  const mine = fakeMap("wakusei-tiles-fake").source;
  book.addSource(mine);
  assert.equal(book.isOwn(folder), true);
  assert.equal(book.isOwn(mine), false);
  book.ownOnly(true);
  assert.deepEqual(book.active(), [folder]);
  assert.deepEqual(book.mapSources("mars"), [folder]);
  assert.deepEqual(book.mapSources("earth"), [folder], "a folder is for every body");
  assert.deepEqual(book.mapSources("mars", "height"), []);
});

// ----- 4: bad input -----
test("4. a source with an empty credit, no licence, a clashing id, no body or the wrong kind is refused at once and never kept", () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const base = fakeMap().source;
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a", { credit: { en: "", ja: "x" } }) }), /credit is empty \(en\)/);
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a", { credit: { en: "x", ja: " " } }) }), /credit is empty \(ja\)/);
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a", { licence: undefined }) }), /there is no licence/);
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a", { licence: { name: "", url: "https://example.org" } }) }), /licence has no name/);
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a", { licence: { name: "CC0", url: "" } }) }), /licence has no link/);
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("A B") }), /lower-case/);
  assert.throws(() => book.addSource({ ...base, body: "nowhere" }), /names its body/);
  assert.throws(() => book.addSource({ ...base, layer: "smell" }), /layer is "colour" or "height"/);
  assert.throws(() => book.addSource({ ...base, load: undefined }), /needs load/);
  assert.throws(() => book.addSource(fakeBodies()), /takes tiles sources, not records sources/);
  assert.throws(() => book.addSource(null), TypeError);
  book.addSource({ ...base, info: sourceInfo("a") });
  assert.throws(() => book.addSource({ ...base, info: sourceInfo("a") }), /already used/);
  assert.deepEqual(book.sources.map((one) => one.info.id), ["a"], "nothing refused was kept");
  assert.throws(() => validateSource({ ...base, info: sourceInfo("a", { retrieved: "2026-13-40" }) }), /retrieved must be a real day/);
});

test("4b. a tile that throws, is not a picture or has a size that is not a number is counted and never drawn, and nothing is thrown at the page", async () => {
  const plan = (key: string): unknown => {
    const n = Number(key.split("/")[2]);
    if (n % 3 === 0) throw new Error("sync");
    if (n % 3 === 1) return { width: Number.NaN, height: 512, image: {} };
    return { not: "a picture" };
  };
  const book = createSourceBook({ kinds: ["tiles"] });
  const { source } = fakeMap("odd", plan);
  book.addSource(source);
  const { mars } = await drawn(book, undefined, false);
  await sleep(600);
  mars.update(info(1455, cameraAt(1.1)));
  await sleep(300);
  assert.equal(mars.tiles?.shown, null, "the body keeps its own map");
  assert.equal(on(mars), 0);
  assert.ok(book.stats().failed >= 1, JSON.stringify(book.stats()));
  assert.equal(book.stats().held, 0, "nothing bad is held");
  assert.ok((mars.tiles?.failed ?? 0) >= 1);
  mars.dispose();
});

test("4c. a tile with a NaN size from the folder is failed too, and a source whose need() throws draws nothing and asks for nothing", async () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const bad: BodyMapSource = {
    ...fakeMap("bad").source,
    need: () => {
      throw new Error("need failed");
    },
  };
  book.addSource(bad);
  const { mars, log } = await drawn(book, "/tiles/", false);
  await sleep(500);
  mars.update(info(1455, cameraAt(1.1)));
  await sleep(200);
  assert.equal(mars.tiles?.shown, null);
  assert.deepEqual(log.tiles, []);
  assert.equal(book.stats().requested, 0);
  mars.dispose();
});

test("4d. a record source that throws, holds too many, or is not a list is a failed read that adds nothing", async () => {
  const book = createSourceBook();
  book.addSource(
    fakeBodies("boom", () => {
      throw new Error("offline");
    }),
  );
  book.addSource(fakeBodies("huge", () => new Array<SmallBody>(MAX_RECORDS + 1).fill(rock("h"))));
  book.addSource({ ...fakeBodies("notalist"), records: () => "nope" as never });
  await sleep(30);
  assert.deepEqual(Object.entries(book.stats().records).map(([id, read]) => [id, read.status, read.kept]), [["boom", "failed", 0], ["huge", "failed", 0], ["notalist", "failed", 0]]);
  const read = await readSmallBodies(fakeBodies("x", () => [rock("a"), rock("b", { e: 0.9999 })]), new AbortController().signal);
  assert.deepEqual([read.status, read.records.length, read.skipped], ["ok", 2, 0]);
  const aborted = new AbortController();
  aborted.abort();
  assert.equal((await readSmallBodies(fakeBodies("y"), aborted.signal)).status, "aborted");
});

// ----- 5: at rest -----
test("5. at rest the door sends nothing: drawing again, or waiting, is no request, and a failed window is not asked for again until the view changes", async () => {
  const book = createSourceBook({ kinds: ["tiles"] });
  const { source, calls } = fakeMap();
  book.addSource(source);
  const { mars, draw } = await drawn(book, "/tiles/");
  const sent = book.stats().requested;
  assert.equal(sent, calls.length);
  for (let i = 0; i < 10; i += 1) {
    draw();
    await sleep(20);
  }
  await sleep(500);
  assert.equal(book.stats().requested, sent);
  assert.equal(book.stats().inFlight + book.stats().queued, 0);
  mars.dispose();
  // a window that cannot be had is asked for once
  const lost = createSourceBook({ kinds: ["tiles"] });
  const { source: gone, calls: asked } = fakeMap("gone", () => {
    throw new Error("404");
  });
  lost.addSource(gone);
  const again = await drawn(lost, undefined, false);
  await sleep(300);
  again.draw();
  await sleep(400);
  again.draw();
  await sleep(400);
  const once = asked.length;
  assert.ok(once >= 1, "the window was tried");
  for (let i = 0; i < 10; i += 1) {
    again.draw();
    await sleep(30);
  }
  await sleep(600);
  assert.equal(asked.length, once, "not in a loop, and not on a timer");
  again.mars.dispose();
});

test("5b. at most six loads run at once for a source", async () => {
  const book = createSourceBook();
  let running = 0;
  let most = 0;
  const wide: BodyMapSource = {
    ...fakeMap("wide").source,
    load: async () => {
      running += 1;
      most = Math.max(most, running);
      await sleep(5);
      running -= 1;
      return { width: 8, height: 8, image: { width: 8, height: 8 } };
    },
  };
  book.addSource(wide);
  book.store.want(book.loader(wide, "mars"), Array.from({ length: 20 }, (_, n) => `3/${n}/0`));
  await book.store.idle();
  assert.equal(most, 6);
  assert.equal(book.stats().held, 20);
});

// ----- 6: the budget -----
test("6. more tiles than the budget leaves the held bytes at or under it, and the view keeps the picture it has", async () => {
  const one = imageBytes({ width: 512, height: 512, image: { width: 512, height: 512 } });
  const book = createSourceBook({ kinds: ["tiles"], budgetBytes: 2 * one });
  const { source } = fakeMap();
  book.addSource(source);
  const { mars } = await drawn(book, undefined, false);
  await sleep(800);
  mars.update(info(1455, cameraAt(1.1)));
  await sleep(200);
  const stats = book.stats();
  assert.ok(stats.heldBytes <= 2 * one, `held ${stats.heldBytes} of ${2 * one}`);
  assert.ok(stats.refused > 0, "the tiles that did not fit were counted");
  assert.equal(mars.tiles?.shown, null, "a window that does not fit is not drawn half made");
  assert.equal(TILE_BUDGET_BYTES, 48 * 1024 * 1024, "48 MB by default");
  mars.dispose();
});

// ----- 7: the package's own terms -----
test("7. the package's own sources are clear to pass on: none is non-commercial or share-alike, and each is a valid source", () => {
  assert.deepEqual(OWN_SOURCES.map((one) => one.id), ["wakusei-pictures", "wakusei-tiles", "wakusei-orbits"]);
  for (const one of OWN_SOURCES) {
    assert.notEqual(one.licence.nonCommercial, true, `${one.id} is non-commercial`);
    assert.notEqual(one.licence.shareAlike, true, `${one.id} is share-alike`);
    assert.doesNotMatch(`${one.licence.name} ${one.licence.spdx ?? ""}`, /non-?commercial|share-?alike|\b(?:NC|SA)\b/i, one.id);
    validateSource({ kind: "records", info: one, records: () => [] } satisfies RecordSource<unknown>);
    assert.ok(Object.isFrozen(one) && Object.isFrozen(one.licence), "a caller cannot change the package's own terms");
  }
  assert.equal(tilesSource("/tiles/").info, OWN_SOURCES[1]);
  assert.equal(ownCredit("wakusei-tiles", 3).own, true);
  assert.throws(() => ownCredit("fake", 1), RangeError);
  assert.equal(creditLine([ownCredit("wakusei-pictures", 1), ownCredit("wakusei-orbits", 5)], "ja"), "表面の地図：NASA、USGS、JPLの地図（パブリックドメイン）、Solar System Scope、Nestaeric（CC BY 4.0）／位置：VSOP87BとELP2000-82B（パリ天文台IMCCE）、JPL Horizons（NASA/JPL-Caltech）（Published for use with credit）");
});

// ----- 8: the template -----
test("8. src/data-door.ts is kazoku-ui's templates/data-door.ts, byte for byte", () => {
  // The recorded hash of kazoku-ui's templates/data-door.ts (line ends as "\n"); kazoku-ui's check-standard.mjs records the same one. Change it only by copying the template again.
  const RECORDED = "ae12207f4c1b89670b208baf306ea988df8c5f2213ae791a7044ca8681c31793";
  const text = readFileSync(new URL("../src/data-door.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(text).digest("hex"), RECORDED);
});

// ----- the shape of the map keys -----
test("the keys of a place are the tiles it touches on the package's pyramid, at the level the detail asks for, with a tile's own edge not counting as the next", () => {
  const quarter = { lonMin: -180, lonMax: -90, latMin: 0, latMax: 90 };
  assert.deepEqual(mapKeys(quarter, 4096), ["1/0/0", "1/1/0", "1/0/1", "1/1/1"]);
  assert.equal(mapKeys(quarter, 8192).length, 16, "level 2: 16 columns by 8 rows, a quarter of the width and a half of the height of its quarter");
  assert.ok(mapKeys(quarter, 1e9).every((key) => key.startsWith("3/")), "the finest level there is");
  assert.deepEqual(mapKeys({ lonMin: 170, lonMax: 190, latMin: 0, latMax: 1 }, 4096), ["1/7/1", "1/0/1"], "across the antimeridian");
  assert.equal(mapKeys({ lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 }, 4096).length, 8 * 4);
  assert.deepEqual(mapKeys({ lonMin: 5, lonMax: 5, latMin: 0, latMax: 1 }, 4096), []);
  assert.deepEqual(mapKeys(quarter, 4096, [], "mars/"), []);
  assert.deepEqual(mapKeys(quarter, 4096, undefined, "mars/")[0], "mars/1/0/0");
  assert.deepEqual(tileKeyParts("mars/3/12/5"), { level: 3, col: 12, row: 5 });
  assert.equal(tileKeyParts("mars"), undefined);
});
