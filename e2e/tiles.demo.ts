// The finer map tiles, in a real browser (Chromium, drawn in software) with a made-up tile set (every tile a flat colour for its level): which tiles are asked for, that they are drawn over the body's
// own map, that they and their decoded pictures are freed when the zoom drops, that a tile that cannot be had leaves the map as it was, and that the zoom range follows what the body has.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { zoomLimit } from "../src/scene/reach.ts";
import { ROOM } from "../src/scene/extent.ts";
import { routeNoTiles, routeTiles } from "./tiles-fixture.ts";

test.describe.configure({ mode: "serial" });
test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.addInitScript(COUNT_SCRIPT);
});

const URL = "/wakusei-planets/";
type Stats = { textureWidth: number; zoomMax: number | undefined; tiles: { ready: boolean; level: number | null; shown: number | null; held: number; loading: number; failed: number; requested: number; pixels: number } | undefined };
const main = (page: Page): Locator => page.locator("#main");
const statsOf = (page: Page): Promise<Stats> => main(page).evaluate((el) => (el as unknown as { stats: Stats }).stats);
const setZoom = (page: Page, zoom: number): Promise<void> => main(page).evaluate((el, z) => (el as unknown as { setView(v: unknown): void }).setView({ zoom: z }), zoom);

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${URL}?${query}`);
  await main(page).hover();
  await expect(main(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(async () => (await statsOf(page)).textureWidth, { timeout: 60_000 }).toBeGreaterThanOrEqual(512);
}

/** The zoom that puts this many device pixels along a radian of the body at the middle of the picture (the pixel ratio is 1 here), for a body alone: the picture's short side is what the zoom is measured against. */
async function zoomFor(page: Page, pixelsPerRadian: number): Promise<number> {
  const box = (await main(page).boundingBox())!;
  return (pixelsPerRadian * 2 * ROOM) / Math.min(box.width, box.height);
}

/** The colour at the middle of a picture, averaged over a few pixels. */
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
const cyan = (c: number[]): boolean => Math.min(c[1]!, c[2]!) > 15 && c[0]! < 0.35 * Math.min(c[1]!, c[2]!);
const yellow = (c: number[]): boolean => Math.min(c[0]!, c[1]!) > 15 && c[2]! < 0.35 * Math.min(c[0]!, c[1]!);
const level = (tile: string): number => Number(tile.split("/")[1]);

test("a close zoom asks for the tiles in view at the level it needs, draws them over the map, and frees them when the zoom drops", async ({ page }) => {
  const log = await routeTiles(page);
  await open(page, "body=mars&look=realistic");
  await expect.poll(async () => (await statsOf(page)).tiles?.ready, { message: "the tile set is read" }).toBe(true);
  expect((await statsOf(page)).zoomMax, "the finest level lifts the body's zoom range").toBe(zoomLimit(ROOM, 16384, false));
  expect(log.tiles, "nothing is fetched while the map is sharp enough").toEqual([]);
  const base = gpuObjects(await readCounts(page));

  await setZoom(page, await zoomFor(page, 1500));
  await expect.poll(async () => (await statsOf(page)).tiles?.shown, { timeout: 60_000 }).toBe(2);
  await expect.poll(async () => cyan(await middle(page, main(page))), { timeout: 30_000, message: "the level 2 tiles are on the body" }).toBe(true);
  expect(log.tiles.every((tile) => level(tile) === 2), "level 2 only").toBe(true);
  expect(new Set(log.tiles).size, "no tile asked for twice").toBe(log.tiles.length);
  expect(log.tiles.length, "only what is in view, within a window").toBeLessThanOrEqual(16);

  const first = log.tiles.length;
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.shown, { timeout: 60_000 }).toBe(3);
  await expect.poll(async () => yellow(await middle(page, main(page))), { timeout: 30_000, message: "the level 3 tiles are on the body" }).toBe(true);
  expect(log.tiles.slice(first).every((tile) => level(tile) === 3)).toBe(true);
  expect(gpuObjects(await readCounts(page)), "one window picture, not a texture a tile").toBeLessThanOrEqual(base + 4);
  expect((await statsOf(page)).tiles!.pixels, "the window is at most a 2048 pixel square's worth").toBeLessThanOrEqual(2048 * 2048);

  // nothing is drawn at rest, though the window is on the body
  const rest = await readCounts(page);
  await page.waitForTimeout(2500);
  const later = await readCounts(page);
  expect(later.draws - rest.draws, "draw calls at rest").toBe(0);
  expect(later.rafRequests - rest.rafRequests, "frames asked for at rest").toBeLessThanOrEqual(1);

  // zoomed out: the window is let go after a few seconds, and so are the decoded tiles
  await setZoom(page, 1);
  await expect.poll(async () => (await statsOf(page)).tiles?.shown, { timeout: 30_000 }).toBeNull();
  await expect.poll(async () => (await statsOf(page)).tiles?.held, { timeout: 30_000 }).toBe(0);
  await expect.poll(async () => !yellow(await middle(page, main(page))) && !cyan(await middle(page, main(page))), { timeout: 30_000, message: "and the map's own picture is drawn again" }).toBe(true);
  await page.waitForTimeout(1500);
  expect(gpuObjects(await readCounts(page)), "what the window took is given back").toBeLessThanOrEqual(base + 1);
});

test("a tile that cannot be had leaves the map as it was, and is not asked for in a loop", async ({ page }) => {
  const log = await routeTiles(page, (tile) => level(tile) === 3);
  await open(page, "body=mars&look=realistic");
  await expect.poll(async () => (await statsOf(page)).tiles?.ready).toBe(true);
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.failed, { timeout: 60_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(3000);
  const stats = (await statsOf(page)).tiles!;
  expect(stats.shown, "the body keeps its own map").toBeNull();
  expect(log.tiles.length, "tried once, not in a loop").toBeLessThanOrEqual(16);
  expect(yellow(await middle(page, main(page)))).toBe(false);
  expect(await main(page).getAttribute("data-fallback"), "the map still draws: this is not the shader fallback").toBeNull();
});

test("without a tile set the body keeps the zoom range its map allows, and asks for no tile", async ({ page }) => {
  await routeNoTiles(page);
  await open(page, "body=mars&look=realistic");
  await setZoom(page, await zoomFor(page, 3200));
  await page.waitForTimeout(2000);
  const stats = await statsOf(page);
  expect(stats.zoomMax).toBe(zoomLimit(ROOM, 2048, false));
  expect(stats.tiles?.requested ?? 0).toBe(0);
  expect(stats.tiles?.shown ?? null).toBeNull();
});

test("tiles=off asks for nothing, not even the manifest", async ({ page }) => {
  const log = await routeTiles(page);
  await page.goto(`${URL}?body=mars&look=realistic`);
  await main(page).evaluate((el) => el.setAttribute("tiles", "off"));
  await main(page).hover();
  await expect(main(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await setZoom(page, 20);
  await page.waitForTimeout(2500);
  expect(log.manifests + log.tiles.length).toBe(0);
});

test("a moons picture of Saturn zooms right up to the planet: its range is far past 8, and the bar can go there", async ({ page }) => {
  await routeNoTiles(page);
  await open(page, "body=saturn&look=realistic&moons=1&sky=real");
  const limits = () => page.locator("#controls").evaluate((el) => ({ ...(Reflect.get(el, "controller") as { limits: { zoomMax: number } }).limits }));
  await expect.poll(async () => (await limits()).zoomMax, { timeout: 30_000 }).toBeGreaterThan(100);
  await page.locator("#controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown): void }).set({ zoom: 60 }));
  await expect.poll(async () => (await statsOf(page)).zoomMax).toBeGreaterThan(100);
  await expect.poll(() => page.locator("#controls").evaluate((el) => (Reflect.get(el, "controller") as { state: { zoom: number } }).state.zoom), { message: "60x was reached, past the old stop at 8x" }).toBeGreaterThan(50);
});
