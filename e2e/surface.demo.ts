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
  stats: { state: string; draws: number; quality: string; scale: number; scaled: number; tiles?: { done: number; total: number; first: number }; renderer?: { draws: number; contexts: number; canvas: { width: number; height: number; pixels: number } } };
  time: number;
};

const open = async (page: Page, attributes = "shadows=off detail=off", routed = false): Promise<void> => {
  if (!routed) await routeSurface(page);
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
  // at rest: the draws have stopped (the first, at the quality of motion, and the one a moment after it at the quality of rest, which a machine that is slow steps down), the same on three reads
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await read(page, (el) => `${el.stats.quality}:${el.stats.renderer?.draws ?? 0}`);
        same = now === held && !now.endsWith(":0") ? same + 1 : 0;
        held = now;
        return same;
      },
      { timeout: 180_000, intervals: [400] },
    )
    .toBeGreaterThanOrEqual(3);
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
  // (the later route is asked first; it lets the request through to the made-up site's own when released)
  await routeSurface(page);
  await page.route("**/tiles/moon/apollo-17/terrain/far/**", async (route) => {
    await held;
    await route.fallback();
  });
  await open(page, "shadows=off detail=off", true);
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

test("the walking stick walks and does not look: a press on it pushes the eyes forward, the view does not turn, and letting go stops the walk", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "shadows=off detail=off heading=0 stick=on");
  const stick = (await page.locator("#test-surface").evaluate((el) => {
    const box = el.shadowRoot!.getElementById("stick")!.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, r: box.width / 2 };
  }));
  const start = await read(page, (el) => ({ ...el.position, azimuth: el.look.azimuth }));
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  await page.mouse.move(stick.x, stick.y - stick.r * 0.8, { steps: 3 }); // up on the stick is forward
  await expect.poll(() => read(page, (el) => el.position.north), { timeout: 60_000 }).toBeGreaterThan(start.north + 0.3);
  await page.mouse.up();
  const end = await read(page, (el) => ({ ...el.position, azimuth: el.look.azimuth }));
  expect(end.azimuth, "the finger on the stick does not look").toBe(start.azimuth);
  expect(Math.abs(end.east - start.east), "straight ahead").toBeLessThan(0.05);
  // the stick is up: no more steps (that nothing happens after it is let go)
  await page.waitForTimeout(800);
  const rest = await read(page, (el) => el.position.north);
  await page.waitForTimeout(800);
  expect(await read(page, (el) => el.position.north)).toBe(rest);
});

test("a machine that is slow draws the ground smaller while it moves and at full size at rest; a scale asked for is kept", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "shadows=off detail=off scale=0.5");
  expect(await read(page, (el) => el.stats.scale), "a scale asked for is every draw's").toBe(0.5);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  await open(page, "shadows=off detail=off");
  // moved a few times, then at rest: the moving draws are timed, software drawing is slow, so the moving size is a half and the size at rest stays whole
  for (let i = 0; i < 4; i += 1) {
    const before = await draws(page);
    await view(page).evaluate((el) => void ((el as Surface).look = { ...(el as Surface).look, azimuth: (el as Surface).look.azimuth + 15 }));
    await drawnTo(page, before + 1);
  }
  expect(await read(page, (el) => el.stats.scaled), "some of the moving draws were at a half").toBeGreaterThanOrEqual(1);
  await expect.poll(() => read(page, (el) => el.stats.scale), { timeout: 120_000, intervals: [400] }).toBe(1);
});
