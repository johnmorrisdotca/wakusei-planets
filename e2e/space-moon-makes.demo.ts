// The moons of a planet come a few at a time (MODULES-1601, found by CI): a moon's shader is compiled at the first draw it is in, and Saturn's nineteen in one draw were a pause of about five seconds on a software renderer, in which the page answered
// nothing (the squeezed-moons test timed out on WebKit waiting for `body`). Chromium, in software.
import "./load.ts";
import { expect, test } from "@playwright/test";
import { openSpace, SPACE } from "./space-ui.ts";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

test("Saturn's moons are made a few to a draw, and all come", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-11T12:00:00Z&speed=0&scale=compressed");
  // the moons are read after every draw, in the page: each animation frame's callbacks are wrapped, and when the draw count has moved the draw's own count and moons are kept. A timed poll from outside sees several draws at
  // once on a slow runner (15 moons in one read), and what it reports is the runner's speed, not the number made in a draw. `before` is the reading before the move.
  const before = await page.locator(SPACE).evaluate((el) => {
    const read = () => {
      const stats = Reflect.get(el, "stats") as { draws: number; bodies: { moons: number } };
      return { draws: stats.draws, moons: stats.bodies.moons };
    };
    const log = [read()];
    Reflect.set(window, "__moonDraws", log);
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      request((time) => {
        callback(time);
        const now = read();
        if (now.draws !== log[log.length - 1]!.draws) log.push(now);
      });
    (el as unknown as { goTo: (id: string, o: { smooth: boolean; zoom: number }) => void }).goTo("saturn", { smooth: false, zoom: 0.1 });
    return log[0]!;
  });
  const drawLog = () => page.evaluate(() => Reflect.get(window, "__moonDraws") as { draws: number; moons: number }[]);
  await expect.poll(async () => (await drawLog()).at(-1)!.moons, { timeout: 120_000, intervals: [50] }).toBeGreaterThanOrEqual(15);
  const log = await drawLog();
  expect(log[0], "the reading before the move").toEqual(before);
  for (let i = 1; i < log.length; i += 1) {
    expect(log[i]!.draws - log[i - 1]!.draws, `draws between two readings (${log[i - 1]!.draws} to ${log[i]!.draws}): every draw is read`).toBe(1);
    expect(log[i]!.moons - log[i - 1]!.moons, `moons made in draw ${log[i]!.draws}`).toBeLessThanOrEqual(6);
  }
});
