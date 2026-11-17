// The flat solar system page in a real browser: the Sun, the planets, the belts, the comets and the craft on a canvas, moving with the time shown, nothing drawn at rest or out of sight, a pick by pointer and keyboard, the scale swapped from one button,
// the Tesla Roadster found and followed, Japanese, and the phone's width. The map and the dots are 2D canvases, so there is no WebGL here and nothing to count but draws.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { underLoad } from "./under-load.ts";

type System = HTMLElement & {
  stats: { draws: number; mapDraws: number; dots: number; beltPoints: number; running: boolean; paused: boolean; extent: number; canvases: { width: number; height: number }[] };
  placeOf(id: string): { x: number; y: number; au: [number, number, number]; distanceAu: number } | null;
  bodies: { id: string; name: string; kind: string; layer: string; shown: boolean; distanceAu: number }[];
  center: string | null;
  zoom: number;
  extent: number;
  selected: string | null;
  layers: string[];
  pick(id: string | null): void;
};

test.use({ reducedMotion: "no-preference" });
// The desktop tests read the whole disc in one screen; the phone has its own test below.
test.beforeEach(async ({ page, browserName, viewport }, info) => {
  await underLoad(page, browserName);
  test.skip((viewport?.width ?? 1280) < 500 && !info.title.startsWith("a phone"), "read on a desktop screen: the phone's own test is below");
});

const system = (page: Page): Locator => page.locator("wakusei-flat-system#system");
const stats = (page: Page): Promise<System["stats"]> => system(page).evaluate((el) => (el as System).stats);
const where = (page: Page, id: string): Promise<{ x: number; y: number; au: [number, number, number]; distanceAu: number } | null> => system(page).evaluate((el, who) => (el as System).placeOf(who), id);
const open = async (page: Page, query = ""): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/system.html${query}`);
  await expect(system(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(0);
  return errors;
};
const settled = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** Hold the map where it is: a held clock draws nothing, and the test sets the moment. */
const hold = async (page: Page, iso = "2026-11-17T12:00:00Z"): Promise<void> => {
  await system(page).evaluate((el, time) => {
    el.setAttribute("speed", "0");
    el.setAttribute("time", time);
  }, iso);
  await settled(page);
};
const spot = async (page: Page, x: number, y: number): Promise<{ x: number; y: number }> => {
  await system(page).locator(".dots").scrollIntoViewIfNeeded();
  const box = (await system(page).locator(".dots").boundingBox())!;
  return { x: box.x + x, y: box.y + y };
};
const listen = (page: Page): Promise<void> =>
  system(page).evaluate((el) => {
    Reflect.set(window, "__picks", []);
    el.addEventListener("wakusei-flat-pick", (event) => (Reflect.get(window, "__picks") as unknown[]).push((event as CustomEvent).detail));
  });
const picks = (page: Page): Promise<{ kind: string | null; id: string | null; name: string | null; via: string; layer: string | null; distanceAu: number | null; predicted: boolean | null }[]> => page.evaluate(() => Reflect.get(window, "__picks"));

test("the map is in: the Sun, nine planets, the dwarf planets, the comets, the craft with the Tesla Roadster and the belts as points, nothing is wider than the page, and there is no fold-open section", async ({ page }, info) => {
  const errors = await open(page);
  await expect.poll(async () => (await stats(page)).beltPoints).toBeGreaterThan(1500);
  const bodies = await system(page).evaluate((el) => (el as System).bodies);
  expect(bodies[0]!.id).toBe("sun");
  expect(bodies.filter((b) => b.layer === "planets")).toHaveLength(9);
  expect(bodies.filter((b) => b.layer === "dwarfs").length).toBe(12);
  expect(bodies.filter((b) => b.layer === "comets").length).toBeGreaterThan(20);
  expect(bodies.some((b) => b.id === "roadster" && b.kind === "spacecraft")).toBe(true);
  expect(bodies.some((b) => b.id === "voyager1")).toBe(true);
  // Voyager 1 is on the map, so the edge is 200 au
  expect((await stats(page)).extent).toBe(200);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator("details").count()).toBe(1);
  for (const c of (await stats(page)).canvases) expect(c.width * c.height).toBeLessThan(6_000_000);
  await system(page).screenshot({ path: info.outputPath("flat-system.png") });
  info.annotations.push({ type: "picture", description: info.outputPath("flat-system.png") });
  expect(errors).toEqual([]);
});

test("the planets move with the time: the Earth is at another place a quarter of a year later, back at the same moment it is at the same place, and a running clock moves it", async ({ page }) => {
  await open(page);
  await hold(page, "2026-11-17T12:00:00Z");
  const a = (await where(page, "earth"))!;
  expect(a.distanceAu).toBeGreaterThan(0.97);
  expect(a.distanceAu).toBeLessThan(1.02);
  await system(page).evaluate((el) => el.setAttribute("time", "2027-02-17T12:00:00Z"));
  await settled(page);
  const b = (await where(page, "earth"))!;
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(40);
  await system(page).evaluate((el) => el.setAttribute("time", "2026-11-17T12:00:00Z"));
  await settled(page);
  const c = (await where(page, "earth"))!;
  expect(Math.abs(c.x - a.x)).toBeLessThan(0.01);
  expect(Math.abs(c.y - a.y)).toBeLessThan(0.01);
  await system(page).evaluate((el) => {
    el.setAttribute("speed", "864000");
    el.removeAttribute("paused");
  });
  await expect.poll(async () => {
    const now = (await where(page, "earth"))!;
    return Math.hypot(now.x - a.x, now.y - a.y);
  }).toBeGreaterThan(30);
  await expect(page.locator("#shown-time")).not.toHaveText("2026-11-17 12:00 UTC");
});

test("the scale is one button: squeezed puts Earth well out from the Sun, true crowds it in, and the foot of the map says which", async ({ page }) => {
  await open(page);
  await hold(page);
  await system(page).evaluate((el) => el.setAttribute("layers", "planets"));
  await settled(page);
  const radiusOf = async (id: string): Promise<number> => {
    const sun = (await where(page, "sun"))!;
    const at = (await where(page, id))!;
    return Math.hypot(at.x - sun.x, at.y - sun.y);
  };
  expect((await stats(page)).extent).toBe(50);
  const squeezed = (await radiusOf("earth")) / (await radiusOf("neptune"));
  // the plan's table: Earth 39 per cent of the way out, Neptune 92
  expect(squeezed).toBeGreaterThan(0.38);
  expect(squeezed).toBeLessThan(0.48);
  await system(page).locator('button[data-act="scale"]').click();
  await expect(system(page).locator('button[data-act="scale"]')).toHaveAttribute("aria-pressed", "false");
  await settled(page);
  const trueScale = (await radiusOf("earth")) / (await radiusOf("neptune"));
  expect(trueScale).toBeGreaterThan(0.025);
  expect(trueScale).toBeLessThan(0.045);
  // the planets keep their directions on either scale: the Earth is at the same angle
  const a = (await where(page, "earth"))!;
  const sun = (await where(page, "sun"))!;
  expect(Math.atan2(a.y - sun.y, a.x - sun.x)).toBeCloseTo(Math.atan2(-(a.au[1]), a.au[0]) , 1);
  await system(page).locator('button[data-act="scale"]').click();
  await settled(page);
  expect((await radiusOf("earth")) / (await radiusOf("neptune"))).toBeCloseTo(squeezed, 5);
});

test("nothing is drawn at rest: a held clock, a paused one and a map out of sight ask for no frame", async ({ page }) => {
  await open(page);
  await hold(page);
  const held = (await stats(page)).draws;
  await page.waitForTimeout(1500);
  expect((await stats(page)).draws).toBe(held);
  await system(page).evaluate((el) => {
    el.setAttribute("speed", "864000");
    el.setAttribute("paused", "");
  });
  await settled(page);
  const paused = (await stats(page)).draws;
  await page.waitForTimeout(1500);
  expect((await stats(page)).draws).toBe(paused);
  expect((await stats(page)).running).toBe(false);
  await system(page).evaluate((el) => el.removeAttribute("paused"));
  await expect.poll(async () => (await stats(page)).draws).toBeGreaterThan(paused + 2);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.querySelector("main")!.prepend(spacer);
    window.scrollTo(0, 3000);
  });
  await page.waitForTimeout(500);
  const out = (await stats(page)).draws;
  await page.waitForTimeout(1500);
  expect((await stats(page)).draws).toBe(out);
});

test("a pick by the pointer: the Tesla Roadster, a planet, a belt body and nothing; a hover names what is under it and a tap chooses it", async ({ page }) => {
  await open(page);
  await hold(page);
  await system(page).evaluate((el) => {
    (el as System).zoom = 4;
    (el as System).center = "roadster";
  });
  await settled(page);
  await listen(page);
  const car = (await where(page, "roadster"))!;
  const at = await spot(page, car.x, car.y);
  await page.mouse.move(at.x, at.y);
  await expect(system(page).locator(".tip")).toContainText("Tesla Roadster");
  await expect(system(page).locator(".tip")).toContainText("position predicted");
  await page.mouse.click(at.x, at.y);
  const taps = (await picks(page)).filter((p) => p.via === "tap");
  expect(taps.at(-1)).toMatchObject({ kind: "spacecraft", id: "roadster", name: "Tesla Roadster", layer: "craft", predicted: true });
  expect(taps.at(-1)!.distanceAu).toBeGreaterThan(1.1);
  expect(await system(page).evaluate((el) => (el as System).selected)).toBe("roadster");
  // the Earth, near it
  const earth = (await where(page, "earth"))!;
  const e = await spot(page, earth.x, earth.y);
  await page.mouse.click(e.x, e.y);
  expect((await picks(page)).filter((p) => p.via === "tap").at(-1)).toMatchObject({ kind: "planet", id: "earth", layer: "planets" });
  // a tap on nothing is one event with id null
  const empty = await spot(page, 4, 4);
  await page.mouse.click(empty.x, empty.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: null, id: null });
  expect(await system(page).evaluate((el) => (el as System).selected)).toBeNull();
});

test("a belt body can be pressed: a point of the main belt sends a pick of kind belt with its name and its distance", async ({ page }) => {
  await open(page);
  await hold(page);
  await system(page).evaluate((el) => el.setAttribute("layers", "belts"));
  await settled(page);
  await listen(page);
  const hit = await system(page).locator(".dots").evaluate((canvas: HTMLCanvasElement) => {
    // a lit pixel of the main belt's cloud (its colour is #d9d3c3), well away from the Sun
    const w = canvas.width;
    const h = canvas.height;
    const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
    const k = w / canvas.clientWidth;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4;
        if (data[i + 3]! > 200 && Math.abs(data[i]! - 217) < 3 && Math.abs(data[i + 1]! - 211) < 3 && Math.abs(data[i + 2]! - 195) < 3 && Math.hypot(x - w / 2, y - h / 2) > 60 * k) return { x: x / k, y: y / k };
      }
    }
    return null;
  });
  expect(hit).not.toBeNull();
  const at = await spot(page, hit!.x, hit!.y);
  await page.mouse.click(at.x, at.y);
  const pick = (await picks(page)).filter((p) => p.via === "tap").at(-1)!;
  expect(pick.kind).toBe("belt");
  expect(pick.layer).toBe("belts");
  expect(pick.name).toMatch(/\w/);
  expect(pick.distanceAu).toBeGreaterThan(1.5);
});

test("the keyboard: the canvas takes the focus, the arrows go from one body to the next, Enter chooses, Escape lets go, plus zooms", async ({ page }) => {
  await open(page);
  await hold(page);
  await listen(page);
  await system(page).locator(".dots").focus();
  await page.keyboard.press("Home");
  const first = (await picks(page)).at(-1)!;
  expect(first.via).toBe("key");
  expect(first.id).not.toBeNull();
  await page.keyboard.press("ArrowRight");
  const second = (await picks(page)).at(-1)!;
  expect(second.id).not.toBe(first.id);
  await expect(system(page).locator("#live")).not.toBeEmpty();
  await page.keyboard.press("Enter");
  expect(await system(page).evaluate((el) => (el as System).selected)).toBe(second.id);
  await page.keyboard.press("Escape");
  expect(await system(page).evaluate((el) => (el as System).selected)).toBeNull();
  const zoom = await system(page).evaluate((el) => (el as System).zoom);
  await page.keyboard.press("+");
  await expect.poll(() => system(page).evaluate((el) => (el as System).zoom)).toBeGreaterThan(zoom);
});

test("the chips and the buttons: a layer off takes its bodies off the map and tells the page; the paths and the orbits are buttons", async ({ page }) => {
  await open(page);
  await hold(page);
  await system(page).evaluate((el) => {
    Reflect.set(window, "__filters", []);
    el.addEventListener("wakusei-flat-filter", (event) => (Reflect.get(window, "__filters") as unknown[]).push((event as CustomEvent).detail));
  });
  const count = (layer: string): Promise<number> => system(page).evaluate((el, name) => (el as System).bodies.filter((b) => b.layer === name).length, layer);
  expect(await count("comets")).toBeGreaterThan(20);
  await system(page).locator('.chip[data-layer="comets"]').click();
  await expect.poll(() => count("comets")).toBe(0);
  await system(page).locator('.chip[data-layer="comets"]').click();
  await expect.poll(() => count("comets")).toBeGreaterThan(20);
  await system(page).locator('.chip[data-layer="craft"]').click();
  await expect.poll(() => count("craft")).toBe(0);
  await expect.poll(async () => (await stats(page)).extent).toBe(100);
  await system(page).locator('.chip[data-layer="craft"]').click();
  await expect.poll(() => count("craft")).toBeGreaterThan(5);
  await system(page).locator('.chip[data-layer="belts"]').click();
  await expect.poll(async () => (await stats(page)).beltPoints).toBe(0);
  await system(page).locator('.chip[data-layer="belts"]').click();
  await expect.poll(async () => (await stats(page)).beltPoints).toBeGreaterThan(1500);
  expect(await page.evaluate(() => (Reflect.get(window, "__filters") as { layers: string[] }[]).map((f) => f.layers.length))).toEqual([4, 5, 4, 5, 4, 5]);
  // the paths and the orbits change what is on the canvases
  const painted = (): Promise<number> =>
    system(page).locator(".dots").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n += 1;
      return n;
    });
  const before = await painted();
  await system(page).locator('button[data-act="track"]').click();
  await expect(system(page).locator('button[data-act="track"]')).toHaveAttribute("aria-pressed", "true");
  await expect.poll(painted).toBeGreaterThan(before + 500);
  const maps = (await stats(page)).mapDraws;
  await system(page).locator('button[data-act="orbits"]').click();
  await expect.poll(async () => (await stats(page)).mapDraws).toBeGreaterThan(maps);
  await expect(system(page).locator('button[data-act="orbits"]')).toHaveAttribute("aria-pressed", "false");
});

test("go to the Tesla Roadster: the map centres on it and follows it, and a drag lets go", async ({ page }) => {
  await open(page);
  await hold(page);
  await page.locator('#goto button[data-value="roadster"]').click();
  await expect(system(page)).toHaveJSProperty("center", "roadster");
  await settled(page);
  const box = (await system(page).locator(".dots").boundingBox())!;
  const car = (await where(page, "roadster"))!;
  expect(Math.abs(car.x - box.width / 2)).toBeLessThan(4);
  expect(Math.abs(car.y - box.height / 2)).toBeLessThan(4);
  expect(await system(page).evaluate((el) => (el as System).zoom)).toBeGreaterThan(2);
  await expect(page.locator("#card-name")).toHaveText("Tesla Roadster");
  await expect(page.locator("#card-facts")).toContainText("SpaceX");
  await expect(page.locator("#card-facts")).toContainText("A prediction");
  // time moves, the car stays in the middle
  await system(page).evaluate((el) => el.setAttribute("time", "2027-06-01T00:00:00Z"));
  await settled(page);
  const later = (await where(page, "roadster"))!;
  expect(Math.abs(later.x - box.width / 2)).toBeLessThan(4);
  // a drag lets go of it
  const at = await spot(page, box.width / 2 + 100, box.height / 2 + 80);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y, { steps: 5 });
  await page.mouse.up();
  await expect(system(page)).toHaveJSProperty("center", null);
});

test("zoom and pan: the buttons and a drag move the view, and the page is told", async ({ page }) => {
  await open(page);
  await hold(page);
  await system(page).evaluate((el) => {
    Reflect.set(window, "__views", []);
    el.addEventListener("wakusei-flat-view", (event) => (Reflect.get(window, "__views") as unknown[]).push((event as CustomEvent).detail));
  });
  await system(page).locator('button[data-act="zoomin"]').click();
  await system(page).locator('button[data-act="zoomin"]').click();
  await expect.poll(() => system(page).evaluate((el) => (el as System).zoom)).toBeGreaterThan(2);
  const sun = (await where(page, "sun"))!;
  const at = await spot(page, 300, 150);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 100, at.y + 10, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => ((await where(page, "sun")) ?? { x: sun.x }).x).toBeGreaterThan(sun.x + 50);
  expect((await page.evaluate(() => Reflect.get(window, "__views") as unknown[])).length).toBeGreaterThan(1);
  // the Sun button brings it back
  await system(page).locator('button[data-act="centre"][data-id="sun"]').click();
  await expect.poll(() => system(page).evaluate((el) => (el as System).center)).toBeNull();
});

test("Japanese: the words, the names of the bodies and the label for a screen reader follow the page", async ({ page }) => {
  await open(page, "?lang=ja");
  await expect(system(page)).toHaveAttribute("lang", "ja");
  await expect(system(page).locator(".dots")).toHaveAttribute("aria-label", "太陽系の平面図");
  await expect(system(page).locator('button[data-act="orbits"]')).toHaveText("軌道");
  await expect(system(page).locator('button[data-act="track"]')).toHaveText("航跡");
  await expect(system(page).locator('button[data-act="scale"]')).toHaveText("圧縮表示");
  await expect(system(page).locator(".chip").first()).toContainText("惑星");
  await expect(page.locator("#goto button").nth(2)).toContainText("テスラ・ロードスター");
  await hold(page);
  await system(page).evaluate((el) => (el as System).pick("roadster"));
  await system(page).locator(".dots").focus();
  await page.keyboard.press("Enter");
  await expect(system(page).locator("#live")).toContainText("テスラ・ロードスター、探査機、太陽から");
  await expect(system(page).locator("#live")).toContainText("位置は予測");
});

test("a phone: the map fits the width and a finger taps a body", async ({ page }, info) => {
  test.skip((page.viewportSize()?.width ?? 1280) >= 500, "a phone's own test");
  const errors = await open(page);
  await hold(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await system(page).locator(".dots").scrollIntoViewIfNeeded();
  const box = (await system(page).locator(".dots").boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box.height).toBeGreaterThan(box.width * 0.8);
  await listen(page);
  // Mars: the Earth has the Webb telescope and half a dozen craft within a few pixels of it, which a fingertip cannot tell apart until the map is zoomed
  const mars = (await where(page, "mars"))!;
  await page.touchscreen.tap(box.x + mars.x, box.y + mars.y);
  expect((await picks(page)).filter((p) => p.via === "tap").at(-1)).toMatchObject({ id: "mars" });
  await system(page).screenshot({ path: info.outputPath("flat-system-phone.png") });
  expect(errors).toEqual([]);
});
