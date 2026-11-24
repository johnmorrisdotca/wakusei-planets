// The asteroids of `/asteroids` in the space view (MODULES-1353): the option `asteroids` places the 103 bodies as points with the belts' (one instanced draw), names the few within about an astronomical unit of the camera, makes
// each an entry of `sight()` and a name that can be pressed (`wakusei-body-click`, `wakusei-asteroid-click`), and costs nothing while it is off. Chromium, drawing in software; the time is held by the page's `t` and every wait is
// on a draw.
import { expect, test, type Page } from "@playwright/test";
import { ASTEROIDS } from "../src/asteroids.ts";
import { callCounted, callOn, drawnAfter, openSpace, quiet, SPACE, setCounted, statsOf } from "./space-ui.ts";
import { underLoad } from "./under-load.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // CPU_THROTTLE=4 runs the whole file at a quarter of the speed (the cost test sets its own rates and measures at 1 and 4)
  await underLoad(page, browserName);
});

/** The moment held: on it four asteroids (Duende, Cruithne, Itokawa, Kamo`oalewa) are within an astronomical unit of the Earth, and so of the camera above it. */
const QUERY = "t=2026-11-02T14:00Z&scale=true&play=off";

interface AsteroidStats {
  placed: number;
  named: number;
  ms: number;
}
const asteroidsOf = async (page: Page): Promise<AsteroidStats> => ((await statsOf(page)) as unknown as { asteroids: AsteroidStats }).asteroids;
const doorPoints = async (page: Page): Promise<number> => ((await statsOf(page)) as unknown as { door: { points: number } }).door.points;
const sightKinds = async (page: Page): Promise<Record<string, number>> => {
  await callOn(page, "sight");
  await expect.poll(async () => ((await callOn(page, "sight")) as unknown[]).length, { timeout: 60_000, message: "the sight is worked out" }).toBeGreaterThan(0);
  const list = (await callOn(page, "sight")) as { id: string; kind: string }[];
  const kinds: Record<string, number> = {};
  for (const entry of list) kinds[entry.kind] = (kinds[entry.kind] ?? 0) + 1;
  return kinds;
};
/** Turn the option on and wait for the records to be loaded and drawn. */
async function turnOn(page: Page): Promise<void> {
  const before = await setCounted(page, "asteroids", true);
  await drawnAfter(page, before, "the option");
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000, message: "the asteroids are placed" }).toBe(ASTEROIDS.length);
  await quiet(page);
}

test("with the option off (the default) nothing is placed, named, in the sight or in the instanced draw, and the records are not loaded", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  await openSpace(page, QUERY);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "asteroids"))).toBe(false);
  expect(await asteroidsOf(page)).toEqual({ placed: 0, named: 0, ms: 0 });
  expect((await sightKinds(page))["small-body"]).toBeUndefined();
  expect(await page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`).count()).toBe(0);
  // not even the chunk with the records was fetched
  expect(asked.filter((url) => /asteroids/.test(url) && url.endsWith(".js")), "no asteroid chunk was asked for").toEqual([]);
});

test("with the option on all 104 are placed with the belts' points, the ones near the camera are named, each is an entry of sight() with kind small-body, and turning it off takes them all away", async ({ page }) => {
  await openSpace(page, QUERY);
  const pointsBefore = await doorPoints(page);
  await turnOn(page);
  const on = await asteroidsOf(page);
  expect(on.placed).toBe(104);
  expect(on.named, "Duende, Cruithne, Itokawa and Kamo`oalewa are within an astronomical unit of the Earth on this date, and at most twelve are named").toBeGreaterThanOrEqual(4);
  expect(on.named).toBeLessThanOrEqual(12);
  expect(await doorPoints(page), "the bodies are drawn in the one instanced draw, with the other points").toBe(pointsBefore + 104);
  expect((await sightKinds(page))["small-body"]).toBe(104);
  // the names are buttons of the view's own, for the ones in front of the camera (one behind it has no place on the screen); Duende, nearest on this date, is one
  await expect(page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`)).toBeVisible();
  const shown = await page.locator(`${SPACE} .sp-label:not([hidden])`).evaluateAll((els, ids) => els.filter((el) => ids.includes((el as HTMLElement).dataset["body"]!)).length, ASTEROIDS.map((one) => `asteroid:${one.id}`));
  expect(shown, "no more names than the named").toBeLessThanOrEqual(on.named);
  expect(shown).toBeGreaterThanOrEqual(1);
  expect(await page.locator(`${SPACE} .sp-label[data-body="asteroid:eros"]`).isVisible(), "Eros is too far to be named").toBe(false);
  // off again
  const before = await setCounted(page, "asteroids", false);
  await drawnAfter(page, before, "the option turned off");
  await quiet(page);
  expect(await asteroidsOf(page)).toEqual({ placed: 0, named: 0, ms: 0 });
  expect((await sightKinds(page))["small-body"]).toBeUndefined();
  expect(await doorPoints(page)).toBe(pointsBefore);
  expect(await page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`).isVisible()).toBe(false);
});

test("a press on an asteroid's name says which it is, in the body event and in the asteroid event, and the camera stays where it is", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  await page.locator(SPACE).evaluate((el) => {
    const log: { type: string; detail: Record<string, unknown> }[] = [];
    (window as unknown as { __heard: typeof log }).__heard = log;
    for (const type of ["wakusei-body-click", "wakusei-asteroid-click", "wakusei-body-select"]) el.addEventListener(type, (event) => log.push({ type, detail: (event as CustomEvent).detail as Record<string, unknown> }));
  });
  const camera = ((await statsOf(page)) as unknown as { camera: { position: number[] } }).camera.position;
  await page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`).dispatchEvent("click");
  const heard = await page.evaluate(() => (window as unknown as { __heard: { type: string; detail: Record<string, unknown> }[] }).__heard);
  expect(heard.map((event) => event.type), "the body event and the asteroid's own, and no selection").toEqual(["wakusei-body-click", "wakusei-asteroid-click"]);
  expect(heard[0]!.detail).toEqual({ id: "duende", name: "Duende", kind: "small-body" });
  expect(heard[1]!.detail).toEqual({ id: "duende", name: "Duende" });
  // a second press goes nowhere either: going to an asteroid is not part of the option
  await page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`).dispatchEvent("click");
  await quiet(page);
  expect(await page.locator(SPACE).evaluate((el) => [Reflect.get(el, "body"), Reflect.get(el, "riding")])).toEqual(["earth", null]);
  const now = ((await statsOf(page)) as unknown as { camera: { position: number[] } }).camera.position;
  for (let i = 0; i < 3; i += 1) expect(now[i]!).toBeCloseTo(camera[i]!, 6);
});

test("two asteroids have the id of a moon (europa, dione): with the option on the moon is still the moon, and the asteroid is a small body beside it", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  const before = await callCounted(page, "goTo", "jupiter", { smooth: false });
  await drawnAfter(page, before, "the move to Jupiter");
  await quiet(page);
  await expect.poll(async () => (((await callOn(page, "sight")) as { id: string; kind: string }[]).filter((one) => one.id === "europa").length), { timeout: 60_000, message: "Europa is in the sight" }).toBe(2);
  const kinds = ((await callOn(page, "sight")) as { id: string; kind: string }[]).filter((one) => one.id === "europa" || one.id === "dione").map((one) => `${one.id}:${one.kind}`).sort();
  expect(kinds, "the moon keeps its kind and the asteroid is a small body, each once").toEqual(["dione:small-body", "europa:moon", "europa:small-body"]);
  expect(await page.locator(SPACE).evaluate((el) => (Reflect.get(el, "bodyInfo") as (id: string) => { name: string; kind: string }).call(el, "europa"))).toMatchObject({ name: "Europa", kind: "moon" });
});

test("the names are in the page's language, and the option reads its attribute", async ({ page }) => {
  await openSpace(page, QUERY);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await page.locator(SPACE).evaluate((el) => el.setAttribute("asteroids", ""));
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000 }).toBe(ASTEROIDS.length);
  await quiet(page);
  const ja = ASTEROIDS.find((one) => one.id === "duende")!.name.ja;
  await expect(page.locator(`${SPACE} .sp-label[data-body="asteroid:duende"]`)).toContainText(ja);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("asteroids", "off"));
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000 }).toBe(0);
});

/** What `steps` draws cost: for each, the draw calls the graphics card was given and the milliseconds from the change of the time to the picture finished (the page waits for the graphics card at the end of each), and the GPU objects alive at the end. All in one call, the time stepped by the test, so nothing but the steps is drawn. */
interface Cost {
  calls: number[];
  frameMs: number[];
  objects: number;
  placeMs: number[];
}
async function costOf(page: Page, steps: number, from: number): Promise<Cost> {
  return page.evaluate(
    async ([n, base]) => {
      const counts = (window as unknown as { __kazokuCount: { draws: number; created: Record<string, number>; deleted: Record<string, number> } }).__kazokuCount;
      const el = document.querySelector("wakusei-space")!;
      const stats = () => Reflect.get(el, "stats") as { draws: number; asteroids: { ms: number } };
      const canvases: HTMLCanvasElement[] = [];
      const walk = (root: ParentNode) => {
        canvases.push(...root.querySelectorAll("canvas"));
        for (const one of root.querySelectorAll("*")) if (one.shadowRoot) walk(one.shadowRoot);
      };
      walk(document);
      const finish = () => {
        for (const canvas of canvases) {
          const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGL2RenderingContext | null;
          gl?.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
        }
      };
      const calls: number[] = [];
      const frameMs: number[] = [];
      const placeMs: number[] = [];
      for (let i = 0; i < n; i += 1) {
        const drawsBefore = stats().draws;
        const glBefore = counts.draws;
        const began = performance.now();
        Reflect.set(el, "time", base + (i + 1) * 3_600_000);
        while (stats().draws === drawsBefore) await new Promise((resolve) => requestAnimationFrame(resolve));
        finish();
        frameMs.push(performance.now() - began);
        // the next frame cannot have started: it is asked for by a change, and the only change is the next step's
        calls.push(counts.draws - glBefore);
        placeMs.push(stats().asteroids.ms);
      }
      const alive = Object.keys(counts.created).reduce((sum, kind) => sum + counts.created[kind]! - counts.deleted[kind]!, 0);
      return { calls, frameMs, objects: alive, placeMs };
    },
    [steps, from] as const,
  );
}
const percentile = (values: number[], share: number): number => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * share))]!;
const T0 = Date.UTC(2026, 10, 2, 14);

test("with the option off, or turned on and off again, a draw costs the graphics card no more calls and no more objects than before, and what it costs on is measured", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await openSpace(page, QUERY);
  const report: string[] = [];
  // a view that has never had the option: the figures the others are held to
  const never = await costOf(page, 24, T0);
  expect(never.objects).toBeGreaterThan(0);
  for (const rate of [1, 4]) {
    const session = await page.context().newCDPSession(page);
    await session.send("Emulation.setCPUThrottlingRate", { rate });
    // a warm-up that touches everything the measured part can: the option on (the chunk, the points), a few draws, then off
    if (rate === 1) {
      await turnOn(page);
      await costOf(page, 3, T0);
      const before = await setCounted(page, "asteroids", false);
      await drawnAfter(page, before, "the warm-up turned off");
      await quiet(page);
    }
    const off = await costOf(page, 24, T0);
    const before = await setCounted(page, "asteroids", true);
    await drawnAfter(page, before, "the option");
    await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000, message: "the asteroids are placed" }).toBe(ASTEROIDS.length);
    await quiet(page);
    const on = await costOf(page, 24, T0);
    const gone = await setCounted(page, "asteroids", false);
    await drawnAfter(page, gone, "the option turned off");
    await quiet(page);
    const again = await costOf(page, 24, T0);
    await session.detach();
    const line = (name: string, c: Cost) => `${name}: ${percentile(c.calls, 0.5)} draw calls a frame, ${c.objects} GPU objects, frame p50 ${percentile(c.frameMs, 0.5).toFixed(1)} ms, p95 ${percentile(c.frameMs, 0.95).toFixed(1)} ms, placing p50 ${percentile(c.placeMs, 0.5).toFixed(2)} ms p95 ${percentile(c.placeMs, 0.95).toFixed(2)} ms`;
    report.push(`throttle ${rate}: off ${line("", off)} | on ${line("", on)} | off again ${line("", again)}`);
    // the same moments in the same order draw the same calls (what a frame draws is worked out from the time alone), whatever the machine
    expect(off.calls, `off draws the same calls frame for frame as a view that never had the option (throttle ${rate})`).toEqual(never.calls);
    expect(again.calls, `turned off again draws the same calls frame for frame as before it was turned on (throttle ${rate})`).toEqual(off.calls);
    expect(off.objects, `off holds as many GPU objects as a view that never had the option (throttle ${rate})`).toBe(never.objects);
    expect(again.objects, `and holds no more GPU objects (throttle ${rate})`).toBe(off.objects);
    on.calls.forEach((calls, k) => expect(calls - off.calls[k]!, `frame ${k}: the bodies join the belts' instanced draws, at most one call more`).toBeLessThanOrEqual(1));
    expect(percentile(on.placeMs, 0.5), "the median cost of placing them is a few milliseconds").toBeLessThan(8);
  }
  console.log(report.join("\n"));
  testInfo.annotations.push({ type: "cost", description: report.join(" ## ") });
  // at rest: no draw is made while nothing changes
  await quiet(page);
  const held = (await statsOf(page)).draws;
  await expect.poll(async () => (await statsOf(page)).draws, { timeout: 2_000, intervals: [500], message: "no draw at rest" }).toBe(held);
});
