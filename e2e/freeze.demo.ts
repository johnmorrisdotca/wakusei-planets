// The demo must never ask a lot of the machine. Played in headless Chromium (drawing WebGL in software, never on the graphics card), these fail on a draw loop that runs when nothing
// moves or more than once a frame, on WebGL contexts or graphics memory (buffers, vertex arrays, textures, programs) that grow with each change, on a canvas past its pixel budget on a
// 5K screen, on a frame drawn out of sight, and on a moving picture drawn faster than thirty times a second.
import { COUNT_SCRIPT, canvasSize, gpuObjects, readCounts, withinPixelBudget } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";

const URL = "/wakusei-planets/";
const main = (page: Page) => page.locator("#main");
const live = (page: Page) => expect(main(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
const settle = (page: Page, ms: number) => page.waitForTimeout(ms);
const pick = (page: Page, id: string) => page.locator(`.tile[data-body="${id}"]`).click();

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
});

test("a page of stills asks the browser for nothing, with one WebGL context at most", async ({ page }) => {
  await page.goto(`${URL}?body=jupiter`);
  // a still is made only for a picture that is in sight
  await page.locator("#tiles").scrollIntoViewIfNeeded();
  await expect(page.locator("#tiles .tile wakusei-body[data-state=still]")).toHaveCount(11, { timeout: 120_000 });
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.contexts).toBeLessThanOrEqual(1);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
});

test("a live body that is not moving draws nothing, and its frames are never asked for twice", async ({ page }) => {
  await page.goto(`${URL}?body=saturn`);
  await main(page).hover();
  await live(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
});

test("a turning body is drawn at most thirty times a second, one frame at a time", async ({ page }) => {
  await page.goto(`${URL}?body=jupiter&spin=1`);
  await main(page).hover();
  await live(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  const draws = after.draws - before.draws;
  expect(draws).toBeGreaterThan(0);
  // a draw may be several GL calls (the planet, its rings, a glow): count frames, not calls
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(4 * 31);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
});

test("changes give back what they took: contexts, buffers, vertex arrays, textures and programs do not grow", async ({ page }) => {
  await page.goto(`${URL}?body=jupiter`);
  await main(page).hover();
  await live(page);
  const round = async () => {
    for (const id of ["saturn", "mars", "earth", "moon", "earth", "neptune", "sun", "mercury", "jupiter"]) {
      await pick(page, id);
      await main(page).hover();
      await live(page);
      await settle(page, 400);
    }
    await page.locator("#moons").click().catch(() => undefined);
    await settle(page, 600);
  };
  await round();
  await settle(page, 2500);
  const first = await readCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await readCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
});

test("a painted body starts with a small picture, gets a sharper one when zoomed in, and gives its pictures back", async ({ page }) => {
  await page.goto(`${URL}?body=mars&look=painted`);
  await main(page).hover();
  await live(page);
  const width = () => main(page).evaluate((el) => (el as unknown as { stats: { textureWidth: number } }).stats.textureWidth);
  await expect.poll(width, { timeout: 60_000 }).toBeGreaterThanOrEqual(512);
  expect(await width()).toBeLessThanOrEqual(1024);
  await main(page).evaluate((el) => (el as unknown as { setView(v: { zoom: number }): void }).setView({ zoom: 5 }));
  await expect.poll(width, { timeout: 60_000 }).toBe(2048);
  await settle(page, 1500);
  const zoomed = await readCounts(page);
  for (const id of ["jupiter", "pluto", "mercury", "sun", "mars"]) {
    await pick(page, id);
    await main(page).hover();
    await live(page);
    await expect.poll(width, { timeout: 60_000 }).toBeGreaterThanOrEqual(512);
    await settle(page, 500);
  }
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(gpuObjects(after)).toBeLessThanOrEqual(gpuObjects(zoomed) + 4);
});

test("the canvas stays within 6 million pixels and 4096 a side on a 5K screen at a pixel ratio of 2", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 5120, height: 2880 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${URL}?body=saturn`);
  await main(page).hover();
  await live(page);
  await settle(page, 800);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  await context.close();
});

test("a body out of sight draws nothing, even while it is told to keep turning", async ({ page }) => {
  await page.goto(`${URL}?body=jupiter&spin=1`);
  await main(page).hover();
  await live(page);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.append(spacer);
    document.querySelector(".tiles")?.scrollIntoView();
    window.scrollTo(0, 5000);
  });
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(1);
});
