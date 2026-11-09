// The space view in a real browser (Chromium, drawing in software): the right things in the right places, and the budget every live 3D view keeps.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { setLight } from "./space-ui.ts";

test.describe.configure({ mode: "serial" });
test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const SPACE = "wakusei-space";
const NOV2 = "2026-11-02T14:00Z";
interface SpaceStats {
  state: string;
  draws: number;
  contexts: number;
  canvas: { width: number; height: number; pixels: number };
  distance: number;
  time: number;
  lookups: number;
  camera: { position: [number, number, number]; fov: number };
  bodies: { look: string; painted: number; moons: number };
}
const statsOf = (page: Page): Promise<SpaceStats> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "stats") as SpaceStats);
const settle = (page: Page, ms = 600) => page.waitForTimeout(ms);
const setOn = (page: Page, key: string, value: unknown) => page.locator(SPACE).evaluate((el, [k, v]) => Reflect.set(el, k as string, v), [key, value] as const);

async function open(page: Page, query = `t=${NOV2}`): Promise<void> {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/space.html?${query}`);
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await expect.poll(async () => (await statsOf(page)).draws).toBeGreaterThan(0);
  await settle(page);
}

// a click that does not scroll the page: a view scrolled out of sight is rightly not drawn
const jump = (page: Page, name: string) => page.getByRole("group", { name: "Go to" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
const names = (page: Page): Promise<(string | null)[]> => page.locator(SPACE).evaluate((el) => [...el.shadowRoot!.querySelectorAll(".sp-label:not([hidden])")].map((n) => n.textContent));

/** The brightness (red, green and blue added) in the middle of the view, averaged over a square of 41 pixels. */
async function lightAtMiddle(page: Page): Promise<number> {
  const png = (await page.locator(SPACE).screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(Math.floor(bitmap.width / 2) - 20, Math.floor(bitmap.height / 2) - 20, 41, 41);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) sum += px[i]! + px[i + 1]! + px[i + 2]!;
    return sum / (px.length / 4);
  }, png);
}

test("the Earth is lit from where the Sun is: the Sahara at 14:00 UTC is in daylight and Japan is in the night, in one context", async ({ page }) => {
  await open(page);
  await setOn(page, "centre", { lon: 15, lat: 25 });
  await settle(page, 1200);
  expect((await readCounts(page)).contexts).toBe(1);
  const day = await lightAtMiddle(page);
  await setOn(page, "centre", { lon: 140, lat: 35 });
  await settle(page, 1200);
  const night = await lightAtMiddle(page);
  expect(day, "daylight").toBeGreaterThan(250);
  expect(night, "night").toBeLessThan(day / 3);
});

test("the Sun, the Moon and the planets are named, and every body is drawn", async ({ page }) => {
  await open(page);
  await jump(page, "Moon");
  await settle(page, 1200);
  expect(await names(page)).toEqual(expect.arrayContaining(["Earth", "Moon"]));
  await jump(page, "Whole solar system");
  await expect.poll(() => names(page), { timeout: 30_000 }).toEqual(expect.arrayContaining(["Sun", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Neptune", "Pluto"]));
  await expect.poll(async () => (await statsOf(page)).bodies.painted).toBe(11);
});

test("the names can be in Japanese and a page's own words", async ({ page }) => {
  await open(page);
  await setOn(page, "bodyNames", { mars: "火星" });
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await jump(page, "Whole solar system");
  await expect.poll(() => names(page), { timeout: 30_000 }).toEqual(expect.arrayContaining(["火星", "木星", "太陽"]));
});

test("paused, nothing is drawn and no frame is asked for; at real time, at most one draw in 6 seconds", async ({ page }) => {
  await open(page);
  const before = await readCounts(page);
  await page.waitForTimeout(4000);
  const after = await readCounts(page);
  expect(after.draws).toBe(before.draws);
  expect(after.rafRequests).toBe(before.rafRequests);
  await setOn(page, "speed", 1);
  await settle(page, 500);
  const real = await statsOf(page);
  await page.waitForTimeout(6000);
  const later = await statsOf(page);
  expect(later.draws - real.draws).toBeLessThanOrEqual(1);
});

test("a day a second: time runs at that rate, at most 30 draws a second, an ephemeris lookup about once a second", async ({ page }) => {
  await open(page);
  await setOn(page, "speed", 86400);
  await settle(page, 500);
  const s0 = await statsOf(page);
  const t0 = Date.now();
  await page.waitForTimeout(5000);
  const s1 = await statsOf(page);
  const seconds = (Date.now() - t0) / 1000;
  const perSecond = (s1.time - s0.time) / 86_400_000 / seconds;
  const draws = (s1.draws - s0.draws) / seconds;
  const lookups = (s1.lookups - s0.lookups) / seconds;
  console.log(`1 day a second: ${perSecond.toFixed(2)} days a second, ${draws.toFixed(1)} draws a second, ${lookups.toFixed(2)} lookups a second`);
  expect(perSecond).toBeGreaterThan(0.8);
  expect(perSecond).toBeLessThan(1.25);
  expect(draws).toBeLessThanOrEqual(31);
  expect(lookups).toBeLessThanOrEqual(2.6);
});

test("time runs backwards", async ({ page }) => {
  await open(page);
  await setOn(page, "speed", -86400);
  const s0 = await statsOf(page);
  await page.waitForTimeout(2500);
  const s1 = await statsOf(page);
  expect(s1.time).toBeLessThan(s0.time - 86_400_000);
});

test("out of sight or hidden, a game clock running at a day a second draws nothing", async ({ page }) => {
  await open(page, `t=${NOV2}&speed=86400`);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.prepend(spacer);
    window.scrollTo(0, 5000);
  });
  await page.waitForTimeout(1200);
  const before = await readCounts(page);
  await page.waitForTimeout(2500);
  const after = await readCounts(page);
  expect(after.draws).toBe(before.draws);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(1);
});

test("a body can be looked at: the camera goes to it, and choosing its name by keyboard does the same and says how big and far it is", async ({ page }) => {
  await open(page);
  await setOn(page, "body", "jupiter");
  await expect.poll(async () => (await statsOf(page)).distance).toBeCloseTo(3.4 * 1.8, 0);
  await jump(page, "Whole solar system");
  await settle(page, 1000);
  await page.locator(SPACE).evaluate((el) => (el.shadowRoot!.querySelector('button.sp-label[data-body="mars"]') as HTMLButtonElement).focus());
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await statsOf(page)).distance).toBeCloseTo(3.4 * 0.6, 0);
  await expect(page.locator("#caption")).toContainText("Mars: radius 3,396 km");
});

test("the scale is compressed or true: the Moon is 3.5 Earth radii away, or 60", async ({ page }) => {
  await open(page);
  const away = async (): Promise<number> => {
    await jump(page, "Moon");
    await settle(page, 800);
    const s = await statsOf(page);
    return Math.hypot(...s.camera.position);
  };
  await setOn(page, "body", "moon");
  const compressed = await away();
  // the camera is 3.06 Moon radii from the Moon when the preset frames its orbit: three times the Moon's own distance
  expect(compressed).toBeGreaterThan(8);
  expect(compressed).toBeLessThan(14);
  await page.getByRole("group", { name: "Scale" }).getByRole("button", { name: "True", exact: true }).dispatchEvent("click");
  await settle(page, 800);
  const real = await away();
  expect(real).toBeGreaterThan(50);
  expect(real).toBeLessThan(75);
});

test("the painted look draws all eleven bodies in one context, and Jupiter's moons are there when zoomed in", async ({ page }) => {
  await open(page, `t=${NOV2}&look=painted`);
  await expect.poll(async () => (await statsOf(page)).bodies.painted, { timeout: 30_000 }).toBe(11);
  expect((await statsOf(page)).bodies.look).toBe("painted");
  await jump(page, "Jupiter and its moons");
  await expect.poll(async () => (await statsOf(page)).bodies.moons, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  expect((await readCounts(page)).contexts).toBe(1);
});

test("Always lit shows the night side of the Earth, the true Sun leaves it dark", async ({ page }) => {
  await open(page, `t=${NOV2}`);
  await setOn(page, "centre", { lon: 140, lat: 35 });
  await settle(page, 1200);
  const dark = await lightAtMiddle(page);
  await setLight(page, "Always lit");
  await expect.poll(() => lightAtMiddle(page), { timeout: 20_000 }).toBeGreaterThan(dark * 3);
});

test("pressing on a body chooses it; a drag that turns the view does not", async ({ page }) => {
  await open(page);
  await jump(page, "Moon");
  await settle(page, 1000);
  await page.locator(SPACE).scrollIntoViewIfNeeded();
  const place = await page.locator(SPACE).evaluate((el) => {
    const label = el.shadowRoot!.querySelector('button.sp-label[data-body="moon"]') as HTMLElement;
    const box = el.getBoundingClientRect();
    const m = /translate\((-?\d+)px,\s*(-?\d+)px\)/.exec(label.style.transform)!;
    return { x: box.left + Number(m[1]) - 14, y: box.top + Number(m[2]) + 8 };
  });
  await page.mouse.move(place.x, place.y);
  await page.mouse.down();
  await page.mouse.move(place.x + 40, place.y + 5, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator("#caption")).toHaveText("");
  await page.mouse.click(place.x, place.y);
  await expect(page.locator("#caption")).toContainText("Moon: radius 1,737 km");
});

test("taking the element away frees what it held", async ({ page }) => {
  await open(page);
  await jump(page, "Moon");
  await settle(page, 800);
  await page.locator(SPACE).evaluate((el) => el.remove());
  await page.waitForTimeout(3500);
  const gone = await readCounts(page);
  for (const kind of ["Buffer", "VertexArray", "Program"] as const) expect(gone.created[kind] - gone.deleted[kind], `${kind} left`).toBe(0);
  expect(gpuObjects(gone), "only the few textures and targets three.js keeps for itself").toBeLessThanOrEqual(8);
});

test("a lost context is recovered", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await open(page);
  const draws = (await statsOf(page)).draws;
  await page.locator(SPACE).evaluate((el) => {
    const ext = (el.shadowRoot!.querySelector("canvas")!.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!;
    Reflect.set(window, "__lose", ext);
    ext.loseContext();
  });
  await expect(page.locator(SPACE)).toHaveAttribute("data-state", "lost");
  await page.evaluate(() => (Reflect.get(window, "__lose") as { restoreContext(): void }).restoreContext());
  await expect(page.locator(SPACE)).toHaveAttribute("data-state", "live");
  await setOn(page, "scale", "true");
  await expect.poll(async () => (await statsOf(page)).draws).toBeGreaterThan(draws);
  expect(errors).toEqual([]);
});

// --- riding along ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface RideStats extends SpaceStats {
  ride: { riding: boolean; lost: boolean; gliding: boolean };
}
const rideOf = (page: Page): Promise<RideStats> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "stats") as RideStats);
const rideAlong = (page: Page, target: unknown, options: unknown = {}) => page.locator(SPACE).evaluate((el, [t, o]) => (el as unknown as { ride(t: unknown, o: unknown): void }).ride(t, o), [target, options] as const);
const away = (s: SpaceStats): number => Math.hypot(...s.camera.position);

test("riding the Moon: the camera is 3.5 Earth radii out when compressed and 55 to 66 when true, and the Moon is not drawn round it", async ({ page }) => {
  await open(page);
  await rideAlong(page, "moon");
  await expect.poll(async () => (await rideOf(page)).ride.gliding).toBe(false);
  expect(away(await rideOf(page))).toBeCloseTo(3.5, 0);
  await setOn(page, "scale", "true");
  await settle(page, 800);
  const real = away(await rideOf(page));
  expect(real).toBeGreaterThan(55);
  expect(real).toBeLessThan(66);
});

test("riding a moon: the camera is at the moon's real place round its planet", async ({ page }) => {
  await open(page);
  await setOn(page, "scale", "true");
  await rideAlong(page, "io", { smooth: false });
  await settle(page, 1200);
  const s = await rideOf(page);
  expect(s.ride.riding).toBe(true);
  const { frameAt, placeAround, placeSun, radiusIn } = await import("../src/space/index.ts");
  const { moonOffset } = await import("../src/scene/orient.ts");
  const frame = frameAt(s.time);
  const sun = placeSun("true", frame.sun);
  const jupiter = placeAround("true", sun, [frame.planets.jupiter[0] - frame.sun[0], frame.planets.jupiter[1] - frame.sun[1], frame.planets.jupiter[2] - frame.sun[2]]);
  const offset = moonOffset("io", s.time);
  const R = radiusIn("jupiter", "true");
  const expected = [jupiter[0] + offset[0] * R, jupiter[1] + offset[1] * R, jupiter[2] + offset[2] * R];
  const miss = Math.hypot(s.camera.position[0] - expected[0], s.camera.position[1] - expected[1], s.camera.position[2] - expected[2]);
  expect(miss, `${miss} Earth radii from io's place`).toBeLessThan(0.05 * R);
});

test("riding a point of your own: it is 400 km up, and goes round at its own rate, in about 90 minutes", async ({ page }) => {
  await open(page);
  await page.locator(SPACE).evaluate((el) => {
    const radius = 6378.137 + 400;
    const rate = Math.sqrt(398_600.4418 / radius ** 3);
    const at = (ms: number) => {
      const a = rate * (ms / 1000);
      return { position: [radius * Math.cos(a), 0, radius * Math.sin(a)], velocity: [-radius * rate * Math.sin(a), 0, radius * rate * Math.cos(a)] };
    };
    (el as unknown as { ride(t: unknown, o: unknown): void }).ride({ at }, { smooth: false });
  });
  await setOn(page, "speed", 60);
  await settle(page, 600);
  const s0 = await rideOf(page);
  expect(away(s0)).toBeCloseTo(1.0627, 2);
  await page.waitForTimeout(4000);
  const s1 = await rideOf(page);
  const turned = (Math.acos(Math.min(1, (s0.camera.position[0] * s1.camera.position[0] + s0.camera.position[1] * s1.camera.position[1] + s0.camera.position[2] * s1.camera.position[2]) / (away(s0) * away(s1)))) * 180) / Math.PI;
  const expected = ((s1.time - s0.time) / 1000) * Math.sqrt(398_600.4418 / 6778.137 ** 3) * (180 / Math.PI);
  expect(Math.abs(turned - expected)).toBeLessThan(3);
});

test("a point that cannot be placed: the ride is lost, the ordinary camera is used and the page is told once", async ({ page }) => {
  await open(page);
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__lost", 0);
    el.addEventListener("wakusei-ride-lost", () => Reflect.set(window, "__lost", (Reflect.get(window, "__lost") as number) + 1));
    (el as unknown as { ride(t: unknown, o: unknown): void }).ride({ at: () => null }, { smooth: false });
  });
  await expect.poll(async () => (await rideOf(page)).ride.lost).toBe(true);
  expect(await page.evaluate(() => Reflect.get(window, "__lost"))).toBe(1);
  expect(away(await rideOf(page))).toBeCloseTo(3.4, 0);
});

test("switching glides and ends in about a second, then (the moons let go) nothing is drawn", async ({ page }) => {
  await open(page);
  await rideAlong(page, "moon", { smooth: false });
  await settle(page, 600);
  await rideAlong(page, "mars");
  expect((await rideOf(page)).ride.gliding).toBe(true);
  await expect.poll(async () => (await rideOf(page)).ride.gliding, { timeout: 4000 }).toBe(false);
  await settle(page, 5000);
  const before = await readCounts(page);
  await page.waitForTimeout(2500);
  const after = await readCounts(page);
  expect(after.draws).toBe(before.draws);
  expect(after.rafRequests).toBe(before.rafRequests);
});

test("riding at a day a second: at most 30 draws a second, and nothing when scrolled out of sight", async ({ page }) => {
  await open(page);
  await rideAlong(page, "mars", { smooth: false });
  await setOn(page, "speed", 86400);
  await settle(page, 800);
  const s0 = await statsOf(page);
  await page.waitForTimeout(4000);
  const s1 = await statsOf(page);
  expect((s1.draws - s0.draws) / 4).toBeLessThanOrEqual(31);
  expect(s1.draws - s0.draws).toBeGreaterThan(0);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.prepend(spacer);
    window.scrollTo(0, 5000);
  });
  await page.waitForTimeout(1200);
  const hidden = await readCounts(page);
  await page.waitForTimeout(2500);
  const still = await readCounts(page);
  expect(still.draws - hidden.draws).toBe(0);
});

test("stopping the ride gives the camera back to the body it was looking at", async ({ page }) => {
  await open(page);
  await setOn(page, "body", "jupiter");
  await rideAlong(page, "moon", { smooth: false });
  await settle(page, 600);
  await rideAlong(page, null, { smooth: false });
  await expect.poll(async () => (await rideOf(page)).distance).toBeCloseTo(3.4 * 1.8, 0);
  expect((await rideOf(page)).ride.riding).toBe(false);
});

const labelAt = (page: Page, id: string): Promise<{ x: number; y: number } | null> =>
  page.locator(SPACE).evaluate((el, body) => {
    const label = el.shadowRoot!.querySelector(`button.sp-label[data-body="${body}"]`) as HTMLElement | null;
    const found = /translate\((-?\d+)px,\s*(-?\d+)px\)/.exec(label?.style.transform ?? "");
    return label && !label.hidden && found ? { x: Number(found[1]), y: Number(found[2]) } : null;
  }, id);

test("Always lit lights every body, not only the Earth: the Moon and Venus show a bright face from the night side", async ({ page }) => {
  await open(page);
  for (const id of ["moon", "venus"] as const) {
    await setOn(page, "body", id);
    const brightness = async (mode: "The Sun's" | "Always lit"): Promise<number[]> => {
      await setLight(page, mode);
      const out: number[] = [];
      for (const lon of [0, 90, 180, 270]) {
        await setOn(page, "centre", { lon, lat: 0 });
        await settle(page, 700);
        out.push(await lightAtMiddle(page));
      }
      return out;
    };
    const sun = await brightness("The Sun's");
    const lit = await brightness("Always lit");
    expect(Math.min(...sun), `${id} has a dark side: ${sun}`).toBeLessThan(Math.max(...sun) / 3);
    expect(Math.min(...lit), `${id} is lit from every side: ${lit}`).toBeGreaterThan(Math.max(...sun) * 0.5);
  }
});

test("the view can be moved sideways and rolled: every body in the picture moves by exactly the pixels asked, at any depth, and a roll turns the picture clockwise", async ({ page }) => {
  await open(page);
  await jump(page, "Inner planets");
  await settle(page, 1000);
  const view = (v: { zoom: number; roll?: number; panX?: number; panY?: number }) => page.locator(SPACE).evaluate((el, w) => (el as unknown as { setView(v: unknown): void }).setView({ yaw: 0, tilt: 0, ...w }), v);
  const zoom = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("inner"));
  await view({ zoom });
  await settle(page, 800);
  const before = [await labelAt(page, "sun"), await labelAt(page, "earth"), await labelAt(page, "venus")];
  expect(before.every((at) => at !== null)).toBe(true);
  await view({ zoom, panX: 90, panY: -40 });
  await settle(page, 800);
  const after = [await labelAt(page, "sun"), await labelAt(page, "earth"), await labelAt(page, "venus")];
  for (const [i, at] of after.entries()) {
    expect(Math.abs(at!.x - before[i]!.x - 90), `body ${i} moves 90 px right`).toBeLessThanOrEqual(1);
    expect(Math.abs(at!.y - before[i]!.y + 40), `body ${i} moves 40 px up`).toBeLessThanOrEqual(1);
  }
  // rolling a quarter turn clockwise takes what was at the right to the bottom
  await view({ zoom });
  await settle(page, 600);
  const flat = await labelAt(page, "sun");
  const box = (await page.locator(SPACE).boundingBox())!;
  await view({ zoom, roll: 90 });
  await settle(page, 800);
  const rolled = await labelAt(page, "sun");
  const [cx, cy] = [box.width / 2, box.height / 2];
  const [dx, dy] = [flat!.x - cx, flat!.y - cy];
  expect(Math.abs(rolled!.x - (cx - dy)), "a clockwise quarter turn").toBeLessThan(60);
  expect(Math.abs(rolled!.y - (cy + dx))).toBeLessThan(60);
});

test.describe("a reader who prefers reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("a ride jumps instead of gliding, and runs at about one step a second at 60 times real time", async ({ page }) => {
    await open(page);
    await rideAlong(page, "moon");
    expect((await rideOf(page)).ride.gliding).toBe(false);
    await setOn(page, "speed", 60);
    await settle(page, 800);
    const s0 = await statsOf(page);
    await page.waitForTimeout(4000);
    const s1 = await statsOf(page);
    expect((s1.draws - s0.draws) / 4).toBeLessThanOrEqual(1.6);
  });
});
