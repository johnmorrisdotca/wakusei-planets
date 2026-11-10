// The finer map tiles in the portrait and the space view, in a real browser (Chromium, drawn in software) with a made-up tile set (every tile a flat colour for its level, see tiles-fixture.ts). Nothing is
// downloaded from anywhere. What is checked: that a far view fetches nothing, not even the manifest; that a close one asks for the tiles in view at the level it needs, each once, within a window; that they
// are drawn over the body; that the zoom range follows what the body has; that nothing is drawn at rest, and that what the window took is given back when the view moves away.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { detailOf, lookOf } from "../src/scene/look.ts";
import "../src/bodies/all.ts";
import { zoomLimit } from "../src/scene/reach.ts";
import { routeNoTiles, routeTiles } from "./tiles-fixture.ts";

test.describe.configure({ mode: "serial" });
test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.addInitScript(COUNT_SCRIPT);
});

type Tiles = { requested: number; loading: number; failed: number; shown: number | null };
const level = (tile: string): number => Number(tile.split("/")[1]);
const settle = (page: Page, ms: number): Promise<void> => page.waitForTimeout(ms);

/** The colour at the middle of an element, averaged over a few pixels. */
async function middle(page: Page, locator: Locator): Promise<[number, number, number]> {
  const png = (await locator.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(Math.floor(bitmap.width / 2) - 3, Math.floor(bitmap.height / 2) - 3, 6, 6);
    let r = 0;
    let g = 0;
    let b = 0;
    for (let i = 0; i < px.length; i += 4) [r, g, b] = [r + px[i]!, g + px[i + 1]!, b + px[i + 2]!];
    const n = px.length / 4;
    return [r / n, g / n, b / n] as [number, number, number];
  }, png);
}
const yellow = (c: number[]): boolean => Math.min(c[0]!, c[1]!) > 15 && c[2]! < 0.35 * Math.min(c[0]!, c[1]!);
const cyan = (c: number[]): boolean => Math.min(c[1]!, c[2]!) > 15 && c[0]! < 0.35 * Math.min(c[1]!, c[2]!);

// --- the portrait ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const PORTRAIT = "/wakusei-planets/embed.html";
const view = (page: Page): Locator => page.locator("#view");
type PortraitMetrics = { width: number; height: number; scale: number; camera: { h: number }; placed: { r: number }[] };
const portraitStats = (page: Page): Promise<{ tiles: Tiles | undefined; zoomMax: number | undefined }> => view(page).evaluate((el) => (el as unknown as { stats: { tiles: Tiles | undefined; zoomMax: number | undefined } }).stats);
const metrics = (page: Page): Promise<PortraitMetrics> => view(page).evaluate((el) => (el as unknown as { metrics: PortraitMetrics }).metrics);
const setPortraitZoom = (page: Page, zoom: number): Promise<void> => view(page).evaluate((el, z) => (el as unknown as { setView(v: unknown): void }).setView({ zoom: z }), zoom);

async function openPortrait(page: Page, scene: string): Promise<void> {
  await page.goto(`${PORTRAIT}?scene=${encodeURIComponent(scene)}`);
  await expect(view(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await settle(page, 800);
}

/** The zoom that puts this many device pixels along a radian of the first body (the pixel ratio is 1 here). */
async function portraitZoomFor(page: Page, pixelsPerRadian: number): Promise<number> {
  const m = await metrics(page);
  return pixelsPerRadian / (m.scale * m.placed[0]!.r);
}

test("the portrait: a far view fetches nothing, a close one fetches the tiles in view once each, draws them, frees them, and the zoom range follows what the body has", async ({ page }) => {
  const log = await routeTiles(page);
  await openPortrait(page, "look:painted~earth_0_0_0.6_0");
  await settle(page, 1500);
  expect(log.manifests, "a portrait that never zooms in does not read the tile set").toBe(0);
  expect(log.tiles).toEqual([]);
  const before = await portraitStats(page);
  expect(before.zoomMax, "the range is what the 2048 pixel map allows until the tiles are found").toBe(8);
  const base = gpuObjects(await readCounts(page));

  // a zoom that wants more than the 2048 pixel map: the tile set is read and the range follows the finest level
  await setPortraitZoom(page, await portraitZoomFor(page, 1500));
  await expect.poll(async () => (await portraitStats(page)).tiles?.shown, { timeout: 60_000 }).toBe(2);
  expect(log.manifests, "the tile set is read once").toBe(1);
  const m = await metrics(page);
  const extent = (m.camera.h * Math.min(1, m.width / m.height)) / m.placed[0]!.r;
  expect((await portraitStats(page)).zoomMax, "the finest level lifts the body's zoom range").toBe(zoomLimit(extent, 16384, detailOf(lookOf("earth")!).stretch > 1));
  await expect.poll(async () => cyan(await middle(page, view(page))), { timeout: 30_000, message: "the level 2 tiles are on the body" }).toBe(true);
  expect(log.tiles.every((tile) => level(tile) === 2)).toBe(true);
  expect(log.tiles.length, "only what is in view, within a window").toBeLessThanOrEqual(16);

  const first = log.tiles.length;
  await setPortraitZoom(page, await portraitZoomFor(page, 3200));
  await expect.poll(async () => (await portraitStats(page)).tiles?.shown, { timeout: 60_000 }).toBe(3);
  await expect.poll(async () => yellow(await middle(page, view(page))), { timeout: 30_000, message: "the level 3 tiles are on the body" }).toBe(true);
  expect(log.tiles.slice(first).every((tile) => level(tile) === 3)).toBe(true);
  expect(new Set(log.tiles).size, "no tile asked for twice").toBe(log.tiles.length);
  expect(gpuObjects(await readCounts(page)), "one window picture, not a texture a tile").toBeLessThanOrEqual(base + 4);

  // nothing is drawn at rest, and no tile is asked for again
  const asked = log.tiles.length;
  const rest = await readCounts(page);
  await settle(page, 2500);
  const later = await readCounts(page);
  expect(later.draws - rest.draws, "draw calls at rest").toBe(0);
  expect(later.rafRequests - rest.rafRequests, "frames asked for at rest").toBeLessThanOrEqual(1);
  expect(log.tiles.length, "tiles fetched at rest").toBe(asked);

  // zoomed out: the window is let go, and so is what it took
  await setPortraitZoom(page, 1);
  await expect.poll(async () => (await portraitStats(page)).tiles?.shown, { timeout: 30_000 }).toBeNull();
  await expect.poll(async () => !yellow(await middle(page, view(page))) && !cyan(await middle(page, view(page))), { timeout: 30_000, message: "and the map's own picture is drawn again" }).toBe(true);
  await settle(page, 1500);
  expect(gpuObjects(await readCounts(page)), "what the window took is given back").toBeLessThanOrEqual(base + 1);
  expect(log.manifests, "the tile set was read once in all").toBe(1);
});

test("the portrait: the Moon beside the Earth gets its tiles only when it is big in the view, and a tile that cannot be had is not asked for in a loop", async ({ page }) => {
  const log = await routeTiles(page, (tile) => level(tile) === 3);
  await openPortrait(page, "look:painted~moon_0_0_0.6_0");
  await setPortraitZoom(page, await portraitZoomFor(page, 3200));
  await expect.poll(async () => (await portraitStats(page)).tiles?.failed, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await settle(page, 3000);
  const stats = (await portraitStats(page)).tiles!;
  expect(stats.shown, "the body keeps its own map").toBeNull();
  expect(log.tiles.length, "tried once, not in a loop").toBeLessThanOrEqual(16);
  expect(yellow(await middle(page, view(page)))).toBe(false);
});

test("the portrait: without a tile set the range is the 2048 pixel map's, and no tile is asked for", async ({ page }) => {
  await routeNoTiles(page);
  await openPortrait(page, "look:painted~mars_0_0_0.6_0");
  await setPortraitZoom(page, await portraitZoomFor(page, 3200));
  await settle(page, 2500);
  const stats = await portraitStats(page);
  expect(stats.zoomMax).toBe(8);
  expect(stats.tiles?.requested ?? 0).toBe(0);
  expect(stats.tiles?.shown ?? null).toBeNull();
});

// --- the space view -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const SPACE = "wakusei-space";
const SPACE_PAGE = "/wakusei-planets/space.html";
const space = (page: Page): Locator => page.locator(SPACE);
const spaceStats = (page: Page): Promise<{ tiles: Tiles; draws: number; bodies: { painted: number } }> => space(page).evaluate((el) => (el as unknown as { stats: { tiles: Tiles; draws: number; bodies: { painted: number } } }).stats);
const goTo = (page: Page, body: string, zoom: number): Promise<void> =>
  space(page).evaluate(
    (el, [id, z]) => {
      const s = el as unknown as { body: string; setView(v: unknown): void };
      s.body = id as string;
      s.setView({ yaw: 0, tilt: 0, zoom: z });
    },
    [body, zoom],
  );

async function openSpace(page: Page): Promise<void> {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&look=painted`);
  await expect(space(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(async () => (await spaceStats(page)).bodies.painted, { timeout: 60_000 }).toBe(11);
  await settle(page, 800);
}

for (const [body, colour] of [["earth", yellow], ["mars", yellow], ["moon", yellow]] as const) {
  test(`the space view: the ${body}'s tiles are fetched once each, only for the part in view, at its surface, and given back when the camera moves away`, async ({ page }) => {
    const log = await routeTiles(page);
    await openSpace(page);
    await settle(page, 1500);
    expect(log.manifests, "a view that never gets near reads nothing").toBe(0);
    expect(log.tiles).toEqual([]);
    const base = gpuObjects(await readCounts(page));

    await goTo(page, body, 3.1);
    await expect.poll(async () => (await spaceStats(page)).tiles.shown, { timeout: 90_000 }).toBe(3);
    await expect.poll(async () => colour(await middle(page, space(page))), { timeout: 30_000, message: `the level 3 tiles of the ${body} are on it` }).toBe(true);
    expect(log.manifests, "the tile set is read once").toBe(1);
    expect(new Set(log.tiles).size, "no tile asked for twice").toBe(log.tiles.length);
    expect(log.tiles.length, "only what is in view: a few tiles, not a window of sixteen").toBeLessThanOrEqual(9);
    expect(log.tiles.every((tile) => tile.startsWith(`${body}/`)), "only this body's").toBe(true);

    const asked = log.tiles.length;
    const rest = await readCounts(page);
    await settle(page, 2500);
    const later = await readCounts(page);
    expect(later.draws - rest.draws, "draw calls at rest").toBe(0);
    expect(later.rafRequests - rest.rafRequests, "frames asked for at rest").toBeLessThanOrEqual(1);
    expect(log.tiles.length, "tiles fetched at rest").toBe(asked);

    await goTo(page, "earth", 1);
    await expect.poll(async () => (await spaceStats(page)).tiles.shown, { timeout: 30_000 }).toBeNull();
    await settle(page, 1500);
    expect(gpuObjects(await readCounts(page)), "what the window took is given back").toBeLessThanOrEqual(base + 3);
    expect(log.manifests).toBe(1);
  });
}

test("the space view: the far view keeps the package's own pictures, and a tile set that cannot be read leaves the surface as it was", async ({ page }) => {
  await routeNoTiles(page);
  await openSpace(page);
  await goTo(page, "earth", 3.1);
  await settle(page, 3000);
  const stats = (await spaceStats(page)).tiles;
  expect(stats.requested).toBe(0);
  expect(stats.shown).toBeNull();
  expect(await space(page).getAttribute("data-state")).toBe("live");
});
