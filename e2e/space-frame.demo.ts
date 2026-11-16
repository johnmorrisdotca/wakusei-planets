// The frames the camera holds its direction in while time runs (`frame`: stars, body, pair), in a real browser drawing in software, on the page's own clock (clock.ts): a day or thirty of the page's time pass in as many
// seconds of it, however slowly this machine draws. Mercury paired with the Sun for thirty days at a day a second keeps the Sun where it was in the picture; the Moon paired with the Earth keeps the Earth; Mars turned with
// for a day at an hour a second keeps its ground still under the camera; a drag changes the framing and the new framing is kept; a ride ends a pair; nothing is drawn at rest.
import { expect, test, type Page } from "@playwright/test";
import { advance, holdClock, takeClock } from "./clock.ts";
import { callOn, openSpace, setOn, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

async function openClocked(page: Page, query: string): Promise<void> {
  await takeClock(page);
  await openSpace(page, query);
  await holdClock(page);
}
const DAY_SPEED = 86_400;
const placeOf = (page: Page, id: string) => page.locator(SPACE).evaluate((el, name) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(name), id);
const frameOf = async (page: Page) => ((await statsOf(page)) as unknown as { frame: { asked: string; frame: string; pair: string | null }; companion: string | null }).frame;
/** Go to a body from another with a cut, so that the arrival is chosen as a move chooses it (with the body left behind the body gone to), and let the draws come. */
async function arrive(page: Page, from: string, to: string): Promise<void> {
  await callOn(page, "goTo", from, { smooth: false });
  await advance(page, 500);
  await callOn(page, "goTo", to, { smooth: false });
  await advance(page, 500);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(to);
}
/** Where a body is in the picture at the end of each of `n` seconds of the page's time. */
async function walkPlaces(page: Page, id: string, n: number): Promise<{ x: number; y: number }[]> {
  const places: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    await advance(page, 1000);
    const at = await placeOf(page, id);
    // a body out of the picture has no place: it is as far from where it was as can be
    places.push(at === null ? { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY } : { x: at.x, y: at.y });
  }
  return places;
}
const spread = (places: { x: number; y: number }[]): number => Math.max(...places.map((p) => (Number.isFinite(p.x) ? Math.hypot(p.x - places[0]!.x, p.y - places[0]!.y) : Number.POSITIVE_INFINITY)));

for (const [focus, companion, days] of [["mercury", "sun", 30], ["moon", "earth", 30]] as const) {
  test(`${focus} paired with the ${companion} for ${days} days at a day a second: the ${companion} stays within a few pixels of its place in the picture, where fixed to the stars it goes right round`, async ({ page }) => {
    test.setTimeout(240_000);
    await openClocked(page, "t=2026-11-02T14:00Z&play=off&scale=true");
    await arrive(page, companion, focus);
    expect((await statsOf(page) as unknown as { companion: string | null }).companion, "the arrival keeps the body left behind it").toBe(companion);
    // fixed to the stars first: the companion goes round the body in focus
    await setOn(page, "speed", DAY_SPEED);
    const stars = await walkPlaces(page, companion, days);
    await setOn(page, "speed", 0);
    console.log(`# GL walk ${focus} fixed to the stars, ${days} days: the ${companion} ${spread(stars) === Number.POSITIVE_INFINITY ? "left the picture" : `moved up to ${spread(stars).toFixed(0)} px in the picture`}`);
    expect(spread(stars), "fixed to the stars the companion leaves its place").toBeGreaterThan(100);
    // paired: the same arrival, the same days
    await arrive(page, companion, focus);
    await setOn(page, "frame", "pair");
    await advance(page, 300);
    expect(await frameOf(page)).toEqual({ asked: "pair", frame: "pair", pair: companion });
    const first = await placeOf(page, companion);
    await setOn(page, "speed", DAY_SPEED);
    const paired = [{ x: first!.x, y: first!.y }, ...(await walkPlaces(page, companion, days))];
    await setOn(page, "speed", 0);
    const drift = spread(paired);
    console.log(`# GL walk ${focus} paired with the ${companion}, ${days} days at a day a second: the ${companion} stayed within ${drift.toFixed(1)} px of its place (first at ${first!.x.toFixed(0)}, ${first!.y.toFixed(0)})`);
    expect(drift, `the ${companion} moved ${drift.toFixed(1)} px`).toBeLessThanOrEqual(5);
  });
}

test("Mars turned with for a day at an hour a second: the ground stays still under the camera, where fixed to the stars it goes right round; a body with no known rotation is held to the stars and says so", async ({ page }) => {
  test.setTimeout(600_000);
  await openClocked(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  await callOn(page, "goTo", "mars", { smooth: false });
  await advance(page, 500);
  const under = (): Promise<{ lon: number; lat: number } | null> => page.locator(SPACE).evaluate((el) => (el as unknown as { subCameraPoint(): { lon: number; lat: number } | null }).subCameraPoint());
  const wrap = (deg: number): number => Math.abs(((deg + 540) % 360) - 180);
  const walk = async (steps: number): Promise<number> => {
    const first = (await under())!;
    let worst = 0;
    await setOn(page, "speed", 3600);
    for (let i = 0; i < steps; i += 1) {
      await advance(page, 4000);
      const now = (await under())!;
      worst = Math.max(worst, wrap(now.lon - first.lon), Math.abs(now.lat - first.lat));
    }
    await setOn(page, "speed", 0);
    await advance(page, 300);
    return worst;
  };
  // fixed to the stars: eight hours show the ground going round (the control)
  const stars = await walk(2);
  expect(stars, "fixed to the stars the ground turns under the camera").toBeGreaterThan(90);
  await callOn(page, "goTo", "mars", { smooth: false });
  await setOn(page, "frame", "body");
  await advance(page, 300);
  expect(await frameOf(page)).toEqual({ asked: "body", frame: "body", pair: null });
  // turned with: the whole day, at an hour a second
  const held = await walk(6);
  // Mars's radius is some 400 pixels at zoom 1, so a degree is about seven pixels
  console.log(`# GL walk Mars turned with, a day at an hour a second: the point under the camera moved ${held.toFixed(3)} degrees (about ${(held * 7).toFixed(1)} px); fixed to the stars it moved ${stars.toFixed(0)}`);
  expect(held, `the point under the camera moved ${held} degrees`).toBeLessThan(0.5);
  // a body with no known rotation
  await callOn(page, "goTo", "halley", { smooth: false });
  await advance(page, 500);
  expect(await frameOf(page)).toEqual({ asked: "body", frame: "stars", pair: null });
});

test("a drag in a pair changes the framing and the new framing is kept; a move that arrives with a companion makes it the pair; a ride ends the pair; the page is told when the frame changes", async ({ page }) => {
  test.setTimeout(240_000);
  await openClocked(page, "t=2026-11-02T14:00Z&play=off&scale=true");
  await page.evaluate(() => {
    const told: unknown[] = [];
    Reflect.set(window, "__frames", told);
    document.querySelector("wakusei-space")!.addEventListener("wakusei-frame", (event) => told.push((event as CustomEvent).detail));
  });
  await arrive(page, "sun", "mercury");
  await setOn(page, "frame", "pair");
  await advance(page, 300);
  const told = (): Promise<{ frame: string; previous: string; pair: string | null }[]> => page.evaluate(() => Reflect.get(window, "__frames") as { frame: string; previous: string; pair: string | null }[]);
  expect((await told()).at(-1), "told when the pair began").toMatchObject({ frame: "pair", previous: "stars", pair: "sun" });
  // the reader turns the camera: the Sun moves in the picture, and then stays where it was moved to as the days pass
  const before = (await placeOf(page, "sun"))!;
  await setOn(page, "speed", DAY_SPEED);
  await advance(page, 3000);
  await page.locator("#controls").evaluate((el) => {
    const controller = Reflect.get(el, "controller") as { state: { yaw: number; tilt: number }; set(view: unknown, final: boolean, reason: string): void };
    controller.set({ yaw: controller.state.yaw + 25 }, true, "drag");
  });
  await advance(page, 300);
  const moved = (await placeOf(page, "sun"))!;
  expect(Math.hypot(moved.x - before.x, moved.y - before.y), "the drag moved the Sun in the picture").toBeGreaterThan(30);
  expect((await frameOf(page)).frame, "a drag does not leave the pair").toBe("pair");
  const after = [{ x: moved.x, y: moved.y }, ...(await walkPlaces(page, "sun", 20))];
  await setOn(page, "speed", 0);
  console.log(`# GL walk a drag in the pair: the Sun moved ${Math.hypot(moved.x - before.x, moved.y - before.y).toFixed(0)} px and then stayed within ${spread(after).toFixed(1)} px for 20 days`);
  expect(spread(after), "the new framing is kept").toBeLessThanOrEqual(6);
  // a move that arrives with a companion (Venus, with Mercury behind it): that body is the pair
  await callOn(page, "goTo", "venus", { smooth: false });
  await advance(page, 500);
  expect(await frameOf(page)).toEqual({ asked: "pair", frame: "pair", pair: "mercury" });
  // a ride ends it
  await callOn(page, "ride", "moon");
  await advance(page, 800);
  expect((await frameOf(page)).frame).toBe("stars");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "frame"))).toBe("stars");
  expect((await told()).at(-1), "told when the ride ended it").toMatchObject({ frame: "stars", previous: "pair" });
});

test("in the frames nothing is drawn at rest, and while time runs the view draws no more than it did", async ({ page }) => {
  test.setTimeout(240_000);
  await openClocked(page, "t=2026-11-02T14:00Z&play=off&scale=true");
  await arrive(page, "sun", "mercury");
  const draws = async (): Promise<number> => (await statsOf(page)).draws;
  for (const frame of ["pair", "body"]) {
    await setOn(page, "frame", frame);
    await advance(page, 500);
    const at = await draws();
    await advance(page, 4000);
    expect(await draws(), `${frame}: nothing is drawn at rest`).toBe(at);
  }
  // running at a day a second the draws are the clock's own, thirty a second at most
  await setOn(page, "speed", DAY_SPEED);
  const start = await draws();
  await advance(page, 4000);
  const made = (await draws()) - start;
  expect(made, `${made} draws in four seconds`).toBeLessThanOrEqual(4 * 31);
  await setOn(page, "speed", 0);
});
