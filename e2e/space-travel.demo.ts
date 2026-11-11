// Travelling between bodies: the view moves along the travel path, and no frame of the move is empty. At every draw of a move at least one of the two bodies (or its marker) is on the screen; the body being
// left stays on the screen through the turn and the destination from then on; the look direction turns one way only; a move arrives at the body; and a reader who asked for reduced motion gets a cut. In both
// scales and for several pairs, Mercury to the Sun among them. Chromium, drawing in software; every reading is what the page reports at each draw.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, SPACE, statsOf } from "./space-ui.ts";

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
  onScreen: { leaving: boolean; destination: boolean };
}

/** Whether a body's disc or marker is on the screen now: its place is inside the box, or within its radius (at least a marker's 4 pixels) of the edge. */
const onScreen = (page: Page, id: string): Promise<boolean> =>
  page.locator(SPACE).evaluate((el, body) => {
    const place = (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body);
    if (!place) return false;
    const r = Math.max(place.r, 4);
    return place.x > -r && place.y > -r && place.x < el.clientWidth + r && place.y < el.clientHeight + r;
  }, id);

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

/** Start a move and record what the page reports at every draw until it is over. */
async function move(page: Page, from: string, to: string, options: Record<string, unknown> = {}): Promise<Frame[]> {
  await callOn(page, "goTo", from, { smooth: false });
  await expect.poll(() => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body")), { timeout: 30_000 }).toBe(from);
  await held(page);
  const frames: Frame[] = [];
  await callOn(page, "goTo", to, options);
  const started = Date.now();
  let lastDraw = -1;
  for (;;) {
    const stats = (await statsOf(page)) as unknown as { draws: number; ride: { gliding: boolean }; travelling: Travelling | null; camera: { forward: [number, number, number] } };
    if (stats.draws !== lastDraw) {
      lastDraw = stats.draws;
      frames.push({ draws: stats.draws, travelling: stats.travelling, gliding: stats.ride.gliding, forward: stats.camera.forward, onScreen: { leaving: await onScreen(page, from), destination: await onScreen(page, to) } });
    }
    if (!stats.ride.gliding && frames.length > 0) break;
    if (Date.now() - started > 60_000) throw new Error("the move never ended");
  }
  return frames;
}

const angle = (a: [number, number, number], b: [number, number, number]): number => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;

for (const scale of ["true", "compressed"] as const) {
  for (const [from, to] of [["mercury", "sun"], ["moon", "mars"], ["earth", "jupiter"], ["callisto", "europa"], ["mars", "earth"]] as const) {
    test(`${scale} scale, ${from} to ${to}: the move turns then travels, no frame of it is empty, the look direction never turns back, and it arrives`, async ({ page }) => {
      test.setTimeout(240_000);
      await openSpace(page, `t=2026-11-02T14:00Z&play=off&scale=${scale}`);
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "transition")), "turn then travel is the default").toBe("turn-travel");
      const frames = await move(page, from, to);
      const moving = frames.filter((f) => f.travelling !== null);
      expect(moving.length, `${moving.length} frames of the move were seen`).toBeGreaterThan(6);
      expect(moving[0]!.travelling!.kind).toBe("turn-travel");
      expect(moving.some((f) => f.travelling!.stage === "travel" || f.travelling!.stage === "arrive"), "the move travels").toBe(true);
      for (const [i, frame] of moving.entries()) {
        const t = frame.travelling!;
        expect(frame.onScreen.leaving || frame.onScreen.destination, `frame ${i} (${t.stage} ${t.progress.toFixed(2)}): the ${from} or the ${to} is on the screen`).toBe(true);
        if (t.stage === "turn") expect(frame.onScreen.leaving, `frame ${i}: the ${from} is on the screen through the turn`).toBe(true);
        if (t.stage !== "turn" && t.progress > 0.3) expect(frame.onScreen.destination, `frame ${i}: the ${to} is on the screen on the way`).toBe(true);
      }
      // one turn, never undone: the angle left to the final look direction never grows between draws (half a degree of slack for a drawn frame's rounding)
      const last = moving[moving.length - 1]!.forward;
      let left = Infinity;
      for (const [i, frame] of moving.entries()) {
        const now = angle(frame.forward, last);
        expect(now, `frame ${i}: the look direction does not turn back (${now.toFixed(2)} degrees left, was ${left.toFixed(2)})`).toBeLessThanOrEqual(left + 0.5);
        left = Math.min(left, now);
      }
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(to);
    });
  }
}

test("direct goes straight (a line path), a page can set one move's length, and the view's pace scales the plan's", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  const direct = await move(page, "earth", "mars", { transition: "direct" });
  const moving = direct.filter((f) => f.travelling !== null);
  expect(moving.length).toBeGreaterThan(3);
  expect(moving[0]!.travelling!.kind).toBe("direct");
  expect(moving[0]!.travelling!.path).toBe("line");
  for (const frame of moving) expect(frame.onScreen.destination, "direct: the destination is on the screen the whole way").toBe(true);
  // a fixed length: the move lasts about that long (the draws are counted, not the clock: at least a few, and the stats say the length)
  const quick = await move(page, "mars", "earth", { duration: 900 });
  const quickMoving = quick.filter((f) => f.travelling !== null);
  expect(quickMoving.length).toBeGreaterThan(2);
  expect((quickMoving[0]!.travelling as unknown as { duration: number }).duration).toBe(900);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "pace", 2));
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pace"))).toBe(2);
  const slow = await move(page, "earth", "mars", { transition: "direct" });
  const slowMoving = slow.filter((f) => f.travelling !== null);
  expect((slowMoving[0]!.travelling as unknown as { duration: number }).duration, "pace 2 doubles the plan's length").toBeGreaterThan((moving[0]!.travelling as unknown as { duration: number }).duration * 1.5);
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
  await callOn(page, "goTo", "mars");
  expect(((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, "reduced motion: no move").toBe(false);
  await context.close();
});
