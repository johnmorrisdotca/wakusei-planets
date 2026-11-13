// The standing view in a real browser (Chromium, drawn in software) over a made-up site (surface-fixture.ts): the tiles are asked for once, the view draws when something changes and not at rest,
// a drag turns it, the keys walk it over the ground and zoom it, the picture says its detail is made, and the sky is the real one. The pictures are drawn small and with the shadows off, since software drawing
// takes seconds a picture; the page's own draw is the same code. Nothing is downloaded from anywhere. Written to the rules of the test-rules page: what is counted is counted in the page.
import { expect, test, type Page } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // a slow machine: the page runs at a quarter of the speed, so a test that only passes on a quiet one fails here (the rules of the test-rules page)
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
});

type Surface = HTMLElement & {
  state: string;
  look: { azimuth: number; pitch: number; fov: number };
  position: { east: number; north: number; up: number };
  sky: { sun: { altitude: number }; earth: { altitude: number } };
  stats: { state: string; draws: number; quality: string; tiles?: { done: number; total: number; first: number }; renderer?: { draws: number; contexts: number; canvas: { width: number; height: number; pixels: number } } };
  time: number;
};

const open = async (page: Page, attributes = "shadows=off detail=off"): Promise<void> => {
  await routeSurface(page);
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  // the demo page's own element is replaced by one with the attributes this test wants, so the test does not depend on the page's choices
  await page.evaluate((text) => {
    document.querySelector("#surface")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("site", "apollo-17");
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    for (const pair of text.split(" ")) {
      const [k, v] = pair.split("=");
      if (k) el.setAttribute(k, v ?? "");
    }
    el.style.cssText = "width: 320px";
    document.querySelector("main")!.prepend(el);
  }, attributes);
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  // the first draw is at the quality of motion and one at the quality of rest follows it a moment after: the view is at rest when the quality has settled and a draw has been made at it
  await expect.poll(() => read(page, (el) => `${el.stats.quality}:${el.stats.renderer?.draws ?? 0}`), { timeout: 120_000, intervals: [300] }).toMatch(/^full:[2-9]/);
};
const view = (page: Page) => page.locator("#test-surface");
const read = <T>(page: Page, fn: (el: Surface) => T): Promise<T> => view(page).evaluate(fn as never) as Promise<T>;
/** The live view's draws so far, as the renderer counts them. */
const draws = (page: Page): Promise<number> => read(page, (el) => el.stats.renderer?.draws ?? 0);
/** Waits until the draws have reached `n` or more. */
const drawnTo = (page: Page, n: number) => expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(n);

test("the tiles are asked for once, the view goes live, draws, and draws nothing at rest", async ({ page }) => {
  await open(page);
  const first = await draws(page);
  expect(first).toBeGreaterThanOrEqual(1);
  // nothing happens for a while: a wait to say that nothing happens, not to wait for something
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(first);
  expect(await read(page, (el) => el.stats.renderer!.contexts)).toBe(1);
  const canvas = await read(page, (el) => el.stats.renderer!.canvas);
  expect(canvas.pixels).toBeLessThanOrEqual(6_000_000);
  expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(4096);
});

test("a drag turns the view and draws; a plus zooms (the field of view narrows); the sky is the real one for the moment", async ({ page }) => {
  await open(page);
  const before = await read(page, (el) => ({ ...el.look, draws: el.stats.renderer!.draws }));
  const box = (await view(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = await read(page, (el) => ({ ...el.look }));
  expect(after.azimuth).not.toBeCloseTo(before.azimuth, 0);
  expect(((before.azimuth - after.azimuth + 540) % 360) - 180, "dragging to the right turns the view to the left of the ground, as a hand does").toBeGreaterThan(0);
  await drawnTo(page, before.draws + 1);
  await view(page).focus();
  await page.keyboard.press("+");
  expect(await read(page, (el) => el.look.fov)).toBeLessThan(after.fov);
  // the landing's sky: the Sun low in the east, the Earth high in the south-west
  const sky = await read(page, (el) => ({ sun: el.sky.sun.altitude, earth: el.sky.earth.altitude }));
  expect(sky.sun).toBeGreaterThan(12);
  expect(sky.sun).toBeLessThan(15);
  expect(sky.earth).toBeGreaterThan(40);
});

test("a held key walks over the ground at a walking pace, and the eyes follow the ground: forward is where the view looks", async ({ page }) => {
  await open(page, "shadows=off detail=off heading=0");
  await view(page).focus();
  const start = await read(page, (el) => ({ ...el.position }));
  await page.keyboard.down("w");
  await expect.poll(() => read(page, (el) => el.position.north), { timeout: 30_000 }).toBeGreaterThan(start.north + 0.5);
  await page.keyboard.up("w");
  const end = await read(page, (el) => ({ ...el.position }));
  expect(Math.abs(end.east - start.east), "north is straight on").toBeLessThan(0.05);
  expect(end.north - start.north).toBeLessThan(10); // a walk of a few seconds, not a bound
  // the key is up: no more steps and no more draws
  await page.waitForTimeout(800); // that nothing happens after the key is up
  const rest = await draws(page);
  await page.waitForTimeout(800);
  expect(await draws(page)).toBe(rest);
});

test("the picture says its detail is made; with detail off it does not, and no rocks are made", async ({ page }) => {
  await open(page, "shadows=off");
  await expect.poll(() => read(page, (el) => (el.shadowRoot!.getElementById("note")!.textContent ?? "").includes("made, not measured"))).toBe(true);
  expect(await read(page, (el) => (el.stats as unknown as { mesh?: { rings: number } }).mesh?.rings ?? 0)).toBeGreaterThan(100);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  await open(page, "shadows=off detail=off");
  const note = await read(page, (el) => el.shadowRoot!.getElementById("note")!.textContent ?? "");
  expect(note).toContain("Heights measured");
  expect(note).not.toContain("made, not measured");
});

test("a site with no heights says so and draws nothing", async ({ page }) => {
  await page.route("**/tiles/moon/apollo-17/**", (route) => route.fulfill({ status: 404, body: "no" }));
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate(() => {
    document.querySelector("#surface")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    document.querySelector("main")!.prepend(el);
  });
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "unavailable", { timeout: 60_000 });
});

test("the first view is enough to stand on: the view is live while the far level is still on its way, and the rest comes in place", async ({ page }) => {
  test.setTimeout(240_000);
  // the far level's tiles are held until the test lets them go
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/tiles/moon/apollo-17/terrain/far/**", async (route) => {
    await held;
    await route.fallback();
  });
  await open(page);
  expect(await view(page).getAttribute("data-loading"), "the far level is not in").toBe("more");
  // the view at rest first (its draws have stopped), so a draw after this is the far level's
  let held4 = "";
  let same = 0;
  await expect
    .poll(async () => {
      const now = String(await draws(page));
      same = now === held4 ? same + 1 : 0;
      held4 = now;
      return same;
    }, { intervals: [400], timeout: 120_000 })
    .toBeGreaterThanOrEqual(3);
  const before = await read(page, (el) => ({ ...el.stats.tiles!, draws: el.stats.renderer!.draws }));
  expect(before.done).toBeLessThan(before.total);
  expect(before.done).toBeGreaterThanOrEqual(before.first);
  release();
  await expect.poll(() => view(page).getAttribute("data-loading"), { timeout: 120_000 }).toBe("done");
  const after = await read(page, (el) => ({ ...el.stats.tiles!, draws: el.stats.renderer!.draws }));
  expect(after.done).toBe(after.total);
  // what came in was drawn: the view drew again after the far tiles landed
  await drawnTo(page, before.draws + 1);
});
