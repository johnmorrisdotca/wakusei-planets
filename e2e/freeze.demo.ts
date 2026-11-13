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
  // a body is remade, and the one before it let go, only by a draw made with it: after each change wait for that draw, not a clock. With a 400 ms wait a busy machine (load 30 to 50,
  // a CI image slot) went from pick to pick with no draw between, and the bodies passed over were still held when the count was taken: 37 against 30 (MODULES-1172)
  const drawnAfter = async (act: () => Promise<unknown>) => {
    const before = await jobsDrawn(page);
    await act();
    await expect.poll(() => jobsDrawn(page), { timeout: 60_000, message: "a draw after the change" }).toBeGreaterThan(before);
  };
  const round = async () => {
    for (const id of ["saturn", "mars", "earth", "moon", "earth", "neptune", "sun", "mercury", "jupiter"]) {
      await drawnAfter(async () => {
        await pick(page, id);
        await main(page).hover();
        await live(page);
      });
    }
    // the Moons switch, shown for a body that has moons: a press redraws, so wait for that draw too. Dispatched: a real click scrolls the page to the button, and a body scrolled out of
    // sight is (rightly) not drawn
    if (await page.locator("#moons").isVisible()) await drawnAfter(() => page.locator("#moons").dispatchEvent("click"));
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
/** Wait for the view to be at rest, by what the page reports: the move it is making has ended (the camera no longer glides, nothing is travelling) and it has let go of the moons that left the picture (it keeps one four seconds after it was last in sight). A move takes 1.2 to 9 seconds, so a count read before this is of a view part way, with moons still held. */
const atRest = async (page: Page): Promise<void> => {
  type Reading = { ride: { gliding: boolean }; travelling: unknown; bodies: { moons: number; held: number } };
  const reading = () => skyStats(page) as unknown as Promise<Reading>;
  await expect.poll(async () => (await reading()).ride.gliding, { timeout: 90_000, message: "the camera never stopped gliding" }).toBe(false);
  await expect.poll(async () => (await reading()).travelling, { timeout: 30_000, message: "the travel never ended" }).toBeNull();
  await expect.poll(async () => { const { bodies } = await reading(); return bodies.held - bodies.moons; }, { timeout: 30_000, message: "moons out of sight were never let go" }).toBe(0);
};
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

test("pointing at bodies across the space view at rest lights their systems and draws nothing", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z`);
  await liveSky(page);
  await drawn(page, () =>
    sky(page).evaluate((el) => {
      const space = el as unknown as { setView(v: unknown): void; zoomFor(p: string): number };
      space.setView({ yaw: 0, tilt: 0, zoom: space.zoomFor("solar-system") });
    }),
  );
  /** The draws once they hold: two reads 300 ms apart the same. */
  const held = async (): Promise<number> => {
    let last = -1;
    await expect
      .poll(
        async () => {
          const now = (await readCounts(page)).draws;
          const same = now === last;
          last = now;
          return same;
        },
        { timeout: 30_000, intervals: [300] },
      )
      .toBe(true);
    return last;
  };
  const box = (await sky(page).boundingBox())!;
  const places = await sky(page).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): { x: number; y: number } | null; bodyList(): { id: string }[] };
    return space.bodyList().map(({ id }) => space.placeOf(id)).filter((at): at is { x: number; y: number } => at !== null && at.x > 0 && at.y > 0 && at.x < el.clientWidth && at.y < el.clientHeight);
  });
  expect(places.length).toBeGreaterThan(3);
  await sky(page).evaluate((el) => {
    Reflect.set(window, "__hovers", 0);
    el.addEventListener("wakusei-body-hover", () => Reflect.set(window, "__hovers", (Reflect.get(window, "__hovers") as number) + 1));
  });
  const before = await held();
  for (const at of places.slice(0, 12)) await page.mouse.move(box.x + at.x, box.y + at.y, { steps: 4 });
  await page.mouse.move(box.x + 4, box.y + box.height - 4, { steps: 4 });
  expect(await held()).toBe(before);
  expect(await page.evaluate(() => Reflect.get(window, "__hovers"))).toBeGreaterThan(0);
  expect((await readCounts(page)).contexts).toBe(1);
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
    // a ride starts the demo's clock (Play) and Off leaves it running, so the view keeps drawing and the moons come and go with the time: a count read then is of a different moment each round (183 against a limit of 182 on a
    // busy machine, MODULES-1187). Hold the clock, as a reader would, so that the round ends at rest and the count means something
    const play = page.locator('#replay [data-act="play"]');
    if ((await play.getAttribute("aria-pressed")) === "true") await play.dispatchEvent("click");
    await settle(page, 500);
    // the last move (the ride off) may take seconds, and the moons it leaves are let go some seconds after: a count is read at rest, not part way
    await atRest(page);
    // and with the clock held it draws nothing: thirty of its own frames and none drawn
    await expect
      .poll(
        async () => {
          const before = (await skyStats(page)).draws;
          await page.evaluate(async () => {
            for (let frame = 0; frame < 30; frame += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
          });
          return (await skyStats(page)).draws - before;
        },
        { timeout: 60_000, message: "the view was still drawing with the clock held" },
      )
      .toBe(0);
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

test("the space view with Starman shown draws nothing at rest, and switching the car on and off gives back what it took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&starman=1&goto=solar-system`);
  await liveSky(page);
  const drawnCar = async () => ((await skyStats(page)) as unknown as { roadster: { shown: boolean } }).roadster.shown;
  await expect.poll(drawnCar, { timeout: 60_000 }).toBe(true);
  // the move to the address's view takes seconds: nothing is drawn at rest once it has ended
  await atRest(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the car shown").toBe(0);
  const round = async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.locator("#starman").dispatchEvent("click");
      await expect.poll(drawnCar, { timeout: 30_000 }).toBe(false);
      await page.locator("#starman").dispatchEvent("click");
      await expect.poll(drawnCar, { timeout: 30_000 }).toBe(true);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
});

test("the space view with every deep-space craft draws nothing at rest, and switching them gives back what they took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-12T12:00:00Z&craft=all`);
  await liveSky(page);
  const drawnCraft = async () => ((await skyStats(page)) as unknown as { spacecraft: { count: number } }).spacecraft.count;
  await expect.poll(drawnCraft, { timeout: 60_000 }).toBeGreaterThan(0);
  await atRest(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the deep-space craft").toBe(0);
  const round = async () => {
    for (let i = 0; i < 2; i += 1) {
      await page.locator("#craft").dispatchEvent("click");
      await expect.poll(drawnCraft, { timeout: 30_000 }).toBe(0);
      await page.locator("#craft").dispatchEvent("click");
      await expect.poll(drawnCraft, { timeout: 60_000 }).toBeGreaterThan(0);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 2; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
});

test("the space view with the orbiters shown draws nothing at rest, and switching them on and off gives back what it took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&orbiters=1`);
  await liveSky(page);
  const drawnOrbiters = async () => ((await skyStats(page)) as unknown as { orbiters: { count: number } }).orbiters.count;
  // the craft are drawn once the Moon is big on the screen: go to the Moon itself (the Go to row's Moon is the Earth and the Moon's orbit, where it is a few pixels across), and wait for the view to be at rest before counting
  await sky(page).evaluate((el) => (el as unknown as { goTo(body: string, options: { smooth: boolean }): void }).goTo("moon", { smooth: false }));
  await expect.poll(drawnOrbiters, { timeout: 90_000 }).toBeGreaterThan(0);
  await atRest(page);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the orbiters shown").toBe(0);
  expect(after.rafRequests - before.rafRequests, "no frame asked for at rest with the orbiters shown").toBe(0);
  const round = async () => {
    for (let i = 0; i < 3; i += 1) {
      await page.locator("#orbiters").dispatchEvent("click");
      await expect.poll(drawnOrbiters, { timeout: 30_000 }).toBe(0);
      await page.locator("#orbiters").dispatchEvent("click");
      await expect.poll(drawnOrbiters, { timeout: 30_000 }).toBeGreaterThan(0);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await atRest(page);
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  // and still nothing drawn at rest after the rounds
  const again = await readCounts(page);
  await settle(page, 3000);
  expect((await readCounts(page)).draws - again.draws, "nothing drawn at rest after the rounds").toBe(0);
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

test("the orbiters round Mars with a craft picked, its line and its ground track draw nothing at rest, and switching them gives back what it took", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-12T12:00Z&orbiters=1&orbiter=mro&otrack=1`);
  await liveSky(page);
  await sky(page).evaluate((el) => (el as unknown as { goTo(id: string, options: { smooth: boolean }): void }).goTo("mars", { smooth: false }));
  const track = async () => ((await skyStats(page)) as unknown as { orbiters: { track: number } }).orbiters.track;
  await expect.poll(track, { timeout: 60_000 }).toBeGreaterThan(100);
  await settle(page, 1500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest with the orbiters, a line and a track").toBe(0);
  const round = async () => {
    for (const button of ['#orbiter-lines [data-olines="chosen"]', '#orbiter-lines [data-olines="none"]', '#orbiter-lines [data-olines="all"]', "#orbiter-track", "#orbiter-track", '[data-orbiter="tgo"]', '[data-orbiter="mro"]']) {
      await page.locator(button).dispatchEvent("click");
      await settle(page, 300);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  const rest0 = await readCounts(page);
  await settle(page, 3000);
  expect((await readCounts(page)).draws - rest0.draws).toBe(0);
});

test("painting an orbiter's track on the Moon uploads nothing at rest, one picture a frame while time runs, and switching paint and craft gives back what it took", async ({ page }) => {
  // the pictures sent to the graphics card at the paint's size (1024 by 512), counted in the page
  await page.addInitScript(() => {
    const seen = window as unknown as { __paintUploads: number };
    seen.__paintUploads = 0;
    for (const Context of [WebGL2RenderingContext, WebGLRenderingContext]) {
      const proto = Context.prototype as unknown as Record<string, (...args: unknown[]) => unknown>;
      for (const name of ["texImage2D", "texSubImage2D"]) {
        const original = proto[name]!;
        proto[name] = function (this: unknown, ...args: unknown[]) {
          if (args.some((value, i) => value === 1024 && args[i + 1] === 512)) seen.__paintUploads += 1;
          return original.apply(this, args);
        };
      }
    }
  });
  const uploads = () => page.evaluate(() => (window as unknown as { __paintUploads: number }).__paintUploads);
  const pixels = () => sky(page).evaluate((el) => (el as unknown as { paintPixels: number }).paintPixels);
  await page.goto(`${SPACE_PAGE}?t=2026-11-12T12:00Z&orbiters=1&paint=1`);
  await liveSky(page);
  await sky(page).evaluate((el) => (el as unknown as { goTo(body: string, options: { smooth: boolean }): void }).goTo("moon", { smooth: false }));
  await expect.poll(pixels, { timeout: 90_000 }).toBeGreaterThan(20);
  await atRest(page);
  await settle(page, 1500);
  // at rest: no draw and no picture sent
  const rest0 = { counts: await readCounts(page), sent: await uploads() };
  await settle(page, 3000);
  expect((await readCounts(page)).draws - rest0.counts.draws, "nothing drawn at rest with the track painted").toBe(0);
  expect((await uploads()) - rest0.sent, "no picture sent at rest").toBe(0);
  // time running: a picture at most a frame, and frames at most thirty a second
  await sky(page).evaluate((el) => Reflect.set(el, "speed", 3600));
  await settle(page, 1500);
  const run0 = { stats: await skyStats(page), sent: await uploads() };
  await settle(page, 4000);
  const run1 = { stats: await skyStats(page), sent: await uploads() };
  const frames = run1.stats.draws - run0.stats.draws;
  expect(frames).toBeGreaterThan(0);
  expect(frames).toBeLessThanOrEqual(4 * 31);
  expect(run1.sent - run0.sent, "a picture sent for each frame drawn at most").toBeLessThanOrEqual(frames + 1);
  expect(run1.sent - run0.sent, "the picture is sent while time runs").toBeGreaterThan(0);
  await sky(page).evaluate((el) => Reflect.set(el, "speed", 0));
  await settle(page, 2000);
  const stop0 = { counts: await readCounts(page), sent: await uploads() };
  await settle(page, 3000);
  expect((await readCounts(page)).draws - stop0.counts.draws, "nothing drawn once time stops").toBe(0);
  expect((await uploads()) - stop0.sent, "no picture sent once time stops").toBe(0);
  // paint off and on, another craft and back, Clear: the graphics objects alive come back to where they were
  const round = async () => {
    for (const button of ["#paint", "#paint", '[data-orbiter="danuri"]', '[data-orbiter="lro"]', '[data-paint-length="1w"]', '[data-paint-length="1d"]', "#paint-clear", "#paint"]) {
      await page.locator(button).dispatchEvent("click");
      await settle(page, 300);
    }
  };
  const first = await converged(page, round);
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  await expect.poll(pixels, { timeout: 30_000 }).toBeGreaterThan(20);
  const after0 = await readCounts(page);
  await settle(page, 3000);
  expect((await readCounts(page)).draws - after0.draws, "nothing drawn at rest after the rounds").toBe(0);
  // and with paint off, nothing of it is held: Clear, then the objects alive are no more than before it was first shown
  await page.locator("#paint-clear").dispatchEvent("click");
  await expect.poll(pixels, { timeout: 30_000 }).toBe(0);
  await settle(page, 2500);
  const cleared = await settledCounts(page);
  expect(gpuObjects(cleared)).toBeLessThan(gpuObjects(last));
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

// --- the belts: 3,340 bodies drawn by default, one instanced draw for each of seven belts ----------------------------------------------------------------------------------------------------
test("the space view with its seven belts of 3,340 bodies: nothing is drawn at rest, one context, and switching the belts off and on again leaves it so", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&scale=compressed`);
  await liveSky(page);
  const doorOf = () => sky(page).evaluate((el) => (el as unknown as { stats: { door: { belts: number; draws: number } } }).stats.door);
  await expect.poll(async () => (await doorOf()).belts, { timeout: 60_000 }).toBe(3340);
  expect((await doorOf()).draws).toBe(7);
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing is drawn at rest").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  for (let round = 0; round < 4; round += 1) {
    await sky(page).evaluate((el) => Reflect.set(el, "belts", []));
    await expect.poll(async () => (await doorOf()).belts, { timeout: 30_000 }).toBe(0);
    await sky(page).evaluate((el) => Reflect.set(el, "belts", ["main", "hilda", "trojan", "centaur", "classical", "resonant", "scattered"]));
    await expect.poll(async () => (await doorOf()).belts, { timeout: 30_000 }).toBe(3340);
  }
  await settle(page, 2500);
  const again = await readCounts(page);
  await settle(page, 3000);
  const end = await readCounts(page);
  expect(end.contexts).toBe(1);
  expect(end.draws - again.draws).toBe(0);
});

test("the space view at a day a second with the belts: at most thirty frames a second, and flying through the main belt keeps to it too", async ({ page }) => {
  await page.goto(`${SPACE_PAGE}?t=2026-11-02T14:00Z&play=on&speed=86400&scale=compressed`);
  await liveSky(page);
  await expect.poll(async () => sky(page).evaluate((el) => (el as unknown as { stats: { door: { belts: number } } }).stats.door.belts), { timeout: 60_000 }).toBe(3340);
  await settle(page, 1500);
  const s0 = await skyStats(page);
  await settle(page, 4000);
  const s1 = await skyStats(page);
  expect(s1.draws - s0.draws).toBeGreaterThan(0);
  expect(s1.draws - s0.draws).toBeLessThanOrEqual(4 * 31);
  await sky(page).evaluate((el) => (el as unknown as { enterBelt(b: string, o: object): void }).enterBelt("main", { smooth: false }));
  await settle(page, 1500);
  const f0 = await skyStats(page);
  await settle(page, 4000);
  const f1 = await skyStats(page);
  expect(f1.draws - f0.draws).toBeGreaterThan(0);
  expect(f1.draws - f0.draws).toBeLessThanOrEqual(4 * 31);
  expect((await readCounts(page)).contexts).toBe(1);
});
