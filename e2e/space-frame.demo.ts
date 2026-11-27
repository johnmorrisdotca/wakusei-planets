// The frames the camera holds its direction in while time runs (`frame`: stars, body, pair), in a real browser drawing in software, on the page's own clock (clock.ts): a day or thirty of the page's time pass in as many
// seconds of it, however slowly this machine draws. Mercury paired with the Sun for thirty days at a day a second keeps the Sun where it was in the picture; the Moon paired with the Earth keeps the Earth; Mars turned with
// for a day at an hour a second keeps its ground still under the camera; a drag changes the framing and the new framing is kept; a ride ends a pair; nothing is drawn at rest.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import type { SpaceCamera } from "../src/space/element.ts";
import { advance, holdClock, takeClock } from "./clock.ts";
import { callOn, drawn, openSpace, setOn, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

test("a backdrop gets the drawn camera on the first frame and when it turns, pans or resizes", async ({ page }) => {
  await page.addInitScript(() => {
    const events: SpaceCamera[] = [];
    Reflect.set(window, "__spaceCameras", events);
    document.addEventListener("wakusei-camera", (event) => events.push((event as CustomEvent<SpaceCamera>).detail), true);
  });
  await openSpace(page, "t=2026-11-02T14:00Z&speed=0&play=off");
  const events = () => page.evaluate(() => Reflect.get(window, "__spaceCameras") as SpaceCamera[]);
  const camera = () => page.locator(SPACE).evaluate((el) => (el as HTMLElementTagNameMap["wakusei-space"]).stats.camera);
  const first = (await events()).at(-1)!;
  expect(first).toMatchObject({ panX: 0, panY: 0 });
  expect(first.width).toBeGreaterThan(0);
  expect(first.height).toBeGreaterThan(0);

  await drawn(page, () => page.locator(SPACE).evaluate((el) => {
    const space = el as HTMLElementTagNameMap["wakusei-space"];
    space.setAttribute("labels", "off");
    space.setView({ yaw: 24, tilt: 12, zoom: 1, panX: 20, panY: -8 });
  }));
  const turned = (await events()).at(-1)!;
  expect(turned.forward).not.toEqual(first.forward);
  expect(turned).toMatchObject({ panX: 20, panY: -8 });
  expect(await camera()).toMatchObject({ ...turned });

  await drawn(page, () => page.locator(SPACE).evaluate((el) => { (el as HTMLElement).style.width = "550px"; }));
  const resized = (await events()).at(-1)!;
  expect(resized.width).toBe(550);
  expect(await camera()).toMatchObject({ ...resized });

  const count = (await events()).length;
  await drawn(page, () => page.locator(SPACE).evaluate((el) => el.setAttribute("light", "lit")));
  expect(await events()).toHaveLength(count);
});

async function openClocked(page: Page, query: string): Promise<void> {
  await takeClock(page);
  await openSpace(page, query);
  await holdClock(page);
}
const DAY_SPEED = 86_400;
const placeOf = (page: Page, id: string) => page.locator(SPACE).evaluate((el, name) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(name), id);
const frameOf = async (page: Page) => ((await statsOf(page)) as unknown as { frame: { asked: string; frame: string; pair: string | null }; companion: string | null }).frame;
/**
 * Go to a body from another with a cut, then turn the camera round it until the companion is in the picture beside its disc (at the back left or right, about a third of the way to the edge): an arrival now stands on the
 * body's lit side, which seldom has the body left in the picture, and a pair needs the companion in view to show that it stays where it is.
 */
async function arrive(page: Page, from: string, to: string): Promise<void> {
  await callOn(page, "goTo", from, { smooth: false });
  await advance(page, 500);
  await callOn(page, "goTo", to, { smooth: false });
  await advance(page, 500);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe(to);
  const place = async () => {
    const at = await placeOf(page, from);
    const size = await page.locator(SPACE).evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
    return at === null ? null : { ...at, ...size };
  };
  const good = (at: Awaited<ReturnType<typeof place>>) => at !== null && at.x > 0 && at.x < at.w && at.y > 0 && at.y < at.h && Math.abs(at.x - at.w / 2) > 0.25 * (at.w / 2) && Math.abs(at.x - at.w / 2) < 0.8 * (at.w / 2) && Math.abs(at.y - at.h / 2) < 0.6 * (at.h / 2);
  if (good(await place())) return;
  const base = await page.locator("#controls").evaluate((el) => (Reflect.get(el, "controller") as { state: { yaw: number; tilt: number; zoom: number } }).state);
  for (const turn of [0, 20, -20, 40, -40, 60, -60, 80, -80, 100, -100, 120, -120, 140, -140, 160, 180]) {
    for (const tilt of [0, 10, -10, 20, -20]) {
      // through the page's own controls, which hold the view's state: a drag made later starts from it
      await page.locator("#controls").evaluate((el, view) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set(view, true, "set"), { yaw: base.yaw + turn, tilt: base.tilt + tilt, zoom: base.zoom });
      await advance(page, 200);
      if (good(await place())) return;
    }
  }
  throw new Error(`the ${from} could not be brought into the picture beside the ${to}`);
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
    // fixed to the stars first: the companion goes round the body in focus
    await setOn(page, "speed", DAY_SPEED);
    const stars = await walkPlaces(page, companion, days);
    await setOn(page, "speed", 0);
    console.log(`# GL walk ${focus} fixed to the stars, ${days} days: the ${companion} ${spread(stars) === Number.POSITIVE_INFINITY ? "left the picture" : `moved up to ${spread(stars).toFixed(0)} px in the picture`}`);
    expect(spread(stars), "fixed to the stars the companion leaves its place").toBeGreaterThan(100);
    // paired: the same arrival, the same days
    await arrive(page, companion, focus);
    await setOn(page, "pairWith", companion);
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
  await setOn(page, "pairWith", "sun");
  await setOn(page, "frame", "pair");
  await advance(page, 300);
  const told = (): Promise<{ frame: string; previous: string; pair: string | null }[]> => page.evaluate(() => Reflect.get(window, "__frames") as { frame: string; previous: string; pair: string | null }[]);
  expect((await told()).at(-1), "told when the pair began").toMatchObject({ frame: "pair", previous: "stars", pair: "sun" });
  // the reader turns the camera: the Sun moves in the picture, and then stays where it was moved to as the days pass
  const before = (await placeOf(page, "sun"))!;
  await setOn(page, "speed", DAY_SPEED);
  await advance(page, 3000);
  // the reader turns the camera by a few degrees (the other way if that would take the Sun out of the picture): the Sun moves in the picture
  const turn = (by: number) => page.locator("#controls").evaluate((el, delta) => {
    const controller = Reflect.get(el, "controller") as { state: { yaw: number; tilt: number }; set(view: unknown, final: boolean, reason: string): void };
    controller.set({ yaw: controller.state.yaw + delta }, true, "drag");
  }, by);
  await turn(10);
  await advance(page, 300);
  const inside = async (): Promise<{ x: number; y: number } | null> => {
    const at = await placeOf(page, "sun");
    const size = await page.locator(SPACE).evaluate((el) => ({ w: el.clientWidth, h: el.clientHeight }));
    return at !== null && at.x > 0 && at.x < size.w && at.y > 0 && at.y < size.h ? at : null;
  };
  let found = await inside();
  if (found === null) {
    await turn(-20);
    await advance(page, 300);
    found = await inside();
  }
  expect(found, "the Sun is still in the picture after the drag").not.toBeNull();
  const moved = found!;
  expect(Math.hypot(moved.x - before.x, moved.y - before.y), "the drag moved the Sun in the picture").toBeGreaterThan(30);
  expect((await frameOf(page)).frame, "a drag does not leave the pair").toBe("pair");
  const after = [{ x: moved.x, y: moved.y }, ...(await walkPlaces(page, "sun", 20))];
  await setOn(page, "speed", 0);
  console.log(`# GL walk a drag in the pair: the Sun moved ${Math.hypot(moved.x - before.x, moved.y - before.y).toFixed(0)} px and then stayed within ${spread(after).toFixed(1)} px for 20 days`);
  expect(spread(after), "the new framing is kept").toBeLessThanOrEqual(6);
  // a move that arrives with a companion (the Earth keeps its Moon): that body is the pair; one that arrives with none ends the pair
  await callOn(page, "goTo", "earth", { smooth: false });
  await advance(page, 500);
  const companion = ((await statsOf(page)) as unknown as { companion: string | null }).companion;
  expect(companion, "the Earth is arrived at with a companion").not.toBeNull();
  expect(await frameOf(page)).toEqual({ asked: "pair", frame: "pair", pair: companion });
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
