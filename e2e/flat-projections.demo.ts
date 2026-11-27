// The projections panel of the flat page in a real browser: any painted body in five projections, the graticule, the Sun's ring, the middle, Japanese and a phone. It is a 2D canvas: nothing here counts GPU objects, only draws.
// Everything is read from the canvas the page drew, with the clock held, so no wait depends on how busy the machine is: a state is waited for until the page says it has it (`loaded`, the draw counters), and the one test that asserts nothing happens says so.
import { expect, test, type Page } from "@playwright/test";

type Projections = { render(): void; stats(): { draws: number; overlayDraws: number; body: string; projection: string; loaded: boolean } };
type Flat = HTMLElement & { stats: { draws: number } };

test.use({ reducedMotion: "no-preference" });

const stats = (page: Page): Promise<ReturnType<Projections["stats"]>> => page.evaluate(() => (Reflect.get(window, "wakuseiProjections") as Projections).stats());
const open = async (page: Page, query = ""): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/flat.html${query}`);
  await page.locator("wakusei-flat#flat").scrollIntoViewIfNeeded();
  await expect(page.locator("wakusei-flat#flat")).toHaveAttribute("data-state", "ready");
  // the clock is held at a fixed moment, in the same step as the first read, so a tick cannot move the Sun's ring
  await page.locator("wakusei-flat#flat").evaluate((el) => {
    el.setAttribute("speed", "0");
    el.setAttribute("time", "2026-11-17T12:00:00Z");
  });
  await page.locator("#projected").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await stats(page)).loaded).toBe(true);
  return errors;
};
/** The canvas as pixels, read in one call: its size, a hash of its bytes, and the alpha at a few points. */
const pixels = (page: Page): Promise<{ width: number; height: number; hash: number; rgba: number[][] }> =>
  page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#projected")!;
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let i = 0; i < data.length; i += 7) hash = Math.imul(hash ^ data[i]!, 16777619) >>> 0;
    const at = (x: number, y: number): number[] => [...data.slice((y * canvas.width + x) * 4, (y * canvas.width + x) * 4 + 4)];
    const probes = [at(2, 2), at(canvas.width - 3, canvas.height - 3), at(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2))];
    return { width: canvas.width, height: canvas.height, hash, rgba: probes };
  });
const waitDrawn = async (page: Page, before: number): Promise<void> => {
  await expect.poll(async () => (await stats(page)).overlayDraws).toBeGreaterThan(before);
};

// CPU_THROTTLE=4 runs every test with the CPU four times slower (Chromium), to show that no wait depends on a fast machine
test.beforeEach(async ({ page, browserName }) => {
  const rate = Number(process.env["CPU_THROTTLE"] ?? 1);
  if (rate > 1 && browserName === "chromium") await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate });
});

test.beforeEach(async ({ viewport }, info) => {
  test.skip((viewport?.width ?? 1280) < 500 && !info.title.startsWith("a phone"), "the desktop tests read the whole panel on one screen; the phone's own test is below");
});

test("the panel draws Mars in Mollweide: the ellipse is filled, the corners are empty, the Sun's ring is on the map, and there is no fold-open section", async ({ page }) => {
  const errors = await open(page);
  const s = await stats(page);
  expect(s).toMatchObject({ body: "mars", projection: "mollweide" });
  const p = await pixels(page);
  expect(p.rgba[0]![3], "the corner of the box is outside the ellipse").toBe(0);
  expect(p.rgba[1]![3]).toBe(0);
  expect(p.rgba[2]![3], "the middle is on the map").toBe(255);
  // the ring is the yellow of the page's drawing, found at its own place
  const ring = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#projected")!;
    const x = Number(canvas.dataset["sunX"]);
    const y = Number(canvas.dataset["sunY"]);
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    const near = (dx: number, dy: number): number[] => [...data.slice(((y + dy) * canvas.width + x + dx) * 4, ((y + dy) * canvas.width + x + dx) * 4 + 3)];
    // The ring is 8 CSS px from the centre and 2.5 px wide, drawn about the Sun's exact place, with a canvas pixel for each CSS pixel at a device pixel ratio of 1 and two at 2 (WebKit's desk is 2). `sunX` and `sunY` are that place rounded, so a pixel at exactly 8 px can be half outside the stroke when the page's layout puts the place a fraction of a pixel off (as on CI's Linux). The ring is read as the yellowest pixel within 6 to 10 CSS px, east and west.
    const ratio = canvas.width / canvas.clientWidth;
    const yellow = (colour: number[]): number => Math.abs(colour[0]! - 255) + Math.abs(colour[1]! - 213) + Math.abs(colour[2]! - 74);
    const reach = Array.from({ length: Math.round(10.5 * ratio) - Math.round(5.5 * ratio) + 1 }, (_, i) => Math.round(5.5 * ratio) + i);
    const nearest = (side: 1 | -1): number => Math.min(...reach.map((dx) => yellow(near(side * dx, 0))));
    return { x, y, centre: near(0, 0), east: nearest(1), west: nearest(-1), caption: document.querySelector("#pj-caption")!.textContent };
  });
  expect(ring.centre).toEqual([255, 213, 74]);
  // the ring's edge is smoothed, so its colour is near the yellow, not exactly it; both sides of the ring are on the map
  expect(ring.east, "the ring's east side is yellow").toBeLessThan(40);
  expect(ring.west, "the ring's west side is yellow").toBeLessThan(40);
  expect(ring.caption).toContain("Mars in the Mollweide projection");
  expect(await page.locator("#pj-lat-field").isHidden(), "the middle latitude is for the disc alone").toBe(true);
  expect(await page.locator(".projected-stage details").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("each projection is another picture, the disc asks for a middle latitude, and a body from the list is drawn from its own texture", async ({ page }) => {
  await open(page);
  const seen = new Set<number>();
  for (const projection of ["equirectangular", "mercator", "sinusoidal", "mollweide", "azimuthal"]) {
    const before = (await stats(page)).overlayDraws;
    await page.locator(`#pj-proj button[data-value="${projection}"]`).click();
    await waitDrawn(page, before);
    expect((await stats(page)).projection).toBe(projection);
    await expect(page.locator("#projected")).toHaveAttribute("data-projection", projection);
    await expect(page.locator(`#pj-proj button[data-value="${projection}"]`)).toHaveAttribute("aria-pressed", "true");
    seen.add((await pixels(page)).hash);
    expect(await page.locator("#pj-lat-field").isHidden()).toBe(projection !== "azimuthal");
  }
  expect(seen.size, "five projections, five pictures").toBe(5);
  const before = (await stats(page)).overlayDraws;
  const mars = (await pixels(page)).hash;
  await page.locator("#pj-body").selectOption("ariel");
  await page.locator("#projected").scrollIntoViewIfNeeded();
  await expect(page.locator("#projected")).toHaveAttribute("data-body", "ariel");
  await waitDrawn(page, before);
  expect((await pixels(page)).hash).not.toBe(mars);
  await expect(page.locator("#pj-caption")).toContainText("Ariel");
  await expect(page.locator("#pj-credit")).toContainText("Voyager 2 mosaic");
});

test("the lines are a choice and the middle turns the map: Off draws no graticule, and a new middle longitude draws a new picture", async ({ page }) => {
  await open(page, "?proj=equirectangular");
  const withLines = (await pixels(page)).hash;
  let before = (await stats(page)).overlayDraws;
  await page.locator('#pj-lines button[data-value="0"]').click();
  await waitDrawn(page, before);
  const without = (await pixels(page)).hash;
  expect(without).not.toBe(withLines);
  await page.locator('#pj-lines button[data-value="15"]').click();
  await expect.poll(async () => (await pixels(page)).hash).not.toBe(without);
  const fine = (await pixels(page)).hash;
  expect(fine).not.toBe(withLines);
  before = (await stats(page)).overlayDraws;
  await page.locator("#pj-lon").fill("90");
  await waitDrawn(page, before);
  expect((await pixels(page)).hash).not.toBe(fine);
  await expect(page.locator("#pj-caption")).toContainText("90");
});

test("nothing is drawn at rest: with the clock held, the panel draws once for a change and not again", async ({ page }) => {
  await open(page);
  // the page draws the ring for the moment the clock held at; ask once so the count below starts from there
  await page.evaluate(() => (Reflect.get(window, "wakuseiProjections") as { render(): void }).render());
  const first = await stats(page);
  // asserting that nothing happens: two animation frames are not a wait for an event, they let a stray draw show itself
  for (let i = 0; i < 30; i += 1) await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(undefined))));
  const later = await stats(page);
  expect(later.draws).toBe(first.draws);
  expect(later.overlayDraws).toBe(first.overlayDraws);
  // the clock moving five seconds moves the ring by a hundredth of a pixel and draws nothing; an hour moves it and draws the ring (the picture itself is not resampled)
  const flatDraws = await page.locator("wakusei-flat#flat").evaluate((el) => (el as Flat).stats.draws);
  expect(flatDraws).toBeGreaterThan(0);
  // the page asks the panel to draw when the clock's time changes; here the time is set and the panel asked in one call
  const setTime = (iso: string, running = false): Promise<void> =>
    page.locator("wakusei-flat#flat").evaluate((el, value) => {
      (el as HTMLElement & { time: number }).time = Date.parse(value.iso);
      (Reflect.get(window, "wakuseiProjections") as { renderTime(running: boolean): void }).renderTime(value.running);
    }, { iso, running });
  await setTime("2026-11-17T12:00:05Z");
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)))));
  expect((await stats(page)).overlayDraws).toBe(first.overlayDraws);
  await setTime("2026-11-17T22:00:00Z");
  await expect.poll(async () => (await stats(page)).overlayDraws).toBe(first.overlayDraws + 1);
  expect((await stats(page)).draws, "the picture is the same, only the ring moved").toBe(first.draws);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("#projected")).not.toBeInViewport();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)))));
  const offscreen = (await stats(page)).overlayDraws;
  await setTime("2026-11-18T07:00:00Z");
  expect((await stats(page)).overlayDraws).toBe(offscreen);
  await page.locator("#projected").scrollIntoViewIfNeeded();
  await waitDrawn(page, offscreen);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = (await stats(page)).overlayDraws;
  await setTime("2026-11-18T15:00:00Z", true);
  expect((await stats(page)).overlayDraws).toBe(still);
  await setTime("2026-11-18T15:00:00Z");
  await waitDrawn(page, still);
});

test("Japanese: the words, the body's name and the label for a screen reader", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(page.locator("#pj-proj")).toContainText("モルワイデ図法");
  await expect(page.locator("#pj-body option[value=mars]")).toHaveText("火星");
  await expect(page.locator("#pj-caption")).toContainText("火星、モルワイデ図法");
  await expect(page.locator("#projected")).toHaveAttribute("aria-label", "火星のモルワイデ図法の地図");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("a phone: the map fits the screen, the controls are reachable and nothing scrolls sideways", async ({ page }) => {
    await open(page, "?proj=azimuthal");
    await page.locator("#projected").scrollIntoViewIfNeeded();
    const box = (await page.locator("#projected").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.width).toBeGreaterThan(280);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator("#pj-lat-field")).toBeVisible();
    await page.locator("#pj-lat").fill("90");
    await expect(page.locator("#pj-caption")).toContainText("90");
  });
});
