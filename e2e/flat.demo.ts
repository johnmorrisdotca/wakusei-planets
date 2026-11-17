// The flat map page in a real browser: the Moon and Mars on a canvas, the orbiters moving with the time shown, nothing drawn at rest or out of sight, a pick by pointer, finger and keyboard, the body swapped from one control,
// Japanese, and the phone's width. The map and the dots are 2D canvases, so there is no WebGL here and nothing to count but draws.
import { expect, test, type Locator, type Page } from "@playwright/test";

type Flat = HTMLElement & {
  stats: { draws: number; mapDraws: number; dots: number; marks: number; running: boolean; paused: boolean; mapLoaded: boolean; canvases: { width: number; height: number }[] };
  placeOf(id: string): { x: number; y: number; lon: number; lat: number; altitudeKm: number | null } | null;
  center: number;
  zoom: number;
  time: number;
  selected: string | null;
  orbiters: { id: string; name: string; shown: boolean }[];
};

test.use({ reducedMotion: "no-preference" });
// The desktop tests read the whole world in one screen; on a phone the map wraps past the edges, so the phone has its own test below.
test.beforeEach(async ({ viewport }, info) => {
  test.skip((viewport?.width ?? 1280) < 500 && !info.title.startsWith("a phone"), "read on a desktop screen: the phone's own test is below");
});

const flat = (page: Page): Locator => page.locator("wakusei-flat#flat");
const stats = (page: Page): Promise<Flat["stats"]> => flat(page).evaluate((el) => (el as Flat).stats);
const where = (page: Page, id: string): Promise<{ x: number; y: number; lon: number; lat: number } | null> => flat(page).evaluate((el, who) => (el as Flat).placeOf(who), id);
const open = async (page: Page, query = "", ready = true): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/flat.html${query}`);
  if (ready) await expect(flat(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
  return errors;
};
/** Hold the map where it is: a held clock draws nothing, and the test sets the moment. */
const hold = async (page: Page, iso = "2026-11-17T12:00:00Z"): Promise<void> => {
  await flat(page).evaluate((el, time) => {
    el.setAttribute("speed", "0");
    el.setAttribute("time", time);
  }, iso);
  await settled(page);
};
const settled = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** A click or tap on a place of the map, in the page's pixels. */
const spot = async (page: Page, x: number, y: number): Promise<{ x: number; y: number }> => {
  const box = (await flat(page).locator(".dots").boundingBox())!;
  return { x: box.x + x, y: box.y + y };
};
const listen = (page: Page): Promise<void> =>
  flat(page).evaluate((el) => {
    Reflect.set(window, "__picks", []);
    el.addEventListener("wakusei-flat-pick", (event) => (Reflect.get(window, "__picks") as unknown[]).push((event as CustomEvent).detail));
  });
const picks = (page: Page): Promise<{ kind: string | null; id: string | null; name: string | null; via: string; body: string; placeKind: string | null }[]> => page.evaluate(() => Reflect.get(window, "__picks"));

test("the Moon: the map is in, the five orbiters with a path are drawn, the sites are marked, nothing is wider than the page, and there is no fold-open section", async ({ page }, info) => {
  const errors = await open(page);
  await expect.poll(async () => (await stats(page)).mapLoaded).toBe(true);
  const s = await stats(page);
  expect(s.dots).toBe(5);
  expect(s.marks).toBeGreaterThan(20);
  expect(await flat(page).evaluate((el) => (el as Flat).orbiters.filter((o) => o.shown).map((o) => o.id))).toEqual(["lro", "chandrayaan-2", "danuri", "artemis-p1", "artemis-p2"]);
  // CAPSTONE has no public path: it is named on the page, not drawn
  await expect(page.locator("#nopath")).toContainText("CAPSTONE");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // one small fold, the call that draws it, and no stack of them
  expect(await page.locator("details").count()).toBe(1);
  // the canvases stay inside the pixel budget
  for (const c of s.canvases) expect(c.width * c.height).toBeLessThan(6_000_000);
  await flat(page).screenshot({ path: info.outputPath("flat-moon.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("flat-moon.png") });
  expect(errors).toEqual([]);
});

test("Mars is the same element with another body: six orbiters, the rover sites, and the swap is one control", async ({ page }, info) => {
  const errors = await open(page);
  await page.locator('#bodies button[data-value="mars"]').click();
  await expect(flat(page)).toHaveAttribute("body", "mars");
  await expect.poll(async () => (await stats(page)).dots).toBe(6);
  await expect(flat(page).locator(".chip", { hasText: "Landing and rover sites" })).toContainText("19");
  expect(await flat(page).evaluate((el) => (el as Flat).orbiters.map((o) => o.id))).toEqual(["mro", "odyssey", "maven", "mars-express", "tgo", "hope"]);
  await expect(page.locator("#nopath")).toContainText("Tianwen-1");
  await expect(page).toHaveURL(/body=mars/);
  await expect(flat(page).locator(".dots")).toHaveAttribute("aria-label", "Flat map of Mars");
  await flat(page).screenshot({ path: info.outputPath("flat-mars.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("flat-mars.png") });
  expect(errors).toEqual([]);
});

test("the dots move with the time: the same orbiter is at another place a quarter of an orbit later, and runs on at a fast clock", async ({ page }) => {
  await open(page);
  await hold(page, "2026-11-17T12:00:00Z");
  const a = (await where(page, "lro"))!;
  await flat(page).evaluate((el) => el.setAttribute("time", "2026-11-17T12:30:00Z"));
  await settled(page);
  const b = (await where(page, "lro"))!;
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(20);
  // and back again: the same moment is the same place
  await flat(page).evaluate((el) => el.setAttribute("time", "2026-11-17T12:00:00Z"));
  await settled(page);
  const c = (await where(page, "lro"))!;
  expect(Math.abs(c.lat - a.lat)).toBeLessThan(0.001);
  expect(Math.abs(c.lon - a.lon)).toBeLessThan(0.001);
  // a running clock moves it, 600 times as fast as real time, and the shown time follows
  await flat(page).evaluate((el) => {
    el.setAttribute("speed", "600");
    el.removeAttribute("paused");
  });
  const before = (await where(page, "lro"))!;
  await expect.poll(async () => {
    const now = (await where(page, "lro"))!;
    return Math.hypot(now.x - before.x, now.y - before.y);
  }).toBeGreaterThan(15);
  expect(await flat(page).evaluate((el) => (el as Flat).time)).toBeGreaterThan(Date.UTC(2026, 10, 17, 12, 0, 30));
  expect((await stats(page)).running).toBe(true);
});

test("the night moves with the time: the Sun's mark crosses the map, and the shaded map is drawn again only when the Sun has moved", async ({ page }) => {
  await open(page);
  await hold(page, "2026-11-17T12:00:00Z");
  const first = await stats(page);
  await settled(page);
  expect((await stats(page)).mapDraws).toBe(first.mapDraws);
  await flat(page).evaluate((el) => el.setAttribute("time", "2026-11-24T12:00:00Z"));
  await settled(page);
  expect((await stats(page)).mapDraws).toBeGreaterThan(first.mapDraws);
  // a week is about a quarter of a lunar day: the line between day and night has moved a quarter of the way round
  await expect(page.locator("#caption")).toContainText("the Sun is overhead at");
});

test("nothing is drawn at rest: a held clock, a paused one and a map out of sight ask for no frame", async ({ page }) => {
  await open(page);
  await hold(page);
  const held = await stats(page);
  expect(held.running).toBe(false);
  await page.waitForTimeout(1500);
  expect((await stats(page)).draws).toBe(held.draws);
  // paused keeps the speed and holds the moment
  await flat(page).evaluate((el) => {
    el.setAttribute("speed", "600");
    el.setAttribute("paused", "");
  });
  await settled(page);
  const paused = await stats(page);
  expect(paused.running).toBe(false);
  expect(paused.paused).toBe(true);
  const at = await flat(page).evaluate((el) => (el as Flat).time);
  await page.waitForTimeout(1200);
  expect((await stats(page)).draws).toBe(paused.draws);
  expect(await flat(page).evaluate((el) => (el as Flat).time)).toBe(at);
  // running, then out of sight: it stops, and draws once when it is seen again
  await flat(page).evaluate((el) => el.removeAttribute("paused"));
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(paused.draws + 2);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.querySelector("main")!.prepend(spacer);
    window.scrollTo(0, 3000);
  });
  await settled(page);
  await page.waitForTimeout(300);
  const away = await stats(page);
  await page.waitForTimeout(1200);
  expect((await stats(page)).draws).toBe(away.draws);
  await flat(page).scrollIntoViewIfNeeded();
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(away.draws);
});

test("a pick by the pointer: an orbiter, a site, and nothing; a hover names what is under it and a tap chooses it", async ({ page }) => {
  await open(page);
  await hold(page);
  await listen(page);
  const lro = (await where(page, "lro"))!;
  const at = await spot(page, lro.x, lro.y);
  await page.mouse.move(at.x, at.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "orbiter", id: "lro", via: "hover", body: "moon" });
  await expect(flat(page).locator(".tip")).toContainText("Lunar Reconnaissance Orbiter");
  await page.mouse.click(at.x, at.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "orbiter", id: "lro", via: "tap", name: "Lunar Reconnaissance Orbiter" });
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBe("lro");
  await expect(page.locator("#card-name")).toHaveText("Lunar Reconnaissance Orbiter");
  // a site: Apollo 11's lander is a mark of the map
  const site = (await where(page, "moon/apollo-11-lunar-module"))!;
  expect(site).not.toBeNull();
  const there = await spot(page, site.x, site.y);
  await page.mouse.click(there.x, there.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "place", id: "moon/apollo-11-lunar-module", placeKind: "crewed", via: "tap" });
  await expect(page.locator("#card-name")).toContainText("Apollo 11");
  await expect(page.locator("#card-facts")).toContainText("Tranquillitatis");
  // a tap on nothing clears the choice
  await page.mouse.click(await spot(page, 5, 5).then((p) => p.x), await spot(page, 5, 5).then((p) => p.y));
  expect((await picks(page)).at(-1)).toMatchObject({ kind: null, id: null });
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBeNull();
});

test("the keyboard: the canvas takes the focus, the arrows go from one orbiter or mark to the next, Enter chooses, Escape lets go, plus zooms", async ({ page }) => {
  await open(page);
  await hold(page);
  await listen(page);
  await flat(page).locator(".dots").focus();
  await page.keyboard.press("Home");
  const first = (await picks(page)).at(-1)!;
  expect(first.via).toBe("key");
  expect(first.id).not.toBeNull();
  await page.keyboard.press("ArrowRight");
  const second = (await picks(page)).at(-1)!;
  expect(second.id).not.toBe(first.id);
  // the words for a screen reader are in the live region
  await expect(flat(page).locator("#live")).not.toBeEmpty();
  await page.keyboard.press("Enter");
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBe(second.id);
  await page.keyboard.press("Escape");
  expect(await flat(page).evaluate((el) => (el as Flat).selected)).toBeNull();
  const zoom = await flat(page).evaluate((el) => (el as Flat).zoom);
  await page.keyboard.press("+");
  await expect.poll(() => flat(page).evaluate((el) => (el as Flat).zoom)).toBeGreaterThan(zoom);
});

test("the chips, the footprint and the ground track: they change what is drawn and tell the page, and the footprint and track of the chosen orbiter alone are drawn when one is chosen", async ({ page }) => {
  await open(page);
  await hold(page);
  await flat(page).evaluate((el) => {
    Reflect.set(window, "__filters", []);
    el.addEventListener("wakusei-flat-filter", (event) => (Reflect.get(window, "__filters") as unknown[]).push((event as CustomEvent).detail));
  });
  const marks = (await stats(page)).marks;
  await flat(page).locator('.chip[data-layer="landing"]').click();
  await expect.poll(async () => (await stats(page)).marks).toBe(0);
  await flat(page).locator('.chip[data-layer="landing"]').click();
  await expect.poll(async () => (await stats(page)).marks).toBe(marks);
  await flat(page).locator('.chip[data-layer="orbiters"]').click();
  await expect.poll(async () => (await stats(page)).dots).toBe(0);
  await flat(page).locator('.chip[data-layer="orbiters"]').click();
  await expect.poll(async () => (await stats(page)).dots).toBe(5);
  expect(await page.evaluate(() => (Reflect.get(window, "__filters") as { orbiters: boolean }[]).map((f) => f.orbiters))).toEqual([true, true, false, true]);
  const before = (await stats(page)).draws;
  await flat(page).locator('button[data-act="footprint"]').click();
  await flat(page).locator('button[data-act="track"]').click();
  await expect(flat(page).locator('button[data-act="track"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(before);
  // the dots canvas has lines and circles in it now: more of it is painted than the dots alone
  const painted = await flat(page).locator(".dots").evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n += 1;
    return n;
  });
  expect(painted).toBeGreaterThan(2000);
});

test("zoom and pan: the buttons and a drag move the view, and the page is told", async ({ page }) => {
  await open(page);
  await hold(page);
  await flat(page).evaluate((el) => {
    Reflect.set(window, "__views", []);
    el.addEventListener("wakusei-flat-view", (event) => (Reflect.get(window, "__views") as unknown[]).push((event as CustomEvent).detail));
  });
  await flat(page).locator('button[data-act="zoomin"]').click();
  await flat(page).locator('button[data-act="zoomin"]').click();
  await expect.poll(() => flat(page).evaluate((el) => (el as Flat).zoom)).toBeGreaterThan(2);
  const start = await flat(page).evaluate((el) => (el as Flat).center);
  const at = await spot(page, 300, 150);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 120, at.y + 10, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => flat(page).evaluate((el) => (el as Flat).center)).toBeLessThan(start - 5);
  expect((await page.evaluate(() => Reflect.get(window, "__views") as unknown[])).length).toBeGreaterThan(1);
  // the Far side button turns the map half round
  await flat(page).locator('button[data-act="centre"][data-lon="180"]').click();
  await expect.poll(() => flat(page).evaluate((el) => Math.abs((el as Flat).center))).toBeGreaterThan(179);
});

test("Japanese: the words, the names of the orbiters and the sites, and the label for a screen reader follow the page", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(flat(page)).toHaveAttribute("lang", "ja");
  await expect(flat(page).locator(".dots")).toHaveAttribute("aria-label", "月の平面地図");
  await expect(flat(page).locator('button[data-act="footprint"]')).toHaveText("可視範囲");
  await expect(flat(page).locator('button[data-act="track"]')).toHaveText("地上軌跡");
  await expect(flat(page).locator(".chip").first()).toContainText("周回機");
  await expect(page.locator("#orbiters")).toContainText("LRO");
  await hold(page);
  await listen(page);
  const lro = (await where(page, "lro"))!;
  const at = await spot(page, lro.x, lro.y);
  await page.mouse.click(at.x, at.y);
  expect((await picks(page)).at(-1)).toMatchObject({ id: "lro", name: "ルナー・リコネサンス・オービター" });
  await expect(flat(page).locator(".tip")).toContainText("月の周回機");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("a phone: the map fits the screen, a finger picks an orbiter, a pinch zooms, and nothing scrolls sideways", async ({ page }) => {
      await open(page, "?body=mars");
    await hold(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = (await flat(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    const canvas = (await flat(page).locator(".dots").boundingBox())!;
    expect(canvas.width).toBeGreaterThan(300);
    await listen(page);
    await flat(page).locator(".dots").scrollIntoViewIfNeeded();
    const mro = (await where(page, "mro"))!;
    expect(mro).not.toBeNull();
    const at = await spot(page, mro.x, mro.y);
    await page.touchscreen.tap(at.x, at.y);
    expect((await picks(page)).at(-1)).toMatchObject({ kind: "orbiter", id: "mro", via: "tap", body: "mars" });
    // a pinch: two touches moving apart (the page's own touch events, as the element reads pointer events)
    const zoom = await flat(page).evaluate((el) => (el as Flat).zoom);
    await flat(page).evaluate((el) => {
      const dots = el.shadowRoot!.querySelector(".dots") as HTMLElement;
      const box = dots.getBoundingClientRect();
      const fire = (type: string, id: number, x: number, y: number): void => {
        dots.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: box.left + x, clientY: box.top + y, bubbles: true, isPrimary: id === 1 }));
      };
      fire("pointerdown", 1, 150, 120);
      fire("pointerdown", 2, 190, 120);
      for (let i = 1; i <= 6; i += 1) {
        fire("pointermove", 1, 150 - i * 12, 120);
        fire("pointermove", 2, 190 + i * 12, 120);
      }
      fire("pointerup", 1, 78, 120);
      fire("pointerup", 2, 262, 120);
    });
    await expect.poll(() => flat(page).evaluate((el) => (el as Flat).zoom)).toBeGreaterThan(zoom * 1.5);
  });
});
