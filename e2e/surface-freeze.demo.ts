// The standing view asks little of the machine: nothing is drawn at rest, it keeps to one WebGL context and a canvas within the pixel budget, a round of changes (looks, steps that make new rocks, a new time) leaves no
// more graphics objects alive than the round before, and taking the element out of the page gives back what it made. Played in headless Chromium, drawing WebGL in software, over the made-up site of
// surface-fixture.ts, small and at the quality of motion (the near march shortened), since software drawing takes seconds a picture. One test at a time, one page.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }) => {
  // a slow machine: a quarter of the speed, as the test-rules page asks
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(COUNT_SCRIPT);
});

/** The counters once the graphics objects alive and the contexts have stopped changing: the same on four reads a quarter of a second apart. */
const settledCounts = async (page: Page) => {
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const counts = await readCounts(page);
        const now = `${gpuObjects(counts)}:${counts.contexts}`;
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [250], timeout: 90_000, message: "the graphics objects alive never stopped changing" },
    )
    .toBeGreaterThanOrEqual(3);
  return readCounts(page);
};

const open = async (page: Page, extra = ""): Promise<void> => {
  await routeSurface(page);
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate((extra) => {
    document.querySelector("#surface")?.remove();
    // the page's orbit view is another view of the same shared renderer and draws when its own pictures arrive: it is not what this test measures
    document.querySelector("#orbit")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("site", "apollo-17");
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    el.setAttribute("quality", "fast");
    el.setAttribute("shadows", "off");
    el.style.cssText = "width: 200px";
    for (const pair of extra.split(" ")) if (pair !== "") el.setAttribute(pair.split("=")[0]!, pair.split("=")[1] ?? "");
    document.querySelector("main")!.prepend(el);
  }, extra);
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  // at rest means: every tile is in and the draws that came of them (and of the first look) have been made: the draw count is the same on four reads
  await expect(page.locator("#test-surface")).toHaveAttribute("data-loading", "done", { timeout: 120_000 });
  let held = -1;
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await page.locator("#test-surface").evaluate((el) => (el as unknown as { stats: { draws: number } }).stats.draws);
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [500], timeout: 180_000, message: "the view never stopped drawing" },
    )
    .toBeGreaterThanOrEqual(4);
};
const call = <T>(page: Page, fn: (el: HTMLElement & { look: { azimuth: number; pitch: number; fov: number }; walk(a: number, b?: number): void; time: number; stats: { renderer: { draws: number } } }) => T): Promise<T> =>
  page.locator("#test-surface").evaluate(fn as never) as Promise<T>;

test("nothing is drawn at rest; one context, a canvas in budget; a round of changes leaves no more alive than the round before; removal gives it all back", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const first = await settledCounts(page);
  expect(first.contexts, "one context").toBe(1);
  // nothing happens for a while: a wait to say that nothing happens
  await page.waitForTimeout(2500);
  const before = await readCounts(page);
  await page.waitForTimeout(2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests, "no frame asked for at rest").toBe(0);
  expect(await page.locator("#test-surface").evaluate((el) => el.shadowRoot!.getAnimations().length), "no animation runs").toBe(0);
  const canvas = await call(page, (el) => (el.stats.renderer as unknown as { canvas: { width: number; height: number; pixels: number } }).canvas);
  expect(canvas.pixels).toBeLessThanOrEqual(6_000_000);
  expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(4096);

  // a round: turn, walk far enough for new rocks, change the moment; the objects alive settle to no more than the round before
  const round = async (): Promise<void> => {
    for (const step of [20, -35, 50]) {
      const draws = await call(page, (el) => el.stats.renderer.draws);
      await call(page, (el) => void (el.look = { ...el.look, azimuth: el.look.azimuth + 20 }));
      await expect.poll(() => call(page, (el) => el.stats.renderer.draws), { timeout: 90_000 }).toBeGreaterThan(draws);
      void step;
    }
    const draws = await call(page, (el) => el.stats.renderer.draws);
    await call(page, (el) => el.walk(30, 0)); // new rocks round the new place
    await expect.poll(() => call(page, (el) => el.stats.renderer.draws), { timeout: 90_000 }).toBeGreaterThan(draws);
    await call(page, (el) => void (el.time = el.time + 6 * 3_600_000));
    await settledCounts(page);
  };
  let before2 = Infinity;
  let seen = await settledCounts(page);
  for (let i = 0; i < 6; i += 1) {
    await round();
    seen = await settledCounts(page);
    if (gpuObjects(seen) <= before2) break;
    before2 = gpuObjects(seen);
    expect(i, "the graphics objects alive were still growing after six rounds").toBeLessThan(5);
  }
  await page.locator("#test-surface").evaluate((el) => el.remove());
  const gone = await settledCounts(page);
  expect(gone.created.Buffer - gone.deleted.Buffer, "buffers left").toBeLessThanOrEqual(0);
  expect(gone.created.VertexArray - gone.deleted.VertexArray, "vertex arrays left").toBeLessThanOrEqual(0);
  expect(gone.created.Program - gone.deleted.Program, "programs left").toBeLessThanOrEqual(0);
});

test("driving the rover: rounds of driving, turning and settling leave no more graphics objects alive than the round before, nothing is drawn once it is at rest, and removal gives it all back", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "drive=on");
  await settledCounts(page);
  const drive = (seconds: number, throttle: number, steer: number) =>
    page.locator("#test-surface").evaluate((el, a) => void (el as unknown as { driveFor(s: number, i: { throttle: number; steer: number }): boolean }).driveFor(a[0]!, { throttle: a[1]!, steer: a[2]! }), [seconds, throttle, steer]);
  // a round: ahead, round to the right, back, then let it settle (driven by set times: the same on a slow machine)
  const round = async (): Promise<void> => {
    for (const [seconds, throttle, steer] of [[0.6, 1, 0], [0.6, 1, 1], [0.6, -1, -1]] as const) {
      const draws = await call(page, (el) => el.stats.renderer.draws);
      await drive(seconds, throttle, steer);
      await expect.poll(() => call(page, (el) => el.stats.renderer.draws), { timeout: 90_000 }).toBeGreaterThan(draws);
    }
    await drive(3, 0, 0);
    await settledCounts(page);
  };
  let before = Infinity;
  for (let i = 0; i < 6; i += 1) {
    await round();
    const seen = await settledCounts(page);
    if (gpuObjects(seen) <= before) break;
    before = gpuObjects(seen);
    expect(i, "the graphics objects alive were still growing after six rounds").toBeLessThan(5);
  }
  // at rest nothing is drawn (that nothing happens: a wait to say so)
  const a = await readCounts(page);
  await page.waitForTimeout(2500);
  const b = await readCounts(page);
  expect(b.draws - a.draws, "nothing drawn at rest").toBe(0);
  await page.locator("#test-surface").evaluate((el) => el.remove());
  const gone = await settledCounts(page);
  expect(gone.created.Buffer - gone.deleted.Buffer, "buffers left").toBeLessThanOrEqual(0);
  expect(gone.created.VertexArray - gone.deleted.VertexArray, "vertex arrays left").toBeLessThanOrEqual(0);
  expect(gone.created.Program - gone.deleted.Program, "programs left").toBeLessThanOrEqual(0);
});

test("watching the landing: seeking through the descent and back leaves no more graphics objects alive than the round before, nothing is drawn once it has stopped, and removal gives it all back", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  type Landing = HTMLElement & { landingTime: number; pauseLanding(): void; stats: { renderer: { draws: number } } };
  await page.locator("#test-surface").evaluate((el) => {
    el.setAttribute("watch", "landing");
    (el as Landing).pauseLanding();
  });
  const seek = (t: number) => page.locator("#test-surface").evaluate((el, t) => void ((el as Landing).landingTime = t), t);
  const round = async (): Promise<void> => {
    for (const t of [562, 658, 714.5, 725, 300]) {
      const draws = await page.locator("#test-surface").evaluate((el) => (el as Landing).stats.renderer.draws);
      await seek(t);
      await expect.poll(() => page.locator("#test-surface").evaluate((el) => (el as Landing).stats.renderer.draws), { timeout: 90_000 }).toBeGreaterThan(draws);
    }
    await page.locator("#test-surface").evaluate((el) => el.setAttribute("watch-camera", "ground"));
    await seek(725);
    await page.locator("#test-surface").evaluate((el) => el.setAttribute("watch-camera", "lander"));
    await settledCounts(page);
  };
  let before = Infinity;
  for (let i = 0; i < 6; i += 1) {
    await round();
    const seen = await settledCounts(page);
    if (gpuObjects(seen) <= before) break;
    before = gpuObjects(seen);
    expect(i, "the graphics objects alive were still growing after six rounds").toBeLessThan(5);
  }
  // stopped at the touchdown: nothing is drawn (that nothing happens: a wait to say so)
  await seek(725);
  await settledCounts(page);
  let held = -1;
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await page.locator("#test-surface").evaluate((el) => (el as Landing).stats.renderer.draws);
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [500], timeout: 120_000 },
    )
    .toBeGreaterThanOrEqual(4);
  const a = await readCounts(page);
  await page.waitForTimeout(2500);
  const b = await readCounts(page);
  expect(b.draws - a.draws, "nothing drawn once the descent has stopped").toBe(0);
  await page.locator("#test-surface").evaluate((el) => el.remove());
  const gone = await settledCounts(page);
  expect(gone.created.Buffer - gone.deleted.Buffer, "buffers left").toBeLessThanOrEqual(0);
  expect(gone.created.VertexArray - gone.deleted.VertexArray, "vertex arrays left").toBeLessThanOrEqual(0);
  expect(gone.created.Program - gone.deleted.Program, "programs left").toBeLessThanOrEqual(0);
});
