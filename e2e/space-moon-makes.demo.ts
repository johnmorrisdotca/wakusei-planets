// The moons of a planet come a few at a time (MODULES-1601, found by CI): a moon's shader is compiled at the first draw it is in, and Saturn's nineteen in one draw were a pause of about five seconds on a software renderer, in which the page answered
// nothing (the squeezed-moons test timed out on WebKit waiting for `body`). Chromium, in software.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { openSpace, SPACE, statsOf } from "./space-ui.ts";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

test("Saturn's moons are made a few to a draw, and all come", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-11T12:00:00Z&speed=0&scale=compressed");
  // before the move the view shows no moon of Saturn; the draws after it are read as they come, with the number of moons each had
  const seen: { draws: number; moons: number }[] = [];
  await page.locator(SPACE).evaluate((el) => {
    (el as unknown as { goTo: (id: string, o: { smooth: boolean; zoom: number }) => void }).goTo("saturn", { smooth: false, zoom: 0.1 });
  });
  await expect
    .poll(
      async () => {
        const stats = await statsOf(page);
        if (seen.length === 0 || seen[seen.length - 1]!.draws !== stats.draws) seen.push({ draws: stats.draws, moons: stats.bodies.moons });
        return stats.bodies.moons;
      },
      { timeout: 120_000, intervals: [50] },
    )
    .toBeGreaterThanOrEqual(15);
  // a draw may be missed between two reads, so the step between reads is held to a few draws' worth of moons, and the first read after the move to a draw's
  const first = seen[0]!.moons;
  expect(first, "the moons in the first draws after the move").toBeLessThanOrEqual(6);
  for (let i = 1; i < seen.length; i += 1) {
    const draws = seen[i]!.draws - seen[i - 1]!.draws;
    expect(seen[i]!.moons - seen[i - 1]!.moons, `moons made between draw ${seen[i - 1]!.draws} and ${seen[i]!.draws}`).toBeLessThanOrEqual(3 * Math.max(1, draws));
  }
});
