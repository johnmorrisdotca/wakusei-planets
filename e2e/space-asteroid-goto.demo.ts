// Going to an asteroid of `/asteroids` and riding along with one (MODULES-1354): `goTo(id)` and `ride(id)` take an asteroid's id with the option `asteroids` on, say what to do when it is off and what is wrong with an id that is
// none, and the camera really arrives (the asteroid is in the middle of the picture at the distance asked for, and stays so as the clock moves). Chromium, drawing in software; the time is held by the page's `t`, the test steps it, and
// every wait is on a draw.
import { expect, test, type Page } from "@playwright/test";
import { callCounted, callOn, drawnAfter, openSpace, quiet, SPACE, setCounted, statsOf } from "./space-ui.ts";
import { asteroidDistances, asteroidPosition } from "../src/asteroids.ts";
import { eclipticToScene } from "../src/space/frame.ts";
import { underLoad } from "./under-load.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page, browserName }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // CPU_THROTTLE=4 runs the whole file at a quarter of the speed
  await underLoad(page, browserName);
});

/** The moment held: Eros, Apophis and the other asteroids are where the table puts them; the clock does not run. */
const QUERY = "t=2026-11-02T14:00Z&scale=true&play=off";
/** The moment held. */
const T0 = Date.UTC(2026, 10, 2, 14);
const AU_KM = 149_597_870.7;

interface Sighted {
  id: string;
  kind: string;
  inView: boolean;
  x: number;
  y: number;
  distanceKm: number | null;
}
interface Riding {
  target: { id?: string };
  view: string;
  around: string;
  distanceKm: number;
}
const sightOf = async (page: Page): Promise<Sighted[]> => (await callOn(page, "sight")) as Sighted[];
const ridingOf = (page: Page): Promise<Riding | null> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "riding") as Riding | null);
/** Call a method that throws and say what it threw, in the page: the error's name and message. */
const thrownBy = (page: Page, method: string, ...args: unknown[]): Promise<{ name: string; message: string } | null> =>
  page.locator(SPACE).evaluate(
    (el, [m, a]) => {
      try {
        (Reflect.get(el, m as string) as (...x: unknown[]) => unknown).apply(el, a as unknown[]);
        return null;
      } catch (error) {
        return { name: (error as Error).name, message: (error as Error).message };
      }
    },
    [method, args] as const,
  );
/** Turn the option on and wait for the records to be placed. */
async function turnOn(page: Page): Promise<void> {
  const before = await setCounted(page, "asteroids", true);
  await drawnAfter(page, before, "the option");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { asteroids: { placed: number } }).asteroids.placed, { timeout: 60_000, message: "the asteroids are placed" }).toBe(104);
  await quiet(page);
}
/** Wait for a ride to be the one asked for and the move to it to be over, and the view to hold still. */
async function arrived(page: Page, id: string): Promise<void> {
  await expect.poll(async () => (await ridingOf(page))?.target.id, { timeout: 60_000, message: `riding ${id}` }).toBe(id);
  await expect.poll(async () => ((await statsOf(page)) as unknown as { travelling: unknown }).travelling, { timeout: 60_000, message: "the move is over" }).toBeNull();
  await quiet(page);
}
/** The asteroid's entry in the sight, once the draw that has it is in. */
async function sightedAsteroid(page: Page, id: string): Promise<Sighted> {
  await expect.poll(async () => (await sightOf(page)).some((one) => one.id === id && one.kind === "small-body"), { timeout: 60_000, message: `${id} is in the sight` }).toBe(true);
  return (await sightOf(page)).find((one) => one.id === id && one.kind === "small-body")!;
}

test("with the option off, goTo and ride of an asteroid's id throw an error that says to turn it on, and a name that is no asteroid goes on as it did", async ({ page }) => {
  await openSpace(page, QUERY);
  for (const [method, args] of [["goTo", ["eros"]], ["ride", ["eros"]], ["goTo", ["Eros", { smooth: false }]], ["goTo", ["asteroid:eros"]]] as const) {
    const error = await thrownBy(page, method, ...args);
    expect(error?.name, `${method}(${String(args[0])}) throws a RangeError`).toBe("RangeError");
    expect(error?.message, "and says which option to turn on").toMatch(/asteroid of \/asteroids.*option asteroids on/);
    expect(error?.message).toContain(`${method}(`);
  }
  // nothing moved, nothing was loaded for it
  expect(await ridingOf(page)).toBeNull();
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("earth");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "asteroids"))).toBe(false);
  // what is not an asteroid's id is as before: goTo says false, ride does nothing, a body is gone to
  expect(await page.locator(SPACE).evaluate((el) => (el as unknown as { goTo(id: string): boolean }).goTo("not-a-body"))).toBe(false);
  expect(await thrownBy(page, "ride", "not-a-body")).toBeNull();
  const before = await callCounted(page, "goTo", "mars", { smooth: false });
  await drawnAfter(page, before, "the move to Mars");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
});

test("with the option on, an id that is no body and no asteroid throws an error that says so, and a body still goes by name", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  for (const [method, args] of [["goTo", ["not-a-body"]], ["ride", ["not-a-body"]], ["goTo", ["asteroid:not-one"]], ["ride", ["asteroid:not-one"]]] as const) {
    const error = await thrownBy(page, method, ...args);
    expect(error?.name, `${method}(${String(args[0])}) throws a RangeError`).toBe("RangeError");
    expect(error?.message, "and says what is wrong").toMatch(/not a body of the view and not an asteroid of \/asteroids/);
  }
  expect(await ridingOf(page)).toBeNull();
  // a stage out from the Sun and a body are still gone to
  expect(await page.locator(SPACE).evaluate((el) => (el as unknown as { goTo(id: string, o: object): boolean }).goTo("whole-system", { smooth: false }))).toBe(true);
  expect(await page.locator(SPACE).evaluate((el) => (el as unknown as { goTo(id: string, o: object): boolean }).goTo("mars", { smooth: false }))).toBe(true);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
});

test("goTo(id) brings the camera to the asteroid: it is in the middle of the picture, at the distance asked for, at the true scale, and the move shows in riding", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed&play=off");
  await turnOn(page);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "scale")), "the view starts in the squeezed scale").toBe("compressed");
  const before = await callCounted(page, "goTo", "Eros", { smooth: false });
  await drawnAfter(page, before, "the move to Eros");
  await arrived(page, "eros");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "scale")), "the squeezed scale does not map a camera among the bodies: the view is at the true scale").toBe("true");
  const riding = (await ridingOf(page))!;
  expect([riding.view, riding.around]).toEqual(["follow", "sun"]);
  expect(riding.distanceKm, "a few times its measured size, at least 200 km").toBeGreaterThanOrEqual(200);
  const eros = await sightedAsteroid(page, "eros");
  const box = await page.locator(SPACE).boundingBox();
  expect(eros.inView).toBe(true);
  expect(Math.abs(eros.x - box!.width / 2), "in the middle across").toBeLessThan(box!.width * 0.02);
  expect(Math.abs(eros.y - box!.height / 2), "and in the middle down").toBeLessThan(box!.height * 0.02);
  expect(eros.distanceKm! / riding.distanceKm, "at the distance the ride keeps").toBeGreaterThan(0.95);
  expect(eros.distanceKm! / riding.distanceKm).toBeLessThan(1.05);
  // its name is on the picture: the asteroid is the nearest thing, so it is named
  await expect(page.locator(`${SPACE} .sp-label[data-body="asteroid:eros"]`)).toBeVisible();
  // the clock moves on and the camera goes with it: ten days later the asteroid is still in the middle at the same distance
  const step = await setCounted(page, "time", Date.UTC(2026, 10, 12, 14));
  await drawnAfter(page, step, "ten days on");
  await quiet(page);
  const later = await sightedAsteroid(page, "eros");
  expect(Math.abs(later.x - eros.x)).toBeLessThan(box!.width * 0.02);
  expect(Math.abs(later.y - eros.y)).toBeLessThan(box!.height * 0.02);
  expect(later.distanceKm! / eros.distanceKm!).toBeGreaterThan(0.99);
  expect(later.distanceKm! / eros.distanceKm!).toBeLessThan(1.01);
});

test("ride(id) puts the camera at the asteroid, looking at the Sun, and goTo of a body ends it", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  const before = await callCounted(page, "ride", "apophis", { smooth: false });
  await drawnAfter(page, before, "the ride");
  await arrived(page, "apophis");
  const riding = (await ridingOf(page))!;
  expect([riding.view, riding.around]).toEqual(["from", "sun"]);
  // the camera is at the asteroid (it is no entry of the sight, being the one ridden: the body ridden on is left out), looking down at the Sun: its forward direction is the way to the Sun from the asteroid
  const stats = (await statsOf(page)) as unknown as { camera: { forward: [number, number, number] } };
  const helio = eclipticToScene(asteroidPosition("apophis", T0));
  const toSun = helio.map((n) => -n / Math.hypot(...helio));
  const along = stats.camera.forward[0] * toSun[0]! + stats.camera.forward[1] * toSun[1]! + stats.camera.forward[2] * toSun[2]!;
  expect(along, "looking at the Sun").toBeGreaterThan(0.999);
  // and at the asteroid's own place: the Earth, a long way off, is where the Earth is from the asteroid (in the sight as a distance of about the asteroid's distance from it)
  await expect.poll(async () => (await sightOf(page)).some((one) => one.id === "earth"), { timeout: 60_000, message: "the Earth is in the sight" }).toBe(true);
  const earth = (await sightOf(page)).find((one) => one.id === "earth")!;
  const apophis = asteroidDistances("apophis", T0);
  expect(earth.distanceKm! / (apophis.earthAu * AU_KM), "the Earth is as far off as the asteroid is from it").toBeGreaterThan(0.99);
  expect(earth.distanceKm! / (apophis.earthAu * AU_KM)).toBeLessThan(1.01);
  const away = await callCounted(page, "goTo", "mars", { smooth: false });
  await drawnAfter(page, away, "the move to Mars");
  await quiet(page);
  expect(await ridingOf(page)).toBeNull();
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
});

test("europa and dione are moons first, and `asteroid:europa` is the asteroid", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  const moon = await callCounted(page, "goTo", "europa", { smooth: false });
  await drawnAfter(page, moon, "the move to the moon");
  await quiet(page);
  expect(await ridingOf(page), "europa is the moon").toBeNull();
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("europa");
  const asteroid = await callCounted(page, "goTo", "asteroid:Europa", { smooth: false });
  await drawnAfter(page, asteroid, "the move to the asteroid");
  await arrived(page, "europa");
  expect((await sightedAsteroid(page, "europa")).kind).toBe("small-body");
});

test("asked before the records are in, the move is made when they are", async ({ page }) => {
  await openSpace(page, QUERY);
  // the option and the move in one breath: the records are a file of their own, still to be fetched
  const asked = await page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { asteroids: boolean; goTo(id: string, o: object): boolean };
    space.asteroids = true;
    return space.goTo("eros", { smooth: false });
  });
  expect(asked, "goTo says the view can go there").toBe(true);
  await arrived(page, "eros");
});

test("asked before the records are in, a move asked for after it takes it back: the camera is not taken to the asteroid when they come", async ({ page }) => {
  await openSpace(page, QUERY);
  const asked = await page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { asteroids: boolean; goTo(id: string, o: object): boolean };
    space.asteroids = true;
    const first = space.goTo("eros", { smooth: false });
    return first && space.goTo("mars", { smooth: false });
  });
  expect(asked).toBe(true);
  // the records come (they are placed), and the camera stays at Mars
  await expect.poll(async () => ((await statsOf(page)) as unknown as { asteroids: { placed: number } }).asteroids.placed, { timeout: 60_000, message: "the asteroids are placed" }).toBe(104);
  await quiet(page);
  expect(await ridingOf(page)).toBeNull();
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
});

test("the squeezed scale, and turning the option off, take the camera back from the asteroid", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  const first = await callCounted(page, "goTo", "eros", { smooth: false });
  await drawnAfter(page, first, "the move to Eros");
  await arrived(page, "eros");
  const squeezed = await setCounted(page, "scale", "compressed");
  await drawnAfter(page, squeezed, "the squeezed scale");
  await quiet(page);
  expect(await ridingOf(page), "a camera among the bodies needs the true scale").toBeNull();
  const again = await callCounted(page, "goTo", "eros", { smooth: false });
  await drawnAfter(page, again, "the move to Eros again");
  await arrived(page, "eros");
  const off = await setCounted(page, "asteroids", false);
  await drawnAfter(page, off, "the option turned off");
  await quiet(page);
  expect(await ridingOf(page), "the asteroid is gone, so the camera is back where it was").toBeNull();
  expect(await thrownBy(page, "goTo", "eros")).toMatchObject({ name: "RangeError" });
});
