// The flat solar system asks little of the machine: it makes no WebGL context and no graphics object, its canvases stay inside the pixel budget, nothing is drawn at rest, out of sight or in a hidden tab, a running clock draws at the pace
// Mercury needs and no faster, and taking the element out of the page stops its timer and its frames. Played in headless Chromium, one page at a time.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";
import { atMostOnePerRefresh, drawsAgainstRefresh } from "./refresh-bound.ts";
import { underLoad } from "./under-load.ts";

type System = HTMLElement & { stats: { draws: number; mapDraws: number; running: boolean; canvases: { width: number; height: number }[]; averageDrawMs: number; maxDrawMs: number } };

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page, browserName }) => {
  await underLoad(page, browserName);
  await page.addInitScript(COUNT_SCRIPT);
});

const system = (page: Page) => page.locator("wakusei-flat-system#system");
const stats = (page: Page) => system(page).evaluate((el) => (el as System).stats);
const open = async (page: Page): Promise<void> => {
  await page.goto("/wakusei-planets/system.html");
  await expect(system(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
};
const set = (page: Page, attributes: Record<string, string | null>) =>
  system(page).evaluate((el, list) => {
    for (const [name, value] of Object.entries(list)) {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }
  }, attributes);
const frames = async (page: Page, ms: number): Promise<number> => {
  const before = (await stats(page)).draws;
  await page.waitForTimeout(ms);
  return (await stats(page)).draws - before;
};

test("it makes no WebGL context and no graphics object, and its canvases stay inside 6 million pixels and 4096 a side, on either scale", async ({ page }) => {
  await open(page);
  for (const spacing of ["true", "squeezed", "true"]) {
    await set(page, { spacing });
    await expect.poll(async () => (await stats(page)).mapDraws).toBeGreaterThan(0);
  }
  const counts = await readCounts(page);
  expect(counts.contexts).toBe(0);
  expect(gpuObjects(counts)).toBe(0);
  for (const c of (await stats(page)).canvases) {
    expect(c.width * c.height).toBeLessThanOrEqual(6_000_000);
    expect(Math.max(c.width, c.height)).toBeLessThanOrEqual(4096);
  }
});

test("a screen of any size keeps the canvases inside the budget", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 });
  await page.goto("/wakusei-planets/system.html");
  await expect(system(page)).toHaveAttribute("data-state", "ready");
  await set(page, { style: "max-width:none" });
  for (const c of (await stats(page)).canvases) {
    expect(c.width * c.height).toBeLessThanOrEqual(6_000_000);
    expect(Math.max(c.width, c.height)).toBeLessThanOrEqual(4096);
  }
});

test("at rest nothing is drawn: a held clock, a paused one, and the map out of sight", async ({ page }) => {
  await open(page);
  await set(page, { speed: "0" });
  await page.waitForTimeout(300);
  expect(await frames(page, 2000)).toBe(0);
  await set(page, { speed: "3600", paused: "" });
  await page.waitForTimeout(300);
  expect(await frames(page, 2000)).toBe(0);
  await set(page, { paused: null, speed: "864000" });
  await expect.poll(() => frames(page, 500)).toBeGreaterThan(2);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.querySelector("main")!.prepend(spacer);
    window.scrollTo(0, 3000);
  });
  await page.waitForTimeout(400);
  expect(await frames(page, 2000)).toBe(0);
  await system(page).scrollIntoViewIfNeeded();
  await expect.poll(() => frames(page, 500)).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(400);
  expect(await frames(page, 2000)).toBe(0);
});

test("a running clock draws at the pace of Mercury, not faster: a few draws in real time, and under a frame a screen refresh at the fastest", async ({ page }) => {
  await open(page);
  await set(page, { speed: "1", time: "2026-11-17T12:00:00Z" });
  await page.waitForTimeout(300);
  // real time: Mercury moves a pixel in an hour, so it is a draw every 30 seconds at most
  expect(await frames(page, 4000)).toBeLessThanOrEqual(3);
  await set(page, { speed: "8640000" });
  await page.waitForTimeout(300);
  // the window is timed in the page and the screen's refreshes are counted in it: at most one draw a refresh, and one for the frame that straddles the start (a fixed 2 x 61 was over by one on a runner)
  const { draws: fast, refreshes } = await drawsAgainstRefresh(system(page), 2000);
  expect(fast).toBeGreaterThan(20);
  expect(atMostOnePerRefresh(fast, refreshes), `${fast} draws in a window of ${refreshes} refreshes`).toBe(true);
  // a draw is cheap: the average stays well under a frame, with every layer, the paths and the streaks on
  await set(page, { track: "" });
  await page.waitForTimeout(1500);
  const s = await stats(page);
  expect(s.averageDrawMs).toBeLessThan(12);
});

test("taking the element out of the page stops its timer and its frames, and putting it back draws again", async ({ page }) => {
  await open(page);
  await set(page, { speed: "864000" });
  await expect.poll(() => frames(page, 300)).toBeGreaterThan(2);
  const count = await system(page).evaluate((el) => {
    const parent = el.parentElement!;
    const next = el.nextSibling;
    Reflect.set(window, "__system", { parent, next, el });
    const seen = (el as System).stats.draws;
    el.remove();
    return seen;
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => (Reflect.get(window, "__system").el as System).stats.draws);
  expect(after - count).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    const held = Reflect.get(window, "__system") as { parent: HTMLElement; next: Node | null; el: HTMLElement };
    held.parent.insertBefore(held.el, held.next);
  });
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(after);
});
