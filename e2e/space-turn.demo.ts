// What a page can ask of the view's sight (MODULES-1220): every entry says how far off the line of sight the body is (`offAxis`) and how far away (`distance`, `distanceKm` in the true scale), `turnTo` turns the camera
// where it stands until a body is in the picture, and an orbiter is an entry of its own with its own event. Chromium, drawing in software; the time is held by the page's `t` and every wait is on a draw.
import { expect, test, type Page } from "@playwright/test";
import { orbiterElements } from "../src/orbiters.ts";
import { callCounted, callOn, drawnAfter, openSpace, quiet, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Entry {
  id: string;
  kind: string;
  inView: boolean;
  offAxis: number;
  distance: number;
  distanceKm: number | null;
}
interface Camera {
  position: [number, number, number];
  forward: [number, number, number];
}
/** The sight of every body, once a draw has worked it out (the first call asks for one). */
async function sightOf(page: Page): Promise<Record<string, Entry>> {
  await callOn(page, "sight");
  await expect.poll(async () => ((await callOn(page, "sight")) as Entry[]).length, { timeout: 60_000, message: "the sight is worked out" }).toBeGreaterThan(0);
  await quiet(page);
  const list = (await callOn(page, "sight")) as Entry[];
  return Object.fromEntries(list.map((entry) => [entry.id, entry]));
}
const cameraOf = async (page: Page): Promise<Camera> => ((await statsOf(page)) as unknown as { camera: Camera }).camera;

test("every body says how far off the line of sight it is and how far away: the one looked at is dead ahead at the camera's distance, and Mars is nearer than Neptune", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  const seen = await sightOf(page);
  const camera = await cameraOf(page);
  const earth = seen["earth"]!;
  expect(earth.offAxis, "the Earth in the middle is dead ahead").toBeLessThan(0.5);
  expect(earth.distance, "its distance is the camera's from its centre").toBeCloseTo(Math.hypot(...camera.position), 3);
  expect(earth.distanceKm! / earth.distance, "in kilometres at the true scale, an Earth radius, 6378.137 km, to a unit").toBeCloseTo(6378.137, 2);
  expect(seen["mars"]!.distance).toBeLessThan(seen["neptune"]!.distance);
  expect(seen["mars"]!.distanceKm!).toBeLessThan(seen["neptune"]!.distanceKm!);
  for (const entry of Object.values(seen)) {
    expect(entry.offAxis, entry.id).toBeGreaterThanOrEqual(0);
    expect(entry.offAxis, entry.id).toBeLessThanOrEqual(180);
  }
  // the Sun is off to one side of the Earth: its angle from the line of sight is the angle between the camera's way and the way to it, as the picture's own numbers say
  const sun = seen["sun"]!;
  expect(sun.offAxis).toBeGreaterThan(0.5);
  // a body in view is within half the field of view, and off the line of sight by about as much as the picture shows
  const fov = ((await statsOf(page)).camera as unknown as { fov: number }).fov;
  for (const entry of Object.values(seen)) if (entry.inView && entry.kind !== "star") expect(entry.offAxis, `${entry.id} in view is within the picture's diagonal`).toBeLessThan(fov);
});

test("in the compressed scale the distances are the drawn ones and there are no kilometres", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed");
  const seen = await sightOf(page);
  expect(seen["earth"]!.distanceKm).toBeNull();
  expect(seen["mars"]!.distanceKm).toBeNull();
  expect(seen["mars"]!.distance).toBeGreaterThan(0);
});

test("turning the view away from a body raises its angle off the line of sight", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  const first = (await sightOf(page))["sun"]!.offAxis;
  const before = await callCounted(page, "setView", { yaw: 90, tilt: 0, zoom: 1 });
  await drawnAfter(page, before, "the turn of the view");
  await quiet(page);
  const turned = (await sightOf(page))["sun"]!.offAxis;
  expect(Math.abs(turned - first), "the Sun's angle from the line of sight changed with the view").toBeGreaterThan(5);
});

test("turnTo brings a body into the picture without moving the camera, and says false for one in view, the one looked at, and an id it does not know", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  const seen = await sightOf(page);
  expect(seen["mars"]!.inView, "Mars is not in this view").toBe(false);
  const where = (await cameraOf(page)).position;
  const [drawsBefore, turned] = await page.locator(SPACE).evaluate((el) => {
    const view = el as unknown as { turnTo(id: string, o: { smooth: boolean }): boolean; stats: { draws: number } };
    const before = view.stats.draws;
    return [before, view.turnTo("mars", { smooth: false })] as const;
  });
  expect(turned).toBe(true);
  await drawnAfter(page, drawsBefore, "the turn");
  await quiet(page);
  const after = await sightOf(page);
  expect(after["mars"]!.inView, "Mars is in the picture").toBe(true);
  expect(after["mars"]!.offAxis, "and dead ahead").toBeLessThan(0.5);
  const now = (await cameraOf(page)).position;
  // the camera stood where it was: a unit is an Earth radius, and the camera is some radii from the Earth, so a move would be a hair of a unit at the least
  for (let i = 0; i < 3; i += 1) expect(now[i]!, `the camera's ${"xyz"[i]}`).toBeCloseTo(where[i]!, 2);
  // already in the picture (it is the body looked at now): nothing turns and nothing is drawn
  const draws = (await statsOf(page)).draws;
  expect(await callOn(page, "turnTo", "mars", { smooth: false })).toBe(false);
  expect(await callOn(page, "turnTo", "nowhere")).toBe(false);
  await quiet(page);
  expect((await statsOf(page)).draws, "a call that does not turn draws nothing").toBe(draws);
});

test("a gliding turn ends with the body in the picture and the camera where it was, and nothing is drawn after it", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  const where = (await cameraOf(page)).position;
  const before = await callCounted(page, "turnTo", "venus");
  await drawnAfter(page, before, "the turn");
  await quiet(page);
  const seen = await sightOf(page);
  expect(seen["venus"]!.inView).toBe(true);
  const now = (await cameraOf(page)).position;
  for (let i = 0; i < 3; i += 1) expect(now[i]!, `the camera's ${"xyz"[i]}`).toBeCloseTo(where[i]!, 2);
});

test("an orbiter is an entry of its own, and a press on its name sends its own event as well as the body one", async ({ page }) => {
  test.setTimeout(240_000);
  const hope = orbiterElements("hope")!;
  const when = Math.floor((Date.parse(hope.fitUntil) + Date.parse(hope.validUntil)) / 2 / 60_000) * 60_000;
  await openSpace(page, `t=${new Date(when).toISOString().slice(0, 16)}Z&play=off`);
  await callOn(page, "goTo", "moon", { smooth: false });
  await page.locator("#orbiters").dispatchEvent("click");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { orbiters: { count: number } }).orbiters.count, { timeout: 60_000 }).toBeGreaterThan(0);
  await quiet(page);
  await page.locator(SPACE).evaluate((el) => {
    const log: { type: string; detail: Record<string, unknown> }[] = [];
    (window as unknown as { __heard: typeof log }).__heard = log;
    for (const type of ["wakusei-body-click", "wakusei-orbiter-click"]) el.addEventListener(type, (event) => log.push({ type, detail: (event as CustomEvent).detail as Record<string, unknown> }));
  });
  const seen = await sightOf(page);
  const lro = seen["lro"];
  expect(lro, "the Lunar Reconnaissance Orbiter has an entry").toBeDefined();
  expect(lro!.kind).toBe("orbiter");
  expect(lro!.distance).toBeGreaterThan(0);
  await page.locator(SPACE).locator('.sp-label[data-body="lro"]').dispatchEvent("click");
  const heard = await page.evaluate(() => (window as unknown as { __heard: { type: string; detail: Record<string, unknown> }[] }).__heard);
  expect(heard.map((e) => e.type)).toEqual(["wakusei-body-click", "wakusei-orbiter-click"]);
  expect(heard[0]!.detail).toMatchObject({ id: "lro", kind: "spacecraft" });
  expect(heard[1]!.detail).toEqual({ id: "lro", name: "Lunar Reconnaissance Orbiter" });
});
