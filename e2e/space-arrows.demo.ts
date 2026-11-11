// The arrows of the space view (MODULES-857): small arrows on an orbit line point the way the body goes, whichever way the clock runs, and the help mode draws on the body looked at the line of its axis and a curved
// arrow for the way it spins, right for the Earth, Venus and Uranus. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { BODIES } from "../src/facts.ts";
import { fromRaDec, toScene } from "./vec-scene.ts";
import { callOn, openSpace, setOn, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type V = [number, number, number];
interface Arrow {
  position: V;
  direction: V;
}
interface Seen {
  time: number;
  arrows: Record<string, Arrow[]>;
  help: { body: string; axis: V; pole: V; retrograde: boolean; arcTurn: V } | null;
}
const seen = async (page: Page): Promise<Seen> => (await statsOf(page)) as unknown as Seen;
const dot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const minus = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V): V => {
  const l = Math.hypot(...a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const DAY = 86_400_000;

/** The way a body goes round, as its angular momentum about the centre of its line, from where the library puts it a day before and a day after the moment. */
async function momentum(id: string, time: number, scale: "true" | "compressed"): Promise<{ about: V; direction: V }> {
  const { frameAt, placeAround, placeSun, planetOrbit, placeMoon } = await import("../src/space/index.ts");
  const frame = frameAt(time);
  const sun = placeSun(scale, frame.sun) as V;
  if (id === "moon") {
    const before = placeMoon(scale, frameAt(time - DAY / 4).moon) as V;
    const after = placeMoon(scale, frameAt(time + DAY / 4).moon) as V;
    const now = placeMoon(scale, frame.moon) as V;
    return { about: [0, 0, 0], direction: unit(cross(now, minus(after, before))) };
  }
  const at = (t: number): V => placeAround(scale, sun, planetOrbit(id as "earth", t, 1)[0]!) as V;
  return { about: sun, direction: unit(cross(minus(at(time), sun), minus(at(time + DAY), at(time - DAY)))) };
}

for (const scale of ["true", "compressed"] as const) {
  test(`${scale} scale: every orbit line has its arrows, and on the Earth's, Venus's, Uranus's and the Moon's every arrow points the way the body goes, with the clock running either way`, async ({ page }) => {
    test.setTimeout(240_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}`);
    // seen from afar: close to a body only its own system's lines are drawn
    await page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void; zoomFor(p: string): number }).setView({ yaw: 0, tilt: 0, zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") }));
    await settle(page, 800);
    for (const speed of [0, -86400]) {
      await setOn(page, "speed", speed);
      await settle(page, speed === 0 ? 500 : 1500);
      const now = await seen(page);
      expect(Object.keys(now.arrows).length, "an orbit line each for the Earth, the planets, the dwarf planets, the minor bodies and the Moon").toBe(23);
      for (const list of Object.values(now.arrows)) expect(list.length).toBe(6);
      for (const id of ["earth", "venus", "uranus", "moon"]) {
        const { about, direction } = await momentum(id, now.time, scale);
        for (const arrow of now.arrows[id]!) {
          const sense = dot(unit(cross(minus(arrow.position, about), arrow.direction)), direction);
          expect(sense, `${id}: an arrow at ${speed === 0 ? "rest" : "reverse"} points with the body's own way of going`).toBeGreaterThan(0.5);
        }
      }
    }
  });
}

test("the arrows are small in pixels and never hide a body: they are drawn in screen size at any zoom", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed");
  const lengthAt = async (zoom: number): Promise<number> => {
    await page.locator(SPACE).evaluate((el, z) => (el as unknown as { setView(v: unknown): void }).setView({ yaw: 0, tilt: 0, zoom: z }), zoom);
    await settle(page, 700);
    return ((await statsOf(page)) as unknown as { arrowPx: number }).arrowPx;
  };
  // the element reports an arrowhead's length on the screen: the same at every zoom, and a few pixels
  const near = await lengthAt(1);
  const far = await lengthAt(0.01);
  expect(near).toBeGreaterThan(3);
  expect(near).toBeLessThan(14);
  expect(Math.abs(far - near)).toBeLessThan(2);
});

test("help mode is off by default, and on it draws the axis and the spin arrow on the body looked at: the Earth turns about its north pole, Venus and Uranus the other way about theirs", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z");
  expect((await seen(page)).help, "off by default").toBeNull();
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "help"))).toBe(false);
  await setOn(page, "help", true);
  for (const id of ["earth", "venus", "uranus", "mars", "jupiter"] as const) {
    await callOn(page, "goTo", id, { smooth: false });
    await expect.poll(async () => (await seen(page)).help?.body, { timeout: 30_000 }).toBe(id);
    const help = (await seen(page)).help!;
    // what the data says: the body turns about its pole by the right-hand rule when its meridian's rate is positive, and about the opposite way when it is negative
    const f = BODIES[id];
    const pole = toScene(fromRaDec(f.pole.ra, f.pole.dec)) as V;
    const expected = f.prime.rate >= 0 ? pole : ([-pole[0], -pole[1], -pole[2]] as V);
    expect(dot(help.axis, expected), `${id}: the axis it spins about`).toBeGreaterThan(0.999);
    expect(dot(help.arcTurn, expected), `${id}: the arrow drawn turns that way`).toBeGreaterThan(0.99);
    expect(help.retrograde, id).toBe(f.prime.rate < 0);
    expect(Math.abs(dot(help.pole, pole)), `${id}: the line is along its poles`).toBeGreaterThan(0.999);
  }
  // the Earth turns eastward: its axis is the north pole, up in the scene
  await callOn(page, "goTo", "earth", { smooth: false });
  await expect.poll(async () => (await seen(page)).help?.body).toBe("earth");
  expect((await seen(page)).help!.axis[1]).toBeGreaterThan(0.9);
  await setOn(page, "help", false);
  await settle(page, 500);
  expect((await seen(page)).help).toBeNull();
});
