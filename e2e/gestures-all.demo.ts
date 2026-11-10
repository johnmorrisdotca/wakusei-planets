// kazoku-ui's shared gesture check on the 3D views: every gesture of the view controls (turn, roll, keys, wheel, pinch, every kind of move) changes the view as the guide says, and the picture
// moves by as many pixels as the controls report. Chromium in software drawing, one view at a time.
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

test("every gesture works on the space view", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z");
  await live(page, "wakusei-space");
  await checkGestures(page, "wakusei-space", { controls: "#controls", ready: () => page.waitForTimeout(250) });
});

test("every gesture works on the body view in its shaded look", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/?body=mars&look=realistic");
  await page.locator("#main").hover();
  await live(page, "#main");
  await checkGestures(page, "#main", { controls: "#controls", ready: () => page.waitForTimeout(250) });
});

// The same check with the finer map tiles on the body: the made-up tile set with blocks of colour (a flat picture cannot be told from a shifted one), and the window of tiles awaited before each picture.
type TileStats = { requested: number; loading: number; failed: number; shown: number | null };
const tilesAre = (page: Page, selector: string) => async (): Promise<void> => {
  await expect
    .poll(async () => page.locator(selector).evaluate((el) => (el as unknown as { stats: { tiles: TileStats | undefined } }).stats.tiles).then((t) => t !== undefined && t.shown !== null && t.loading === 0), { timeout: 60_000, message: "a window of tiles is on the body" })
    .toBe(true);
  await page.waitForTimeout(450);
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
  // 20x: past the 8x a portrait stopped at, and in reach of the Earth's finest level
  const flat = "a portrait is a flat picture: it has no turn and no roll";
  await checkGestures(page, "#view", { lacks: { turn: flat, roll: flat, "key-turn": flat }, window: [0, 1, 0, 1], zoom: 20, ready: tilesAre(page, "#view") });
  expect(log.tiles.length, "the tiles were used").toBeGreaterThan(0);
});
