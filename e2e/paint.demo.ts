// Paint an orbiter's ground track on the Moon: the line grows while the clock runs, holds when the clock stops, Clear empties it, and another craft starts from empty.
import "./load.ts";
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
  const draws = () => space.evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws);
  // The bar is far below the view, so a click on it would scroll the view out of sight, and a view out of sight is not drawn (by design): whether the trail grew or held would then be down to whether a draw got in before the scroll was seen. The click is sent to the button where the page stands.
  const play = page.locator('#replay [data-act="play"]');
  const start = await pixels();
  await play.dispatchEvent("click");
  // the clock runs: each draw lays down the ground crossed since the last, so the picture changes
  await expect.poll(pixels, { timeout: 10_000 }).not.toBe(start);
  // the clock holds, with the moment it stopped on; the first draw after that brings the trail to it, and nothing after that changes it. The count is taken in the same call as the click: a draw between the two would be taken for the one that follows it
  const stoppedAt = await space.evaluate((el) => {
    const view = el as unknown as { speed: number; stats: { draws: number } };
    document.querySelector<HTMLElement>("#replay")!.shadowRoot!.querySelector<HTMLElement>('[data-act="play"]')!.click();
    return { speed: view.speed, draws: view.stats.draws };
  });
  expect(stoppedAt.speed).toBe(0);
  await expect.poll(draws, { timeout: 10_000 }).toBeGreaterThan(stoppedAt.draws);
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
