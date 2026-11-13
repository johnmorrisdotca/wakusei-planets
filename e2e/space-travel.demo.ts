// Travelling between bodies: the view moves along the travel path, and no frame of the move is empty. At every draw of a move at least one of the two bodies (or its marker) is on the screen; the body being
// left stays on the screen through the turn and the destination from then on; the look direction turns one way only; a move arrives at the body; and a reader who asked for reduced motion gets a cut. In both
// scales and for several pairs, Mercury to the Sun among them. Chromium, drawing in software; every reading is what the page reports at each draw.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callCounted, callOn, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Travelling {
  kind: string;
  path: string;
  stage: "turn" | "travel" | "arrive";
  progress: number;
  leaving: boolean;
  destination: boolean;
}
interface Frame {
  draws: number;
  travelling: Travelling | null;
  gliding: boolean;
  forward: [number, number, number];
  onScreen: { leaving: boolean; destination: boolean; planet: boolean };
}
/** The planet two moons of one planet go round (the move keeps it in the picture, and it is what the turn holds). */
const PLANET: Record<string, string> = { callisto: "jupiter", europa: "jupiter" };

/** Puts the reader of one frame on the page: what the page reports now, read in one go so every part is of the same draw (the move, the look direction, and whether each body's disc or marker is on the screen: its place is inside the box, or within its radius, at least a marker's 4 pixels, of the edge). It lives on the page so that a move can be watched there at every animation frame, not at the pace of a round trip to the test, which a loaded machine stretches to a few readings a move. */
const installReader = (): void => {
  Reflect.set(window, "__frameOf", (el: Element, [a, b, c]: [string, string, string | null]) => {
    const stats = Reflect.get(el, "stats") as { draws: number; ride: { gliding: boolean }; travelling: unknown; camera: { forward: [number, number, number] } };
    const on = (id: string | null): boolean => {
      if (id === null) return false;
      const place = (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(id);
      if (!place) return false;
      const r = Math.max(place.r, 4);
      return place.x > -r && place.y > -r && place.x < el.clientWidth + r && place.y < el.clientHeight + r;
    };
    return { draws: stats.draws, travelling: stats.travelling, gliding: stats.ride.gliding, forward: stats.camera.forward, onScreen: { leaving: on(a), destination: on(b), planet: on(c) } };
  });
};
const bodiesOf = (from: string, to: string): [string, string, string | null] => [from, to, PLANET[from] !== undefined && PLANET[from] === PLANET[to] ? PLANET[from]! : null];
const read = async (page: Page, from: string, to: string): Promise<Frame> => {
  await page.evaluate(installReader);
  return page.locator(SPACE).evaluate((el, args) => (Reflect.get(window, "__frameOf") as (el: Element, args: [string, string, string | null]) => unknown)(el, args), bodiesOf(from, to)) as Promise<Frame>;
};

/** Wait until the draws hold (two reads apart with no new draw). */
async function held(page: Page): Promise<void> {
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
}

/** Start a move and record what the page reports at every draw until it is over. A reading is kept only if it is of a draw made after the move was asked for: before that the page still reports the last draw of what came before. */
async function move(page: Page, from: string, to: string, options: Record<string, unknown> = {}, startZoom = 1, fresh = false): Promise<Frame[]> {
  // `fresh`: from the controls' own start (no turn, no tilt, set after the body is gone to, which now stands on the side it is arrived at), so two moves of the same pair begin from the same view and their plans can be compared
  const before = await callCounted(page, "goTo", from, { smooth: false, zoom: startZoom });
  await expect.poll(() => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body")), { timeout: 30_000 }).toBe(from);
  if (fresh) await page.locator("#controls").evaluate((el, zoom) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ yaw: 0, tilt: 0, zoom }, true, "set"), startZoom);
  await expect.poll(async () => (await statsOf(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  await held(page);
  const base = (await statsOf(page)).draws;
  await page.evaluate(installReader);
  await callOn(page, "goTo", to, options);
  // watched on the page, at every animation frame, until the move is over: a reading is kept for each new draw. The test's own round trips are slower than the draws on a loaded machine and would see only a few of them
  const frames = (await page.locator(SPACE).evaluate(
    async (el, [a, b, c, first]) => {
      const frameOf = Reflect.get(window, "__frameOf") as (el: Element, args: [string, string, string | null]) => { draws: number; gliding: boolean };
      const seen: { draws: number; gliding: boolean }[] = [];
      let lastDraw = first as number;
      const started = performance.now();
      for (;;) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = frameOf(el, [a as string, b as string, c as string | null]);
        if (now.draws !== lastDraw) {
          lastDraw = now.draws;
          seen.push(now);
        }
        if (!now.gliding && seen.length > 0) return seen;
        if (performance.now() - started > 60_000) throw new Error("the move never ended");
      }
    },
    [...bodiesOf(from, to), base] as [string, string, string | null, number],
  )) as Frame[];
  return frames;
}

const angle = (a: [number, number, number], b: [number, number, number]): number => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;

for (const scale of ["true", "compressed"] as const) {
  for (const [from, to] of [["mercury", "sun"], ["moon", "mars"], ["earth", "jupiter"], ["callisto", "europa"], ["mars", "earth"]] as const) {
    test(`${scale} scale, ${from} to ${to}: the move turns then travels, no frame of it is empty, the look direction never turns back, and it arrives`, async ({ page }) => {
      test.setTimeout(240_000);
      await openSpace(page, `t=2026-11-02T14:00Z&play=off&scale=${scale}`);
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "transition")), "turn then travel is the default").toBe("turn-travel");
      // twice as slow, so that software drawing on a loaded machine still catches frames of every stage (the demo's own pace control)
      await page.locator('#paces [data-pace="2"]').dispatchEvent("click");
      // two moons of one planet start from the controls' own view: the view a cut leaves on a moon (the side that frames its planet, or the one the Sun lights) can look away from the planet, and the planet's circle does not yet keep a moon in the picture from there (a ticket of its own)
      const frames = await move(page, from, to, {}, 1, PLANET[from] !== undefined && PLANET[from] === PLANET[to]);
      const moving = frames.filter((f) => f.travelling !== null);
      expect(moving.length, `${moving.length} frames of the move were seen`).toBeGreaterThan(6);
      expect(moving[0]!.travelling!.kind).toBe("turn-travel");
      expect(moving.some((f) => f.travelling!.stage === "travel" || f.travelling!.stage === "arrive"), "the move travels").toBe(true);
      for (const [i, frame] of moving.entries()) {
        const t = frame.travelling!;
        expect(frame.onScreen.leaving || frame.onScreen.destination, `frame ${i} (${t.stage} ${t.progress.toFixed(2)}): the ${from} or the ${to} is on the screen`).toBe(true);
        // the turn holds the body left, or, for two moons of one planet, the planet circled: one of the two is on the screen through the turn
        if (t.stage === "turn") expect(frame.onScreen.leaving || (PLANET[from] === PLANET[to] && frame.onScreen.planet), `frame ${i}: the ${from} (or its planet) is on the screen through the turn`).toBe(true);
        if (t.stage !== "turn" && t.progress > 0.3) expect(frame.onScreen.destination, `frame ${i}: the ${to} is on the screen on the way`).toBe(true);
      }
      // two turns, neither undone. The camera arrives from the side that keeps a companion in the picture, which may be well round from the way it came, so the look direction turns twice: in the turn stage to face the way
      // on (the angle left to where the turn ends never grows between draws), then, from there to the end of the move, round to the arrival side (the angle left to the final look direction never grows). Half a degree of slack for a drawn frame's rounding.
      const last = moving[moving.length - 1]!.forward;
      const turned = moving.filter((f) => f.travelling!.stage === "turn");
      const faced = (turned.length > 0 ? turned[turned.length - 1]! : moving[0]!).forward;
      let toFaced = Infinity;
      for (const [i, frame] of turned.entries()) {
        const now = angle(frame.forward, faced);
        expect(now, `turn frame ${i}: the turn is not undone (${now.toFixed(2)} degrees left, was ${toFaced.toFixed(2)})`).toBeLessThanOrEqual(toFaced + 0.5);
        toFaced = Math.min(toFaced, now);
      }
      let left = Infinity;
      for (const [i, frame] of moving.slice(turned.length).entries()) {
        const now = angle(frame.forward, last);
        expect(now, `frame ${i} after the turn: the look direction does not turn back (${now.toFixed(2)} degrees left, was ${left.toFixed(2)})`).toBeLessThanOrEqual(left + 0.5);
        left = Math.min(left, now);
      }
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(to);
      const after = (await statsOf(page)) as unknown as { travelling: Travelling | null; ride: { gliding: boolean } };
      expect(after.ride.gliding, "the move is over").toBe(false);
      expect(after.travelling, "nothing is travelling after the move").toBeNull();
    });
  }
}

test("direct goes straight (a line path), a page can set one move's length, and the view's pace scales the plan's", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  // four times as slow, so that software drawing on a loaded machine still catches more than a few draws of each move (the demo's own pace control; the other travel tests do the same)
  await page.locator('#paces [data-pace="4"]').dispatchEvent("click");
  const direct = await move(page, "earth", "mars", { transition: "direct" });
  const moving = direct.filter((f) => f.travelling !== null);
  expect(moving.length).toBeGreaterThan(3);
  expect(moving[0]!.travelling!.kind).toBe("direct");
  expect(moving[0]!.travelling!.path).toBe("line");
  // a straight glide keeps the destination in the picture when it is in the picture as the move starts (the whole system on the screen, then Jupiter); from the Earth framed, Mars is a long way off to one side at the start
  const inView = await move(page, "sun", "jupiter", { transition: "direct" }, 0.02);
  const inViewMoving = inView.filter((f) => f.travelling !== null);
  expect(inViewMoving.length).toBeGreaterThan(3);
  expect(inViewMoving[0]!.onScreen.destination, "Jupiter is on the screen as the move starts").toBe(true);
  for (const [i, frame] of inViewMoving.entries()) expect(frame.onScreen.destination, `frame ${i}: direct, the destination is on the screen the whole way`).toBe(true);
  await page.locator('#paces [data-pace="1"]').dispatchEvent("click");
  // a fixed length: the stats of the move's first draw say the length a page asked for. A move's clock starts when it is asked for, and a loaded machine drawing in software can make its first draw seconds later, so a move of a
  // few seconds was sometimes over before any draw of it was seen. A long one is asked for, its first draw is waited on (a draw, never a clock), and it is cut short once the length is read.
  await callOn(page, "goTo", "mars", { smooth: false, zoom: 1 });
  await expect.poll(() => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body")), { timeout: 30_000 }).toBe("mars");
  await held(page);
  await callOn(page, "goTo", "earth", { duration: 60_000 });
  await expect.poll(async () => ((await statsOf(page)) as unknown as { travelling: { duration: number } | null }).travelling?.duration ?? null, { timeout: 60_000, message: "the long move was drawn, and its length is the one asked for" }).toBe(60_000);
  await callOn(page, "goTo", "mars", { smooth: false });
  await expect.poll(async () => ((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, { timeout: 60_000 }).toBe(false);
  // the view's pace scales the plan: the same move from the same view takes twice as long at pace 4 as at pace 2 (set with the demo's own control, which holds the choice and applies it at every render). The two slow paces are used so that
  // the move is long enough for its first draw, which works the plan out, to land inside it on a loaded machine drawing in software: a move of a second or two was sometimes over before any draw of it was seen
  const paceOf = (frames: Frame[]): number => (frames.find((f) => f.travelling !== null)!.travelling as unknown as { duration: number }).duration;
  await page.locator('#paces [data-pace="2"]').dispatchEvent("click");
  const even = paceOf(await move(page, "earth", "mars", { transition: "direct" }, 1, true));
  await page.locator('#paces [data-pace="4"]').dispatchEvent("click");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pace"))).toBe(4);
  const slow = paceOf(await move(page, "earth", "mars", { transition: "direct" }, 1, true));
  expect(slow, `pace 4 doubles the plan's length at pace 2 (${even} ms, then ${slow} ms)`).toBeGreaterThanOrEqual(even * 2 - 2);
  expect(slow).toBeLessThanOrEqual(even * 2 + 2);
});

test("auto is direct when the destination is on the screen as the move starts, and turn then travel when it is not", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  // from the whole system every planet is on the screen
  await callOn(page, "goTo", "sun", { smooth: false, zoom: 0.02 });
  await held(page);
  await callOn(page, "goTo", "jupiter", { transition: "auto" });
  await expect.poll(async () => ((await statsOf(page)) as unknown as { travelling: Travelling | null }).travelling?.kind ?? null, { timeout: 30_000 }).toBe("direct");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, { timeout: 60_000 }).toBe(false);
  // from Jupiter filling the view, Mars is not
  const frames = await move(page, "jupiter", "mars", { transition: "auto" });
  expect(frames.find((f) => f.travelling !== null)!.travelling!.kind).toBe("turn-travel");
});

test("under reduced motion every move is a cut", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  type Reading = { ride: { gliding: boolean }; travelling: Travelling | null; region: { id: string } | null };
  const reading = async (): Promise<Reading> => (await statsOf(page)) as unknown as Reading;
  await callOn(page, "goTo", "mars");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
  expect((await reading()).ride.gliding, "reduced motion: no move").toBe(false);
  expect((await reading()).travelling, "reduced motion: nothing travels").toBeNull();
  // a step out from the Sun is a cut too: the stage is there at once, and nothing travels
  await callOn(page, "goTo", "sun");
  expect(await callOn(page, "stepOut")).toBe("inner-planets");
  expect((await reading()).ride.gliding, "reduced motion: a step out is no move").toBe(false);
  expect((await reading()).region?.id).toBe("inner-planets");
  await expect.poll(async () => (await reading()).travelling, { timeout: 30_000 }).toBeNull();
  expect(await callOn(page, "stepIn")).toBe("sun");
  expect((await reading()).ride.gliding, "reduced motion: a step in is no move").toBe(false);
  await context.close();
});

test("a press while the camera is on its way starts a new move from where it is: no empty frame, it ends at the last body, and nothing travels after it", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  await callOn(page, "goTo", "earth", { smooth: false });
  await held(page);
  await callOn(page, "goTo", "mars");
  // wait until the first move has turned and is on its way: Mars is on the screen
  await expect.poll(async () => (await read(page, "earth", "mars")).travelling?.stage ?? "", { timeout: 60_000 }).toMatch(/^(travel|arrive)$/);
  await expect.poll(async () => (await read(page, "earth", "mars")).onScreen.destination, { timeout: 60_000 }).toBe(true);
  const base = (await statsOf(page)).draws;
  await callOn(page, "goTo", "jupiter");
  const frames: Frame[] = [];
  let lastDraw = base;
  const started = Date.now();
  for (;;) {
    const now = await read(page, "mars", "jupiter");
    if (now.draws !== lastDraw) {
      lastDraw = now.draws;
      frames.push(now);
    }
    if (!now.gliding && frames.length > 0) break;
    if (Date.now() - started > 90_000) throw new Error("the second move never ended");
  }
  expect(frames.length, `${frames.length} frames of the second move were seen`).toBeGreaterThan(3);
  for (const [i, frame] of frames.entries()) {
    if (frame.travelling !== null) expect(frame.onScreen.leaving || frame.onScreen.destination, `frame ${i}: the Mars or Jupiter is on the screen`).toBe(true);
  }
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("jupiter");
  const after = (await statsOf(page)) as unknown as { travelling: Travelling | null; ride: { gliding: boolean } };
  expect(after.ride.gliding).toBe(false);
  expect(after.travelling, "nothing is travelling after the move").toBeNull();
});

test("with a bar bound to the element a move that travels announces the side the camera comes from, the bar holds it, and the camera arrives from that side", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=true");
  await callOn(page, "goTo", "earth", { smooth: false });
  await held(page);
  // every announcement of a hop, kept as the page hears it
  await page.locator(SPACE).evaluate((el) => {
    const heard: unknown[] = [];
    Reflect.set(window, "__hops", heard);
    el.addEventListener("wakusei-hop", (event) => heard.push((event as CustomEvent).detail));
  });
  await callOn(page, "goTo", "jupiter");
  type Hop = { zoom?: number; yaw?: number; tilt?: number };
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, "__hops") as Hop[]).filter((one) => one.zoom !== undefined).length), { timeout: 30_000 }).toBeGreaterThan(0);
  const hop = (await page.evaluate(() => Reflect.get(window, "__hops") as Hop[])).find((one) => one.zoom !== undefined)!;
  expect(typeof hop.yaw, "the hop carries the yaw").toBe("number");
  expect(typeof hop.tilt, "the hop carries the tilt").toBe("number");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, { timeout: 90_000 }).toBe(false);
  await held(page);
  // the bar holds the side the hop named
  const bar = await page.locator("#controls").evaluate((el) => (Reflect.get(el, "controller") as { state: { yaw: number; tilt: number } }).state);
  expect(bar.yaw).toBeCloseTo(hop.yaw!, 6);
  expect(bar.tilt).toBeCloseTo(hop.tilt!, 6);
  // and the camera arrives from that side, looking at the body with its middle in the middle of the picture. The side is the one that keeps a companion in the picture (a moon of Jupiter), so it need not be the way the camera came
  const after = (await statsOf(page)) as unknown as { companion: string | null };
  expect(after.companion, "the arrival keeps a companion in the picture").not.toBeNull();
  const place = await page.locator(SPACE).evaluate((el) => {
    const at = (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } }).placeOf("jupiter");
    return { x: at.x, y: at.y, w: el.clientWidth, h: el.clientHeight };
  });
  expect(Math.abs(place.x - place.w / 2), "Jupiter is in the middle across").toBeLessThan(2);
  expect(Math.abs(place.y - place.h / 2), "Jupiter is in the middle up and down").toBeLessThan(2);
});
