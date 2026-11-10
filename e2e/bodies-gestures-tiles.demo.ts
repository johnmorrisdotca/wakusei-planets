// kazoku-ui's shared gesture check on the 3D views with the finer map tiles on the body: the space view at its ceiling and a portrait zoomed far past the 8x it used to stop at. Its own file, named to sort first, because
// the demo is dealt out to CI jobs by file and these two are slow (software drawing, a window of tiles awaited before each picture): the job that had them after the other gesture checks ran out of its 25 minutes.
import { checkGestures, COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { routeTiles } from "./tiles-fixture.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const live = async (page: Page, selector: string): Promise<void> => {
  await expect(page.locator(selector)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(800);
};

// The made-up tile set has blocks of colour (a flat picture cannot be told from a shifted one), and the window of tiles is awaited before each picture.
type TileStats = { requested: number; loading: number; failed: number; shown: number | null };
const tilesAre = (page: Page, selector: string) => async (): Promise<void> => {
  // the view settles for 140 ms before a window is fetched: wait that out, then for what is being fetched, then for the picture it makes
  await page.waitForTimeout(300);
  await expect
    .poll(async () => page.locator(selector).evaluate((el) => (el as unknown as { stats: { tiles: TileStats | undefined } }).stats.tiles?.loading ?? 0), { timeout: 60_000, message: "no tile is on its way" })
    .toBe(0);
  await page.waitForTimeout(150);
};

test("every gesture works on the space view at its ceiling, with its map tiles on the Earth", async ({ page }) => {
  test.setTimeout(480_000);
  await page.addInitScript(COUNT_SCRIPT);
  const log = await routeTiles(page, () => false, { pattern: true });
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z");
  await live(page, "wakusei-space");
  await checkGestures(page, "wakusei-space", { controls: "#controls", ready: tilesAre(page, "wakusei-space") });
  expect(log.tiles.length, "the tiles were used").toBeGreaterThan(0);
  expect(log.tiles.every((tile) => tile.startsWith("earth/")), "and only the Earth's").toBe(true);
});

test("every gesture a flat portrait has works on the embed page's portrait zoomed far past 8x, with its map tiles", async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(COUNT_SCRIPT);
  const log = await routeTiles(page, () => false, { pattern: true });
  await page.goto(`/wakusei-planets/embed.html?scene=${encodeURIComponent("look:painted~earth_0_0_0.6_0")}`);
  await live(page, "#view");
  await expect(page.locator("kazoku-view-controls")).toBeAttached();
  // 8x brings the tile set in, and with it the range: the Earth goes on to about 25x. The gestures are then made at 12x, past the 8x a portrait stopped at.
  await page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ zoom: 8 }, true, "set"));
  await expect.poll(() => page.locator("#view").evaluate((el) => (el as unknown as { stats: { zoomMax: number } }).stats.zoomMax), { timeout: 60_000 }).toBeGreaterThan(12);
  await page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ zoom: 1 }, true, "set"));
  const flat = "a portrait is a flat picture: it has no turn and no roll";
  await checkGestures(page, "#view", { lacks: { turn: flat, roll: flat, "key-turn": flat }, window: [0, 1, 0, 1], zoom: 12, ready: tilesAre(page, "#view") });
  expect(log.tiles.length, "the tiles were used").toBeGreaterThan(0);
});
