// The rings' opacity follows the optical depth: Jupiter's thin dusty ring is a faint line in the shaded look while Saturn's stays bold.
import { expect, test, type Page } from "@playwright/test";
import "./load.ts";

const URL = "/wakusei-planets/";

/** How far the brightest 0.1% of the big view's pixels, outside the globe, rise above its corner. The rings are what is out there; the page's dotted background is the same for every body. */
async function outside(page: Page, id: string): Promise<number> {
  await page.goto(`${URL}?look=realistic&body=${id}&t=2026-11-02T12:00:00.000Z`);
  const big = page.locator("#main");
  await big.hover();
  await expect(big).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(2500);
  const png = (await big.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const light = (x: number, y: number): number => px[(y * bitmap.width + x) * 4]! + px[(y * bitmap.width + x) * 4 + 1]! + px[(y * bitmap.width + x) * 4 + 2]!;
    const lifts: number[] = [];
    for (let y = 0; y < bitmap.height; y += 1) {
      for (let x = 0; x < bitmap.width; x += 1) if (Math.hypot(x - bitmap.width / 2, y - bitmap.height / 2) > 0.3 * bitmap.height) lifts.push(light(x, y) - light(2, 2));
    }
    lifts.sort((a, b) => a - b);
    return lifts[Math.floor(lifts.length * 0.999)]!;
  }, png);
}

test("Jupiter's ring is a faint line in the shaded look while Saturn's ring is bold", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const none = await outside(page, "mars");
  const jupiter = (await outside(page, "jupiter")) - none;
  const saturn = (await outside(page, "saturn")) - none;
  expect(jupiter, "Jupiter's ring is there, above a body with no ring").toBeGreaterThan(8);
  expect(saturn, "Saturn's ring is bold").toBeGreaterThan(200);
  expect(jupiter, "Jupiter's ring is far fainter than Saturn's").toBeLessThan(saturn / 10);
});
