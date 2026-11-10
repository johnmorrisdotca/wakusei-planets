// The space view full screen (MODULES-848): the element fills the window in any shape and no body is cut off at Fit; in the immersive mode a plain wheel zooms and a drag anywhere turns, and kazoku-ui's own rules
// (Ctrl, Command or Alt with the wheel zooms, a plain wheel scrolls the page) stand everywhere else; the family's gesture check passes on the page. Chromium, in software.
import { checkGestures, COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, NOV2, setOn, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

async function open(page: Page, query = `t=${NOV2}&speed=0`): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/space-full.html?${query}`);
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await expect.poll(async () => (await statsOf(page)).draws).toBeGreaterThan(0);
  await settle(page, 800);
}
const zoomOf = (page: Page): Promise<number> => page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "state") as { zoom: number }).zoom);
const turnOf = (page: Page): Promise<number> => page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "state") as { yaw: number }).yaw);
const placeOf = (page: Page, id: string) => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);

test("the element fills the window in any shape, and the body looked at is whole inside it at Fit: the Earth, Jupiter, and Saturn with its rings", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  for (const [width, height] of [
    [1280, 900],
    [900, 1280],
    [390, 844],
    [1440, 360],
    [320, 320],
  ] as const) {
    await page.setViewportSize({ width, height });
    await settle(page, 400);
    const box = (await page.locator(SPACE).boundingBox())!;
    expect([box.width, box.height], `${width} by ${height}`).toEqual([width, height]);
    for (const [body, reach] of [["earth", 1], ["jupiter", 1], ["saturn", 2.27]] as const) {
      await setOn(page, "body", body);
      await callOn(page, "setView", { yaw: 0, tilt: 0, zoom: 1 });
      await expect.poll(async () => (await placeOf(page, body))?.r ?? 0, { timeout: 30_000 }).toBeGreaterThan(5);
      await settle(page, 500);
      const at = (await placeOf(page, body))!;
      // everything of it, the rings too, is inside the view; one pixel of the edge is allowed for the rounding
      const edge = at.r * reach;
      expect(at.x - edge, `${body}, ${width} by ${height}: left edge`).toBeGreaterThanOrEqual(-1);
      expect(at.x + edge, `${body}, ${width} by ${height}: right edge`).toBeLessThanOrEqual(width + 1);
      expect(at.y - edge, `${body}, ${width} by ${height}: top edge`).toBeGreaterThanOrEqual(-1);
      expect(at.y + edge, `${body}, ${width} by ${height}: bottom edge`).toBeLessThanOrEqual(height + 1);
      expect(Math.abs(at.x - width / 2) + Math.abs(at.y - height / 2), `${body} is in the middle`).toBeLessThan(2);
    }
    await setOn(page, "body", "earth");
  }
});

test("a plain wheel zooms the immersive view and never scrolls the page; Ctrl and the wheel still zoom as the family's hands say", async ({ page }) => {
  await open(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await zoomOf(page);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(before * 1.2);
  const zoomed = await zoomOf(page);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => zoomOf(page)).toBeLessThan(zoomed);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const now = await zoomOf(page);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect.poll(() => zoomOf(page)).toBeGreaterThan(now);
});

test("a drag anywhere on the full-screen view turns it, from a corner far from the body", async ({ page }) => {
  await open(page);
  const before = await turnOf(page);
  await page.mouse.move(40, 120);
  await page.mouse.down();
  await page.mouse.move(240, 120, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => turnOf(page)).not.toBe(before);
});

test("without the immersive mode a plain wheel does not zoom, as kazoku-ui's rule says (the page scrolls)", async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/space.html?t=${NOV2}`);
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await settle(page, 800);
  expect(await page.locator(SPACE).evaluate((el) => (el as unknown as { immersive: boolean }).immersive)).toBe(false);
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, Math.min(box.y + box.height / 2, 400));
  const before = await zoomOf(page);
  await page.mouse.wheel(0, -300);
  await settle(page, 600);
  expect(await zoomOf(page)).toBe(before);
});

test("the family's gesture check passes on the full-screen page", async ({ page }) => {
  test.setTimeout(480_000);
  await open(page);
  const report = await checkGestures(page, SPACE, { controls: "#controls", ready: () => page.waitForTimeout(250), lacks: { "wheel-pan": "in a full-screen view the plain wheel zooms (the immersive mode); the wheel's pan is the family's rule for a view inside a page" } });
  expect(report.filter((r) => r.result === "lacks").map((r) => r.gesture)).toEqual(["wheel-pan"]);
});
