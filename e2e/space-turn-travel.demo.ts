// Turn then travel (MODULES-912): between two bodies the view never shows an empty frame. At every frame of the trip at least one of the two bodies (or its marker) is on the screen; the trip
// first swings round the body being left with that body in view, then travels with the destination in view, in both scales and for several pairs, Mercury to the Sun among them. Chromium,
// drawing in software; every reading is what the page reports at each draw.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Frame {
  draws: number;
  leg: "turn" | "travel" | null;
  progress: number;
  gliding: boolean;
  inFrame: { leaving: boolean; destination: boolean };
}

/** Whether a body's disc or marker is on the screen now: its place is inside the box, or within its radius of the edge. */
const onScreen = (page: Page, id: string): Promise<boolean> =>
  page.locator(SPACE).evaluate((el, body) => {
    const place = (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body);
    if (!place) return false;
    const r = Math.max(place.r, 4);
    return place.x > -r && place.y > -r && place.x < el.clientWidth + r && place.y < el.clientHeight + r;
  }, id);

/** Start a trip and record what the page reports at every draw until it is over. */
async function trip(page: Page, from: string, to: string): Promise<Frame[]> {
  await callOn(page, "goTo", from, { smooth: false });
  await expect.poll(() => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body")), { timeout: 30_000 }).toBe(from);
  let held = -1;
  await expect
    .poll(
      async () => {
        const now = (await readCounts(page)).draws;
        const same = now === held;
        held = now;
        return same;
      },
      { timeout: 30_000, intervals: [300] },
    )
    .toBe(true);
  const frames: Frame[] = [];
  await callOn(page, "goTo", to);
  const started = Date.now();
  let lastDraw = -1;
  for (;;) {
    const stats = (await statsOf(page)) as unknown as { draws: number; ride: { gliding: boolean }; travelling: { leg: "turn" | "travel"; progress: number } | null };
    if (stats.draws !== lastDraw) {
      lastDraw = stats.draws;
      frames.push({ draws: stats.draws, leg: stats.travelling?.leg ?? null, progress: stats.travelling?.progress ?? 0, gliding: stats.ride.gliding, inFrame: { leaving: await onScreen(page, from), destination: await onScreen(page, to) } });
    }
    if (!stats.ride.gliding && frames.length > 0) break;
    if (Date.now() - started > 30_000) throw new Error("the trip never ended");
  }
  return frames;
}

for (const scale of ["true", "compressed"] as const) {
  for (const [from, to] of [["mercury", "sun"], ["moon", "mars"], ["earth", "jupiter"], ["mars", "earth"]] as const) {
    test(`${scale} scale, ${from} to ${to}: the trip swings then travels, and no frame of it is empty`, async ({ page }) => {
      test.setTimeout(240_000);
      await openSpace(page, `t=2026-11-02T14:00Z&play=off&scale=${scale}`);
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "transition")), "turn then travel is the default").toBe("turn-travel");
      const frames = await trip(page, from, to);
      expect(frames.length, `${frames.length} frames of the trip were seen`).toBeGreaterThan(6);
      const legs = frames.map((f) => f.leg).filter((leg) => leg !== null);
      expect(legs[0], "the trip starts with the swing").toBe("turn");
      expect(legs.includes("travel"), "and goes on to the travel leg").toBe(true);
      const firstTravel = frames.findIndex((f) => f.leg === "travel");
      for (const [i, frame] of frames.entries()) {
        if (!frame.gliding) continue;
        expect(frame.inFrame.leaving || frame.inFrame.destination, `frame ${i} (${frame.leg} ${frame.progress.toFixed(2)}): the ${from} or the ${to} is on the screen`).toBe(true);
        // while the swing lasts the body being left stays in view; once the travel leg is well on, the destination is in view
        if (frame.leg === "turn") expect(frame.inFrame.leaving, `frame ${i}: the ${from} is in view during the swing`).toBe(true);
        if (frame.leg === "travel" && frame.progress > 0.2) expect(frame.inFrame.destination, `frame ${i}: the ${to} is in view on the way`).toBe(true);
      }
      expect(firstTravel).toBeGreaterThan(0);
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(to);
    });
  }
}

test("a trip to a body already in view goes direct under auto, and under reduced motion every trip is a cut", async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await callOn(page, "goTo", "mars");
  expect(((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding, "reduced motion: no glide").toBe(false);
  await context.close();
});
