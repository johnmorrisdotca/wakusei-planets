// The flat map asks little of the machine: it makes no WebGL context and no graphics object, its canvases stay inside the pixel budget, nothing is drawn at rest, out of sight or in a hidden tab, a running clock draws at the pace
// the orbiters need and no faster (at most once a second at 1x and once a frame at the fastest), and taking the element out of the page stops its timer and its frames. Played in headless Chromium, one page at a time.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";

type Flat = HTMLElement & { stats: { draws: number; mapDraws: number; running: boolean; canvases: { width: number; height: number }[]; averageDrawMs: number; maxDrawMs: number } };

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
});

const flat = (page: Page) => page.locator("wakusei-flat#flat");
const stats = (page: Page) => flat(page).evaluate((el) => (el as Flat).stats);
const open = async (page: Page, query = ""): Promise<void> => {
  await page.goto(`/wakusei-planets/flat.html${query}`);
  await expect(flat(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
};
const set = (page: Page, attributes: Record<string, string | null>) =>
  flat(page).evaluate((el, list) => {
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

test("it makes no WebGL context and no graphics object, and its canvases stay inside 6 million pixels and 4096 a side, on the Moon and on Mars", async ({ page }) => {
  await open(page);
  for (const body of ["mars", "moon", "mars"]) {
    await set(page, { body });
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
  await page.goto("/wakusei-planets/flat.html");
  await expect(flat(page)).toHaveAttribute("data-state", "ready");
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
  // running, then out of sight
  await set(page, { paused: null });
  await expect.poll(() => frames(page, 500)).toBeGreaterThan(2);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.querySelector("main")!.prepend(spacer);
    window.scrollTo(0, 3000);
  });
  await page.waitForTimeout(400);
  expect(await frames(page, 2000)).toBe(0);
  // a hidden tab: the page says so and the draws stop
  await flat(page).scrollIntoViewIfNeeded();
  await expect.poll(() => frames(page, 500)).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(400);
  expect(await frames(page, 2000)).toBe(0);
});

test("a running clock draws at the pace of the orbiters, not faster: about once a second in real time, and under a frame a screen refresh at the fastest", async ({ page }) => {
  await open(page);
  await set(page, { speed: "1", time: "2026-11-17T12:00:00Z" });
  await page.waitForTimeout(300);
  const slow = await frames(page, 4000);
  expect(slow).toBeGreaterThanOrEqual(2);
  expect(slow).toBeLessThanOrEqual(8);
  await set(page, { speed: "86400" });
  await page.waitForTimeout(300);
  const fast = await frames(page, 2000);
  expect(fast).toBeGreaterThan(20);
  expect(fast).toBeLessThanOrEqual(2 * 61);
  // a draw is cheap: the average stays well under a frame, even with the footprints and the tracks on
  await set(page, { footprint: "", track: "", speed: "600" });
  await page.waitForTimeout(1500);
  const s = await stats(page);
  expect(s.averageDrawMs).toBeLessThan(12);
});

test("taking the element out of the page stops its timer and its frames, and putting it back draws again", async ({ page }) => {
  await open(page);
  await set(page, { speed: "600" });
  await expect.poll(() => frames(page, 300)).toBeGreaterThan(2);
  const count = await flat(page).evaluate((el) => {
    const parent = el.parentElement!;
    const next = el.nextSibling;
    Reflect.set(window, "__flat", { parent, next, el });
    const seen = (el as Flat).stats.draws;
    el.remove();
    return seen;
  });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => (Reflect.get(window, "__flat").el as Flat).stats.draws);
  // at most the one frame that was already asked for
  expect(after - count).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    const held = Reflect.get(window, "__flat") as { parent: HTMLElement; next: Node | null; el: HTMLElement };
    held.parent.insertBefore(held.el, held.next);
  });
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(after);
});
