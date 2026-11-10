// The data door in a real browser (Chromium, drawn in software): a source of a body's map that a page hands in is drawn in place of the package's tiles, its credit is on the page in English and Japanese with its licence,
// switching it off (the call, and `data=own` in the address) brings the first picture back and frees its tiles, and at rest the door sends nothing. The source is made in the page, as the README shows.
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { ROOM } from "../src/scene/extent.ts";
import { routeTiles } from "./tiles-fixture.ts";

test.describe.configure({ mode: "serial" });
test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.addInitScript(COUNT_SCRIPT);
});

const URL = "/wakusei-planets/";
type Credit = { id: string; own: boolean; used: number };
type Stats = { tiles: { shown: number | null; held: number; failed: number; source?: { id: string }; used: number } | undefined };
const main = (page: Page): Locator => page.locator("#main");
const statsOf = (page: Page): Promise<Stats> => main(page).evaluate((el) => (el as unknown as { stats: Stats }).stats);
const creditsOf = (page: Page): Promise<Credit[]> => main(page).evaluate((el) => (el as unknown as { credits(): { source: { id: string }; own: boolean; used: number }[] }).credits().map((c) => ({ id: c.source.id, own: c.own, used: c.used })));
const setZoom = (page: Page, zoom: number): Promise<void> => main(page).evaluate((el, z) => (el as unknown as { setView(v: unknown): void }).setView({ zoom: z }), zoom);
const line = (page: Page): Locator => page.getByTestId("door-credit");

async function open(page: Page, query: string): Promise<void> {
  await page.goto(`${URL}?${query}`);
  await main(page).hover();
  await expect(main(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
}

async function zoomFor(page: Page, pixelsPerRadian: number): Promise<number> {
  const box = (await main(page).boundingBox())!;
  return (pixelsPerRadian * 2 * ROOM) / Math.min(box.width, box.height);
}

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
const green = (c: number[]): boolean => c[1]! > 150 && c[0]! < 70 && c[2]! < 70;
const yellow = (c: number[]): boolean => Math.min(c[0]!, c[1]!) > 15 && c[2]! < 0.35 * Math.min(c[0]!, c[1]!);

/** A source of Mars's map made in the page: every tile one green square, on the package's pyramid (level L is 2048 * 2^L round in 512 pixel tiles). */
async function addMine(page: Page): Promise<void> {
  await main(page).evaluate((el) => {
    const calls: string[] = [];
    const aborted: string[] = [];
    Reflect.set(window, "__mine", { calls, aborted });
    const levels = [1, 2, 3].map((level) => ({ level, width: 2048 * 2 ** level, height: 1024 * 2 ** level, columns: 4 * 2 ** level, rows: 2 * 2 ** level }));
    const source = {
      kind: "tiles",
      body: "mars",
      layer: "colour",
      info: {
        id: "mine",
        name: { en: "My maps", ja: "私の地図" },
        credit: { en: "Maps: mine, A. Person (2026)", ja: "地図：私の（A. Person、2026年）" },
        licence: { name: "CC BY-NC 4.0", url: "https://creativecommons.org/licenses/by-nc/4.0/", nonCommercial: true },
        url: "https://example.org/mine",
        retrieved: "2026-11-10",
      },
      levels: () => levels,
      need(place: { lonMin: number; lonMax: number; latMin: number; latMax: number }, detail: number) {
        const at = levels.find((one) => one.width >= detail) ?? levels[2]!;
        const turn = Math.PI * 2;
        const rad = Math.PI / 180;
        const first = Math.floor(((place.lonMin * rad) / turn + 0.5) * at.columns + 1e-9);
        const last = Math.ceil(((place.lonMax * rad) / turn + 0.5) * at.columns - 1e-9);
        const top = Math.max(0, Math.floor((0.5 - (place.latMax * rad) / Math.PI) * at.rows + 1e-9));
        const bottom = Math.min(at.rows, Math.ceil((0.5 - (place.latMin * rad) / Math.PI) * at.rows - 1e-9));
        const keys: string[] = [];
        for (let row = top; row < bottom; row += 1) for (let col = first; col < last; col += 1) keys.push(`${at.level}/${((col % at.columns) + at.columns) % at.columns}/${row}`);
        return keys;
      },
      async load(key: string, signal: AbortSignal) {
        calls.push(key);
        signal.addEventListener("abort", () => aborted.push(key));
        const canvas = new OffscreenCanvas(512, 512);
        const context = canvas.getContext("2d")!;
        context.fillStyle = "rgb(0,255,0)";
        context.fillRect(0, 0, 512, 512);
        return { width: 512, height: 512, image: await createImageBitmap(canvas) };
      },
      bytes: (tile: { width: number; height: number }) => Math.ceil(tile.width * tile.height * 4 * (4 / 3)),
    };
    (el as unknown as { addSource(s: unknown): void }).addSource(source);
  });
}
const mineCalls = (page: Page): Promise<number> => page.evaluate(() => (Reflect.get(window, "__mine") as { calls: string[] }).calls.length);

test("a page's own map of Mars is drawn in place of the package's tiles, and its credit is on the page with its licence, in English", async ({ page }) => {
  const log = await routeTiles(page);
  await open(page, "body=mars&look=realistic");
  await expect.poll(async () => (await creditsOf(page)).map((c) => c.id)).toEqual(["wakusei-pictures"]);
  await expect(line(page)).toContainText("Surface pictures");
  await expect(line(page)).not.toContainText("My maps");
  await addMine(page);
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.shown, { timeout: 60_000 }).toBe(3);
  await expect.poll(async () => green(await middle(page, main(page))), { timeout: 30_000, message: "the page's own tiles are on the body" }).toBe(true);
  expect((await statsOf(page)).tiles?.source?.id).toBe("mine");
  expect(await mineCalls(page)).toBeGreaterThanOrEqual(1);
  expect(log.tiles.filter((tile) => tile.startsWith("mars/3/")), "the package's folder is not asked for the tiles the page's source gives").toEqual([]);
  const credits = await creditsOf(page);
  expect(credits.map((c) => [c.id, c.own])).toEqual([["wakusei-pictures", true], ["mine", false]]);
  expect(credits[1]!.used).toBeGreaterThanOrEqual(1);
  await expect(line(page)).toContainText("Surface pictures");
  await expect(line(page)).toContainText("Maps: mine, A. Person (2026) (CC BY-NC 4.0; non-commercial).");
});

test("at rest the door sends nothing and draws nothing; switching the source off brings the package's tiles back and frees the page's", async ({ page }) => {
  await routeTiles(page);
  await open(page, "body=mars&look=realistic");
  await addMine(page);
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.source?.id, { timeout: 60_000 }).toBe("mine");
  await page.waitForTimeout(1500);
  const asked = await mineCalls(page);
  const before = await readCounts(page);
  await page.waitForTimeout(2500);
  const after = await readCounts(page);
  expect(await mineCalls(page), "no tile asked for at rest").toBe(asked);
  expect(after.draws - before.draws, "no draw at rest").toBe(0);
  await main(page).evaluate((el) => (el as unknown as { enableSource(id: string, on: boolean): void }).enableSource("mine", false));
  await expect.poll(async () => (await creditsOf(page)).some((c) => c.id === "mine"), { message: "its credit is gone" }).toBe(false);
  await expect(line(page)).not.toContainText("My maps");
  await expect(line(page)).not.toContainText("Maps: mine");
  await expect.poll(async () => yellow(await middle(page, main(page))), { timeout: 30_000, message: "the package's own tiles are on the body again" }).toBe(true);
  expect((await statsOf(page)).tiles?.source?.id).toBe("wakusei-tiles");
  const credits = await creditsOf(page);
  expect(credits.map((c) => [c.id, c.own])).toEqual([["wakusei-pictures", true], ["wakusei-tiles", true]]);
  await expect(line(page)).toContainText("Finer map tiles");
});

test("the credit line is in Japanese in Japanese, with the licence and 非営利のみ beside the credit", async ({ page }) => {
  await routeTiles(page);
  await open(page, "body=mars&look=realistic&lang=ja");
  await addMine(page);
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.source?.id, { timeout: 60_000 }).toBe("mine");
  await expect(line(page)).toContainText("表面の地図");
  await expect(line(page)).toContainText("地図：私の（A. Person、2026年）（CC BY-NC 4.0、非営利のみ）");
});

test("data=own in the address ignores every outside source at once: none is asked for a tile and none is credited", async ({ page }) => {
  await routeTiles(page);
  await open(page, "body=mars&look=realistic&data=own");
  await expect(main(page)).toHaveAttribute("data", "own");
  await addMine(page);
  await setZoom(page, await zoomFor(page, 3200));
  await expect.poll(async () => (await statsOf(page)).tiles?.source?.id, { timeout: 60_000 }).toBe("wakusei-tiles");
  expect(await mineCalls(page)).toBe(0);
  expect((await creditsOf(page)).map((c) => c.id)).toEqual(["wakusei-pictures", "wakusei-tiles"]);
});

test("a source that is refused throws at once, in the page, and changes nothing", async ({ page }) => {
  await routeTiles(page);
  await open(page, "body=mars&look=realistic");
  const refusals = await main(page).evaluate((el) => {
    const body = el as unknown as { addSource(s: unknown): void; sources: unknown[] };
    const good = { kind: "tiles", body: "mars", layer: "colour", info: { id: "x", name: { en: "x", ja: "x" }, credit: { en: "", ja: "x" }, licence: { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" }, url: "https://example.org", retrieved: "2026-11-10" }, need: () => [], load: async () => ({}), bytes: () => 1 };
    const errors: string[] = [];
    for (const source of [good, { ...good, info: { ...good.info, credit: { en: "x", ja: "x" }, licence: undefined } }, { ...good, info: { ...good.info, credit: { en: "x", ja: "x" } }, kind: "records", records: () => [] }]) {
      try {
        body.addSource(source);
      } catch (error) {
        errors.push(`${(error as Error).name}: ${(error as Error).message}`);
      }
    }
    return { errors, kept: body.sources.length };
  });
  expect(refusals.kept).toBe(0);
  expect(refusals.errors).toEqual([
    'TypeError: source "x": the credit is empty (en)',
    'TypeError: source "x": there is no licence',
    'TypeError: source "x": this view takes tiles sources, not records sources',
  ]);
});
