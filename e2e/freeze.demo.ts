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
  await expect(page.locator("#tiles .tile wakusei-body[data-state=still]")).toHaveCount(10, { timeout: 120_000 });
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
  // the first rounds make what the page keeps (the stills of the rows, the programs of each body); on a slow machine they finish during the second, so the count is taken after two
  await round();
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

// --- the portrait builder: twelve bodies in ONE scene, one WebGL context, nothing drawn at rest ------------------------------------------------------------------------------------------------
const PORTRAIT = "/wakusei-planets/portrait.html";
const TWELVE = ["sun_0_0_0.3_0", "mercury_0_0_0.3_0", "venus_0_0_0.3_0", "earth_0_0_0.3_0", "moon_0_0_0.3_0", "mars_0_0_0.3_0", "jupiter_0_0_0.3_0", "io_0_0_0.3_0", "saturn_0_0_0.3_0", "uranus_0_0_0.3_0", "neptune_0_0_0.3_0", "pluto_0_0_0.3_0"];
const portraitScene = (extra = "", turning = "0"): string => `?scene=${encodeURIComponent(`look:painted${extra}~${TWELVE.map((s, i) => (i === 6 && turning !== "0" ? `${s}___${turning}` : s)).join("~")}`)}`;
const view = (page: Page) => page.locator("#view");
const liveView = (page: Page) => expect(view(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });

test("twelve bodies in one scene: one WebGL context and one canvas, and nothing is drawn while they rest", async ({ page }) => {
  await page.goto(`${PORTRAIT}${portraitScene()}`);
  await liveView(page);
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await view(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBe(1);
  expect(await view(page).evaluate((el) => (el as unknown as { stats: { bodies: number } }).stats.bodies)).toBe(12);
});

test("twelve bodies with one turning by itself: at most thirty frames a second, one frame at a time, and nothing out of sight", async ({ page }) => {
  await page.goto(`${PORTRAIT}${portraitScene("", "30")}`);
  await liveView(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBeGreaterThan(0);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(4 * 31);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.append(spacer);
    window.scrollTo(0, 5000);
  });
  await settle(page, 2500);
  const hidden = await readCounts(page);
  await settle(page, 2500);
  const still = await readCounts(page);
  expect(still.draws - hidden.draws).toBe(0);
  expect(still.rafRequests - hidden.rafRequests).toBeLessThanOrEqual(1);
});

test("changes to the portrait give back what they took: adding and removing bodies, the looks, the layouts and the background leave contexts and graphics memory flat", async ({ page }) => {
  await page.goto(`${PORTRAIT}${portraitScene()}`);
  await liveView(page);
  const round = async () => {
    await page.locator("#tab-look").click();
    for (const look of ["line", "realistic"]) {
      await page.locator(`#looks [data-look="${look}"]`).click();
      await settle(page, 500);
    }
    for (const bg of ["black", "gradient", "stars"]) await page.locator(`#bgs [data-bg="${bg}"]`).click();
    await page.locator("#shadows").click();
    await page.locator("#shadows").click();
    await page.locator("#tab-arrange").click();
    for (const how of ["arc", "grid", "row"]) {
      await page.locator(`#arranges [data-arrange="${how}"]`).click();
      await settle(page, 300);
    }
    await page.locator('#layouts [data-layout="manual"]').click();
    await page.locator("#fit").click();
    await page.locator('#layouts [data-layout="auto"]').click();
    await page.locator("#tab-bodies").click();
    for (const id of ["sun", "mars", "pluto", "sun", "mars", "pluto"]) {
      await page.locator(`[data-testid="body-${id}"]`).click();
      await settle(page, 400);
    }
    await liveView(page);
  };
  await round();
  await settle(page, 3000);
  const first = await readCounts(page);
  for (let i = 0; i < 2; i += 1) await round();
  await settle(page, 3000);
  const last = await readCounts(page);
  // a context is made again only after the page has been in the line look for longer than the renderer's second of grace, and the one let go is lost at once: never more than one live
  expect(last.contexts).toBeLessThanOrEqual(first.contexts);
  expect(last.contexts).toBeLessThanOrEqual(2);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 6);
  expect(await view(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
});

test("a moving drag of a body draws at most thirty frames a second", async ({ page }) => {
  await page.goto(`${PORTRAIT}${portraitScene("~layout:manual~labels:0")}`);
  await liveView(page);
  await page.locator('[data-testid="item-earth"]').click();
  const box = (await page.locator("#view").boundingBox())!;
  const before = await readCounts(page);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const started = Date.now();
  await page.mouse.down();
  for (let i = 0; i < 120; i += 1) await page.mouse.move(box.x + box.width * 0.5 + i, box.y + box.height * 0.5 + (i % 7));
  await page.mouse.up();
  const seconds = (Date.now() - started) / 1000;
  await settle(page, 500);
  const after = await readCounts(page);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(Math.ceil(seconds * 31) + 4);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
});

test("the portrait canvas stays within 6 million pixels and 4096 a side on a 5K screen at a pixel ratio of 2", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 5120, height: 2880 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${PORTRAIT}${portraitScene()}`);
  await liveView(page);
  await settle(page, 800);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  await context.close();
});

// --- the space view: eleven bodies in ONE scene, one WebGL context, nothing drawn at rest ------------------------------------------------------------------------------------------------
const SPACE_PAGE = "/wakusei-planets/space.html";
const sky = (page: Page) => page.locator("wakusei-space");
const liveSky = (page: Page) => expect(sky(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });
const skyStats = (page: Page) => sky(page).evaluate((el) => (el as unknown as { stats: { draws: number; lookups: number; time: number; bodies: { painted: number } } }).stats);
const goTo = (page: Page, name: string) => page.getByRole("group", { name: "Go to" }).getByRole("button", { name, exact: true }).dispatchEvent("click");

test("the space view at rest: one WebGL context, one canvas, eleven bodies, and nothing is drawn", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&look=painted`);
  await liveSky(page);
  await expect.poll(async () => (await skyStats(page)).bodies.painted, { timeout: 60_000 }).toBe(11);
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await sky(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBe(1);
});

test("the space view at a day a second: at most thirty frames a second, one frame at a time, a lookup about once a second, and nothing out of sight", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&speed=86400`);
  await liveSky(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  const s0 = await skyStats(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  const s1 = await skyStats(page);
  expect(s1.draws - s0.draws).toBeGreaterThan(0);
  expect(s1.draws - s0.draws).toBeLessThanOrEqual(4 * 31);
  expect((s1.lookups - s0.lookups) / 4).toBeLessThanOrEqual(2.6);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(4 * 31 * 2);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.prepend(spacer);
    window.scrollTo(0, 5000);
  });
  await settle(page, 2500);
  const hidden = await readCounts(page);
  await settle(page, 2500);
  const still = await readCounts(page);
  expect(still.draws - hidden.draws).toBe(0);
  expect(still.rafRequests - hidden.rafRequests).toBeLessThanOrEqual(1);
});

test("changes to the space view give back what they took: the zooms, the scales, the looks, the light, the clock and a removed element leave contexts and graphics memory flat", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z`);
  await liveSky(page);
  const round = async () => {
    for (const place of ["Moon", "Sun", "Inner planets", "Whole solar system", "Jupiter and its moons", "Earth"]) {
      await goTo(page, place);
      await settle(page, 500);
    }
    for (const [group, name] of [["Scale", "True"], ["Look", "Painted"], ["Earth's light", "Always lit"], ["Scale", "Compressed"], ["Look", "Realistic"], ["Earth's light", "The Sun's"]] as const) {
      await page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await settle(page, 500);
    }
    await page.locator("#orbits").dispatchEvent("click");
    await page.locator("#orbits").dispatchEvent("click");
    for (const name of ["The Moon", "Mars", "Io, over Jupiter", "Off"]) {
      await page.getByRole("group", { name: "Ride along" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await settle(page, 700);
    }
    await settle(page, 500);
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await readCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await readCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
  await sky(page).evaluate((el) => el.remove());
  await settle(page, 3500);
  const gone = await readCounts(page);
  for (const kind of ["Buffer", "VertexArray", "Program"] as const) expect(gone.created[kind] - gone.deleted[kind], `${kind} left`).toBe(0);
  expect(gpuObjects(gone)).toBeLessThanOrEqual(8);
});

test("riding along draws at most thirty frames a second at a day a second, nothing at rest, and nothing out of sight", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&speed=86400&ride=mars`);
  await liveSky(page);
  await settle(page, 2500);
  const s0 = await skyStats(page);
  const before = await readCounts(page);
  await settle(page, 4000);
  const s1 = await skyStats(page);
  const after = await readCounts(page);
  expect(s1.draws - s0.draws).toBeGreaterThan(0);
  expect(s1.draws - s0.draws).toBeLessThanOrEqual(4 * 31);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(4 * 31 * 2);
  await sky(page).evaluate((el) => Reflect.set(el, "speed", 0));
  await settle(page, 6000);
  const rest0 = await readCounts(page);
  await settle(page, 3000);
  const rest1 = await readCounts(page);
  expect(rest1.draws - rest0.draws).toBe(0);
  expect(rest1.rafRequests - rest0.rafRequests).toBe(0);
});

test("the space view's canvas stays within 6 million pixels and 4096 a side on a 5K screen at a pixel ratio of 2", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 5120, height: 2880 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z`);
  await liveSky(page);
  await settle(page, 800);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  await context.close();
});
