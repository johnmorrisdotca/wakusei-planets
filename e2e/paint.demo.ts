// Paint an orbiter's ground track on the Moon: the line grows while the clock runs, holds when the clock stops, Clear empties it, and another craft starts from empty.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&orbiters=1&goto=moon&play=on&speed=86400&paint=1";

test("painting LRO grows, holds at rest, Clear empties it, and another craft starts empty", async ({ page }) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const pixels = () => space.evaluate((el) => (el as unknown as { paintPixels: number }).paintPixels);
  await expect.poll(pixels, { timeout: 30_000 }).toBeGreaterThan(20);
  await page.locator('#replay [data-act="play"]').click();
  let held = await pixels();
  await expect.poll(async () => {
    const now = await pixels();
    const same = now === held;
    held = now;
    return same;
  }, { timeout: 10_000 }).toBe(true);
  const stopped = await pixels();
  await page.waitForTimeout(700);
  expect(await pixels()).toBe(stopped);
  await page.locator("#paint-clear").click();
  await expect.poll(pixels, { timeout: 5_000 }).toBe(0);
  const cleared = await space.evaluate((el) => {
    const view = el as unknown as { paint: { id: string; length: string } | null; paintPixels: number };
    view.paint = { id: "danuri", length: "1d" };
    return view.paintPixels;
  });
  expect(cleared).toBe(0);
});
