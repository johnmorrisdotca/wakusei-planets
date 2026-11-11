// The demo must never ask a lot of the machine. Played in headless Chromium (drawing WebGL in software, never on the graphics card), these fail on a draw loop that runs when nothing
// moves or more than once a frame, on WebGL contexts or graphics memory (buffers, vertex arrays, textures, programs) that grow with each change, on a canvas past its pixel budget on a
// 5K screen, on a frame drawn out of sight, and on a moving picture drawn faster than thirty times a second.
import { COUNT_SCRIPT, canvasSize, gpuObjects, readCounts, withinPixelBudget } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";
import { addRocks } from "./door-fixture.ts";
import { routeTiles } from "./tiles-fixture.ts";
import { drawn } from "./space-ui.ts";

const URL = "/wakusei-planets/";
const main = (page: Page) => page.locator("#main");
const live = (page: Page) => expect(main(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
const settle = (page: Page, ms: number) => page.waitForTimeout(ms);
/** The counters once the graphics objects alive have stopped changing: the same number on four reads a quarter of a second apart. The page lets go of what it holds after it has been idle a while, so a baseline and the count after a run of changes are both read once that has happened, not after a fixed wait that a slow machine may not have finished. */
const settledCounts = async (page: Page) => {
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        // the graphics objects and the live contexts both: a context the renderer lets go of after its second of grace is part of settling, not something to race
        const counts = await readCounts(page);
        const now = `${gpuObjects(counts)}:${counts.contexts}`;
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [250], timeout: 60_000, message: "the graphics objects alive never stopped changing" },
    )
    .toBeGreaterThanOrEqual(3);
  return readCounts(page);
};
/** The counters after rounds of changes, once a round leaves no more objects alive than the one before: what the page keeps (pictures, programs, the first sight of each body) is all made, however slowly the machine gets there. Leaking never settles, and fails here. */
const converged = async (page: Page, round: () => Promise<void>) => {
  let before = Infinity;
  for (let i = 0; i < 8; i += 1) {
    await round();
    const counts = await settledCounts(page);
    if (gpuObjects(counts) <= before) return counts;
    before = gpuObjects(counts);
  }
  throw new Error("the graphics objects alive were still growing after eight rounds");
};
/** Jobs the shared renderer has drawn so far, as its own scheduler counts them. Since kazoku-ui 0.27 it asks for an animation frame every refresh and draws at most 30 a second, so `rafRequests` is no longer the number drawn. */
const jobsDrawn = (page: Page): Promise<number> =>
  page.evaluate(() => {
    for (const el of document.querySelectorAll("wakusei-body")) {
      const drawn = (Reflect.get(el, "stats") as { renderer?: { frames?: { draws?: number } } } | undefined)?.renderer?.frames?.draws;
      if (typeof drawn === "number") return drawn;
    }
    return 0;
  });
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
  const jobsBefore = await jobsDrawn(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  const draws = after.draws - before.draws;
  expect(draws).toBeGreaterThan(0);
  // a draw may be several GL calls (the planet, its rings, a glow): count the frames the renderer drew, not calls
  expect((await jobsDrawn(page)) - jobsBefore).toBeLessThanOrEqual(4 * 31);
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
  const first = await settledCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
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

/** Ctrl and the wheel, as an event on the element: the body's own hands take it, up to its ceiling and down to its floor. */
const ctrlWheel = (page: Page, selector: string, deltaY: number, times: number) =>
  page.locator(selector).evaluate(
    (el, [dy, n]) => {
      const box = el.getBoundingClientRect();
      for (let i = 0; i < (n as number); i += 1) el.dispatchEvent(new WheelEvent("wheel", { deltaY: dy as number, ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true, composed: true }));
    },
    [deltaY, times],
  );

test("zooming a painted body from a tenth to 8x and back with the hands gives back what it took, draws nothing at rest and keeps the canvas in budget", async ({ page }) => {
  await page.goto(`${URL}?body=mars&look=painted`);
  await main(page).hover();
  await live(page);
  const round = async () => {
    for (const [dy, times] of [[-2000, 30], [2000, 60], [-2000, 12], [2000, 12]] as const) {
      await ctrlWheel(page, "#main", dy, times);
      await settle(page, 700);
    }
    await page.locator("#main").focus();
    await page.keyboard.press("0");
    await settle(page, 400);
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
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
  const first = await settledCounts(page);
  for (let i = 0; i < 2; i += 1) await round();
  await settle(page, 3000);
  const last = await settledCounts(page);
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
  // at rest at most one frame is still asked for; on a loaded runner the software GPU can hold the last frames of the drag for a moment (CI run 42775802160 saw 2 just after the 500 ms settle), so wait for it rather than read it once
  await expect
    .poll(async () => {
      const now = await readCounts(page);
      return now.rafRequests - now.rafCallbacks;
    }, { timeout: 10_000, message: "frames still asked for at rest" })
    .toBeLessThanOrEqual(1);
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

test("zooming the space view from a millionth to its surface and back leaves contexts and graphics memory flat and draws nothing at rest", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&look=painted`);
  await liveSky(page);
  await expect.poll(async () => (await skyStats(page)).bodies.painted, { timeout: 60_000 }).toBe(11);
  const round = async () => {
    for (const [dy, times] of [[3000, 60], [-3000, 80], [3000, 20], [-1500, 20]] as const) {
      await ctrlWheel(page, "wakusei-space", dy, times);
      await settle(page, 900);
    }
    await page.locator("wakusei-space").focus();
    await page.keyboard.press("0");
    await settle(page, 500);
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 2; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 6);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
});

test("the space view at a day a second: at most thirty frames a second, one frame at a time, a lookup about once a second, and nothing out of sight", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&play=on&speed=86400`);
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
    for (const [group, name] of [["Scale", "True"], ["Look", "Painted"], ["Light", "Always lit"], ["Scale", "Compressed"], ["Look", "Realistic"], ["Light", "The Sun's"]] as const) {
      await page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await settle(page, 500);
      // the painted pictures arrive over the network: a round is not over until they have, so that a slow machine takes the same steps as a fast one before the baseline
      if (name === "Painted") await expect.poll(async () => (await skyStats(page)).bodies.painted, { timeout: 60_000 }).toBe(11);
    }
    await page.locator("#orbits").dispatchEvent("click");
    await page.locator("#orbits").dispatchEvent("click");
    for (const name of ["The Moon", "Mars", "Io, over Jupiter", "Off"]) {
      await page.getByRole("group", { name: "Ride along" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await settle(page, 700);
    }
    await settle(page, 500);
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
  await sky(page).evaluate((el) => el.remove());
  await settle(page, 3500);
  const gone = await readCounts(page);
  for (const kind of ["Buffer", "VertexArray", "Program"] as const) expect(gone.created[kind] - gone.deleted[kind], `${kind} left`).toBe(0);
  expect(gpuObjects(gone)).toBeLessThanOrEqual(8);
});

test("every other known moon as dots: one draw, nothing drawn at rest, and turning them off and on gives back what they took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&goto=jupiter-moons&moons=all`);
  await liveSky(page);
  const dots = () => sky(page).evaluate((el) => (el as unknown as { stats: { allMoons: { on: boolean; loaded: boolean; dots: number } } }).stats.allMoons);
  // the catalogue arrives as a chunk of its own: the page reports how many dots its last draw drew
  await expect.poll(async () => (await dots()).dots, { timeout: 60_000 }).toBeGreaterThan(400);
  const before = await settledCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts).toBe(1);
  expect(after.draws - before.draws).toBe(0);
  const round = async () => {
    await page.locator("#all-moons").dispatchEvent("click");
    await expect.poll(async () => (await dots()).dots, { timeout: 30_000 }).toBe(0);
    await page.locator("#all-moons").dispatchEvent("click");
    await expect.poll(async () => (await dots()).dots, { timeout: 30_000 }).toBeGreaterThan(400);
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 2);
});

/** The "Name on the body" row's choices, one after another: every look, how many, where, facing and off, so each texture is drawn again and the old one let go. Each waits on the draw it causes. */
const labelRound = async (page: Page): Promise<void> => {
  const press = (group: string, name: string): Promise<void> => drawn(page, () => page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click"));
  for (const name of ["Etched", "Outline", "Burned in", "Painted"]) await press("Name on the body", name);
  for (const name of ["Both sides", "All round", "Once"]) await press("How many", name);
  for (const name of ["North", "South", "Equator"]) await press("Where", name);
  for (const name of ["Full", "Half"]) await press("Strength", name);
  await drawn(page, () => page.locator("#body-label-facing").dispatchEvent("click"));
  await drawn(page, () => page.locator("#body-label-facing").dispatchEvent("click"));
  await press("Name on the body", "Off");
  await press("Name on the body", "Painted");
};

test("a body with its name on it draws nothing at rest, and every change of the name gives back what it took", async ({ page }) => {
  await page.goto(`${URL}?body=mars&bl=painted`);
  await main(page).hover();
  await live(page);
  const label = () => main(page).evaluate((el) => (Reflect.get(el, "stats") as { label: { shown: boolean } | null }).label?.shown ?? false);
  await expect.poll(label, { timeout: 60_000 }).toBe(true);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the name on").toBe(0);
  const first = await converged(page, () => labelRound(page));
  for (let i = 0; i < 3; i += 1) await labelRound(page);
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
});

test("the space view with names on the bodies draws nothing at rest, and every change of the name, and a move to another body, gives back what it took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&bl=painted`);
  await liveSky(page);
  const focusShown = async () => ((await skyStats(page)) as unknown as { bodyLabels: { focus: { shown: boolean } | null } }).bodyLabels.focus?.shown ?? false;
  await expect.poll(focusShown, { timeout: 60_000 }).toBe(true);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the names on").toBe(0);
  const round = async () => {
    await labelRound(page);
    for (const place of ["Moon", "Jupiter and its moons", "Earth"]) {
      await goTo(page, place);
      await settle(page, 500);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
});

test("riding along draws at most thirty frames a second at a day a second, nothing at rest, and nothing out of sight", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&play=on&speed=86400&ride=mars`);
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

// --- a star drawn from numbers: the same renderer, the same rules ------------------------------------------------------------------------------------------------------------------------------
const STAR = "/wakusei-planets/star.html";
const star = (page: Page) => page.locator("#star");
const starLive = (page: Page) => expect(star(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
const presets = ["sun", "sirius-a", "vega", "betelgeuse", "rigel", "proxima", "altair", "white-dwarf"];

test("a star at rest draws nothing, with one WebGL context and one canvas", async ({ page }) => {
  await page.goto(`${STAR}?star=proxima`);
  await star(page).hover();
  await starLive(page);
  await settle(page, 2000);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts).toBeLessThanOrEqual(1);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
});

test("a turning star, with its prominences and its boiling surface, is drawn at most thirty times a second, one frame at a time", async ({ page }) => {
  await page.goto(`${STAR}?star=proxima&spin=1`);
  await star(page).hover();
  await starLive(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  const jobsBefore = await jobsDrawn(page);
  await settle(page, 4000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBeGreaterThan(0);
  expect((await jobsDrawn(page)) - jobsBefore).toBeLessThanOrEqual(4 * 31);
  expect(after.rafRequests - after.rafCallbacks).toBeLessThanOrEqual(1);
  expect(after.contexts).toBeLessThanOrEqual(1);
});

test("a star still turns for a reader who prefers reduced motion, at a quarter of the rate", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${STAR}?star=proxima&spin=1`);
  await star(page).hover();
  await starLive(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  const jobsBefore = await jobsDrawn(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "a reduced turn is still drawn").toBeGreaterThan(0);
  expect((await jobsDrawn(page)) - jobsBefore).toBeLessThanOrEqual(4 * 31);
  await context.close();
});

test("choosing star after star gives back what each took: contexts, buffers, vertex arrays, textures and programs do not grow", async ({ page }) => {
  await page.goto(`${STAR}?star=sun`);
  await star(page).hover();
  await starLive(page);
  const round = async () => {
    for (const id of presets) {
      await page.locator(`#presets [data-preset="${id}"]`).click();
      await star(page).hover();
      await starLive(page);
      await settle(page, 400);
    }
    await page.locator('#looks [data-look="line"]').click();
    await settle(page, 300);
    await page.locator('#looks [data-look="realistic"]').click();
    await star(page).hover();
    await starLive(page);
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(await page.evaluate(() => document.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
});

test("the star's canvas stays within 6 million pixels and 4096 a side on a 5K screen at a pixel ratio of 2", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 5120, height: 2880 }, deviceScaleFactor: 2, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`${STAR}?star=betelgeuse`);
  await star(page).hover();
  await starLive(page);
  await settle(page, 800);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  await context.close();
});

test("a star out of sight draws nothing, even while it is told to keep turning", async ({ page }) => {
  await page.goto(`${STAR}?star=proxima&spin=1`);
  await star(page).hover();
  await starLive(page);
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "6000px";
    document.body.append(spacer);
    window.scrollTo(0, 5000);
  });
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(1);
});

test("the cheaper star for weak devices is drawn the same way and says so", async ({ page }) => {
  await page.goto(`${STAR}?star=proxima&spin=1`);
  await star(page).evaluate((el) => el.setAttribute("quality", "low"));
  await star(page).hover();
  await starLive(page);
  expect(await star(page).evaluate((el) => (el as unknown as { starLook: { quality: string } }).starLook.quality)).toBe("low");
  await settle(page, 1500);
  const before = await readCounts(page);
  const jobsBefore = await jobsDrawn(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBeGreaterThan(0);
  expect((await jobsDrawn(page)) - jobsBefore).toBeLessThanOrEqual(4 * 31);
});


// --- the finer map tiles in the portrait and the space view: zooming to them and back gives back what it took, and draws and fetches nothing at rest -------------------------------------------------------
const EMBED = "/wakusei-planets/embed.html";
type TileStats = { requested: number; loading: number; failed: number; shown: number | null };

test("the portrait zoomed in to its map tiles and out again: one context, graphics memory flat, nothing drawn or fetched at rest, the canvas in budget", async ({ page }) => {
  const log = await routeTiles(page);
  await page.goto(`${EMBED}?scene=${encodeURIComponent("look:painted~earth_0_0_0.6_0")}`);
  await expect(page.locator("#view")).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const stats = (): Promise<TileStats | undefined> => page.locator("#view").evaluate((el) => (el as unknown as { stats: { tiles: TileStats | undefined } }).stats.tiles);
  // a zoom is measured against the picture at Fit, whatever the view has done since
  const fit = await page.locator("#view").evaluate((el) => (el as unknown as { metrics: { scale: number; placed: { r: number }[] } }).metrics);
  const zoomFor = async (pixelsPerRadian: number): Promise<number> => pixelsPerRadian / (fit.scale * fit.placed[0]!.r);
  const zoomTo = async (zoom: number): Promise<void> => void (await page.locator("kazoku-view-controls").evaluate((el, z) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ zoom: z }, true, "set"), zoom));
  const round = async (): Promise<void> => {
    await zoomTo(await zoomFor(1500));
    await expect.poll(async () => (await stats())?.shown, { timeout: 60_000 }).toBe(2);
    await zoomTo(await zoomFor(3200));
    await expect.poll(async () => (await stats())?.shown, { timeout: 60_000 }).toBe(3);
    await zoomTo(1);
    await expect.poll(async () => (await stats())?.shown, { timeout: 30_000 }).toBeNull();
  };
  await round();
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  expect(await page.locator("#view").evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBeLessThanOrEqual(1);
  const asked = log.tiles.length;
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBeLessThanOrEqual(1);
  expect(log.tiles.length, "nothing is fetched at rest").toBe(asked);
  expect(log.manifests, "the tile set is read once").toBe(1);
});

test("the space view zoomed in to its map tiles and out again: one context, graphics memory flat, nothing drawn or fetched at rest, the canvas in budget", async ({ page }) => {
  const log = await routeTiles(page);
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&look=painted`);
  await liveSky(page);
  await expect.poll(async () => (await skyStats(page)).bodies.painted, { timeout: 60_000 }).toBe(11);
  const stats = (): Promise<TileStats> => sky(page).evaluate((el) => (el as unknown as { stats: { tiles: TileStats } }).stats.tiles);
  const go = (body: string, zoom: number): Promise<void> =>
    sky(page).evaluate(
      (el, [id, z]) => {
        const s = el as unknown as { body: string; setView(v: unknown): void };
        s.body = id as string;
        s.setView({ yaw: 0, tilt: 0, zoom: z });
      },
      [body, zoom],
    );
  const round = async (): Promise<void> => {
    for (const body of ["earth", "mars", "moon"]) {
      await go(body, 3.6);
      await expect.poll(async () => (await stats()).shown, { timeout: 90_000 }).toBe(3);
      await go(body, 1);
      await expect.poll(async () => (await stats()).shown, { timeout: 30_000 }).toBeNull();
    }
  };
  await round();
  await settle(page, 2500);
  const first = await settledCounts(page);
  for (let i = 0; i < 2; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 6);
  expect(withinPixelBudget(await canvasSize(page))).toBe(true);
  expect(await sky(page).evaluate((el) => el.shadowRoot!.querySelectorAll("canvas").length)).toBe(1);
  const asked = log.tiles.length;
  const before = await readCounts(page);
  await settle(page, 2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(log.tiles.length, "nothing is fetched at rest").toBe(asked);
  expect(log.manifests, "the tile set is read once").toBe(1);
});

// --- the data door: a source added to the space view costs nothing at rest and keeps to thirty frames a second --------------------------------------------------------------------------
test("the space view with a source of 20,000 small bodies: nothing is drawn at rest, nothing is requested, and the records are read once", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&scale=compressed`);
  await liveSky(page);
  await addRocks(page, "wakusei-space", 20_000);
  await expect.poll(async () => sky(page).evaluate((el) => (el as unknown as { stats: { door: { points: number } } }).stats.door.points), { timeout: 60_000 }).toBe(20_000);
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws).toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await page.evaluate(() => (Reflect.get(window, "__rocks") as { count: number }).count), "the records were read once").toBe(1);
});

test("the space view at a day a second with a source of 20,000 small bodies: at most thirty frames a second, and the records are not read again", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&play=on&speed=86400&scale=compressed`);
  await liveSky(page);
  await addRocks(page, "wakusei-space", 20_000);
  await expect.poll(async () => sky(page).evaluate((el) => (el as unknown as { stats: { door: { points: number } } }).stats.door.points), { timeout: 60_000 }).toBe(20_000);
  await settle(page, 1500);
  const s0 = await skyStats(page);
  await settle(page, 4000);
  const s1 = await skyStats(page);
  expect(s1.draws - s0.draws).toBeGreaterThan(0);
  expect(s1.draws - s0.draws).toBeLessThanOrEqual(4 * 31);
  expect(await page.evaluate(() => (Reflect.get(window, "__rocks") as { count: number }).count)).toBe(1);
});
