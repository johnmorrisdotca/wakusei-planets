// The size line-up must never ask a lot of the machine. Played in headless Chromium (drawing WebGL in software, never on the graphics card), these fail on a draw loop that runs when nothing moves or more than once a frame, on
// WebGL contexts or graphics memory (buffers, vertex arrays, textures, programs) that grow with each change, on a canvas past its pixel budget on a 5K screen, on a frame drawn out of sight, and on a frame asked for twice.
// There is no cap on the frame rate in this package, on purpose: the shared renderer owns it (kazoku-ui 0.27 draws at most 30 jobs a second), and these count the jobs the renderer drew, so they hold wherever the cap lives.
import { COUNT_SCRIPT, canvasSize, gpuObjects, readCounts, withinPixelBudget } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";

const URL = "/wakusei-planets/lineup.html";
const element = (page: Page) => page.locator("wakusei-lineup#lineup");
const live = (page: Page) => expect(element(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
const settle = (page: Page, ms: number) => page.waitForTimeout(ms);
type Lineup = HTMLElement & { zoomTo(target: string | number, options?: { smooth?: boolean }): Promise<void>; bodies: { id: string }[]; stats: { drawn: string[] } };

/** Jobs the shared renderer has drawn so far, as its own scheduler counts them (it asks for an animation frame every refresh and draws at most 30 a second, so `rafRequests` is not the number of frames drawn). */
const jobsDrawn = (page: Page): Promise<number> => element(page).evaluate((el) => (el as unknown as { stats: { renderer?: { frames?: { draws?: number } } } }).stats.renderer?.frames?.draws ?? 0);

/** The counters once the graphics objects alive have stopped changing: the same number on four reads a quarter of a second apart. */
const settledCounts = async (page: Page) => {
  let held = -1;
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = gpuObjects(await readCounts(page));
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [250], timeout: 60_000, message: "the graphics objects alive never stopped changing" },
    )
    .toBeGreaterThanOrEqual(3);
  return readCounts(page);
};
/** The counters after rounds of changes, once a round leaves no more objects alive than the one before: what the page keeps is all made, however slowly the machine gets there. Leaking never settles, and fails here. */
const afterRounds = async (page: Page, round: () => Promise<void>) => {
  let before = Infinity;
  for (let i = 0; i < 8; i += 1) {
    await round();
    const counts = await settledCounts(page);
    if (gpuObjects(counts) <= before) return counts;
    before = gpuObjects(counts);
  }
  throw new Error("the graphics objects alive were still growing after eight rounds");
};

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
});

test("a live line-up that is not turning draws nothing, and its frames are never asked for twice", async ({ page }) => {
  await page.goto(`${URL}?turn=off&stars=largest`);
  await live(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
});

test("a turning line-up is drawn at most thirty times a second, one frame at a time", async ({ page }) => {
  await page.goto(URL);
  await live(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  const jobsBefore = await jobsDrawn(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBeGreaterThan(0);
  // a draw may be several GL calls (a star, its glow): count the jobs the renderer drew, not calls
  expect((await jobsDrawn(page)) - jobsBefore).toBeLessThanOrEqual(4 * 31);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
  expect(after.contexts).toBe(1);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length) + (await element(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length))).toBeLessThanOrEqual(1);
});

test("a line-up out of sight draws nothing, even while it is told to keep turning, and a hidden tab draws nothing", async ({ page }) => {
  await page.goto(URL);
  await live(page);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.append(spacer);
    document.querySelector("#embed")?.scrollIntoView();
    window.scrollTo(0, 5000);
  });
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(1);
  // back in sight, it turns again
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 1500);
  const seen = await readCounts(page);
  await settle(page, 1500);
  expect((await readCounts(page)).draws - seen.draws).toBeGreaterThan(0);
});

test("zooming from the smallest body to the largest and back, changing the stars, the planets and the layout, and turning stars by hand give back what they took: contexts, buffers, vertex arrays, textures and programs do not grow", async ({ page }) => {
  await page.goto(`${URL}?turn=off`);
  await live(page);
  const ids = () => element(page).evaluate((el) => (el as Lineup).bodies.map((body) => body.id));
  const round = async () => {
    for (const id of await ids()) {
      await element(page).evaluate((el, target) => (el as Lineup).zoomTo(target, { smooth: false }), id);
      await settle(page, 150);
    }
    await element(page).evaluate((el) => (el as Lineup).zoomTo(0, { smooth: false }));
    for (const selector of ['#stars [data-stars="bright"]', '#planets [data-planets="1"]', '#layouts [data-layout="stack"]', '#stars [data-stars="largest"]', '#layouts [data-layout="row"]', '#planets [data-planets="0"]', '#stars [data-stars="all"]']) {
      await page.locator(selector).click();
      await live(page);
      await settle(page, 300);
    }
    // a hand on the Sun
    await element(page).evaluate((el) => (el as Lineup).zoomTo("sun", { smooth: false }));
    await settle(page, 300);
    const box = (await element(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 6; i += 1) await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2 + i * 4);
    await page.mouse.up();
    await settle(page, 300);
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await element(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
});

test("saving the picture and printing the poster again and again give back what they took", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => undefined;
  });
  await page.goto(`${URL}?turn=off`);
  await live(page);
  const round = async () => {
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.locator('#saves [data-save="png"]').click();
    await download;
    await page.locator("#print").click();
    await expect(page.locator(".kazoku-print-root")).toBeAttached({ timeout: 60_000 });
    await settle(page, 300);
  };
  const last = await afterRounds(page, round);
  expect(last.contexts).toBe(1);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
});

test("the canvas stays within 6 million pixels and 4096 a side on a 5K screen at a pixel ratio of 2", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 5120, height: 2880 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${URL}?turn=off`);
  await live(page);
  await settle(page, 800);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  await context.close();
});

test("a line-up that cannot draw in 3D still shows flat discs and says so", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    // a browser with no WebGL
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest) as never;
    } as typeof original;
  });
  await page.goto(`${URL}?turn=off`);
  await expect(element(page)).toHaveAttribute("data-state", "unavailable", { timeout: 60_000 });
  expect(await element(page).evaluate((el) => el.shadowRoot!.querySelectorAll("#flat circle").length)).toBeGreaterThan(0);
  await context.close();
});
