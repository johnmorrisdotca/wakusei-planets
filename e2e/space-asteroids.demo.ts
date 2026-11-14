// The asteroids of `/asteroids` in the space view (MODULES-1353): the option `asteroids` places the 104 bodies as points with the belts' (one instanced draw), names the few within about an astronomical unit of the camera, makes
// each an entry of `sight()` and a name that can be pressed (`wakusei-body-click`, `wakusei-asteroid-click`), and costs nothing while it is off. Chromium, drawing in software; the time is held by the page's `t` and every wait is
// on a draw.
import { expect, test, type Page } from "@playwright/test";
import { ASTEROIDS } from "../src/asteroids.ts";
import { callOn, drawnAfter, openSpace, quiet, SPACE, setCounted, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

/** The moment held: on it four asteroids (Duende, Cruithne, Itokawa, Kamo`oalewa) are within an astronomical unit of the Earth, and so of the camera above it. */
const QUERY = "t=2026-11-02T14:00Z&scale=true&play=off";

interface AsteroidStats {
  placed: number;
  named: number;
  ms: number;
}
const asteroidsOf = async (page: Page): Promise<AsteroidStats> => ((await statsOf(page)) as unknown as { asteroids: AsteroidStats }).asteroids;
const doorPoints = async (page: Page): Promise<number> => ((await statsOf(page)) as unknown as { door: { points: number } }).door.points;
const sightKinds = async (page: Page): Promise<Record<string, number>> => {
  await callOn(page, "sight");
  await expect.poll(async () => ((await callOn(page, "sight")) as unknown[]).length, { timeout: 60_000, message: "the sight is worked out" }).toBeGreaterThan(0);
  const list = (await callOn(page, "sight")) as { id: string; kind: string }[];
  const kinds: Record<string, number> = {};
  for (const entry of list) kinds[entry.kind] = (kinds[entry.kind] ?? 0) + 1;
  return kinds;
};
/** Turn the option on and wait for the records to be loaded and drawn. */
async function turnOn(page: Page): Promise<void> {
  const before = await setCounted(page, "asteroids", true);
  await drawnAfter(page, before, "the option");
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000, message: "the asteroids are placed" }).toBe(ASTEROIDS.length);
  await quiet(page);
}

test("with the option off (the default) nothing is placed, named, in the sight or in the instanced draw, and the records are not loaded", async ({ page }) => {
  const asked: string[] = [];
  page.on("request", (request) => asked.push(request.url()));
  await openSpace(page, QUERY);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "asteroids"))).toBe(false);
  expect(await asteroidsOf(page)).toEqual({ placed: 0, named: 0, ms: 0 });
  expect((await sightKinds(page))["small-body"]).toBeUndefined();
  expect(await page.locator(`${SPACE} .sp-label[data-body="duende"]`).count()).toBe(0);
  // not even the chunk with the records was fetched
  expect(asked.filter((url) => /asteroids/.test(url) && url.endsWith(".js")), "no asteroid chunk was asked for").toEqual([]);
});

test("with the option on all 104 are placed with the belts' points, the ones near the camera are named, each is an entry of sight() with kind small-body, and turning it off takes them all away", async ({ page }) => {
  await openSpace(page, QUERY);
  const pointsBefore = await doorPoints(page);
  await turnOn(page);
  const on = await asteroidsOf(page);
  expect(on.placed).toBe(104);
  expect(on.named, "Duende, Cruithne, Itokawa and Kamo`oalewa are within an astronomical unit of the Earth on this date, and at most twelve are named").toBeGreaterThanOrEqual(4);
  expect(on.named).toBeLessThanOrEqual(12);
  expect(await doorPoints(page), "the bodies are drawn in the one instanced draw, with the other points").toBe(pointsBefore + 104);
  expect((await sightKinds(page))["small-body"]).toBe(104);
  // the names are buttons of the view's own, for the ones in front of the camera (one behind it has no place on the screen); Duende, nearest on this date, is one
  await expect(page.locator(`${SPACE} .sp-label[data-body="duende"]`)).toBeVisible();
  const shown = await page.locator(`${SPACE} .sp-label:not([hidden])`).evaluateAll((els, ids) => els.filter((el) => ids.includes((el as HTMLElement).dataset["body"]!)).length, ASTEROIDS.map((one) => one.id));
  expect(shown, "no more names than the named").toBeLessThanOrEqual(on.named);
  expect(shown).toBeGreaterThanOrEqual(1);
  expect(await page.locator(`${SPACE} .sp-label[data-body="eros"]`).isVisible(), "Eros is too far to be named").toBe(false);
  // off again
  const before = await setCounted(page, "asteroids", false);
  await drawnAfter(page, before, "the option turned off");
  await quiet(page);
  expect(await asteroidsOf(page)).toEqual({ placed: 0, named: 0, ms: 0 });
  expect((await sightKinds(page))["small-body"]).toBeUndefined();
  expect(await doorPoints(page)).toBe(pointsBefore);
  expect(await page.locator(`${SPACE} .sp-label[data-body="duende"]`).isVisible()).toBe(false);
});

test("a press on an asteroid's name says which it is, in the body event and in the asteroid event, and the camera stays where it is", async ({ page }) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  await page.locator(SPACE).evaluate((el) => {
    const log: { type: string; detail: Record<string, unknown> }[] = [];
    (window as unknown as { __heard: typeof log }).__heard = log;
    for (const type of ["wakusei-body-click", "wakusei-asteroid-click", "wakusei-body-select"]) el.addEventListener(type, (event) => log.push({ type, detail: (event as CustomEvent).detail as Record<string, unknown> }));
  });
  const camera = ((await statsOf(page)) as unknown as { camera: { position: number[] } }).camera.position;
  await page.locator(`${SPACE} .sp-label[data-body="duende"]`).dispatchEvent("click");
  const heard = await page.evaluate(() => (window as unknown as { __heard: { type: string; detail: Record<string, unknown> }[] }).__heard);
  expect(heard.map((event) => event.type), "the body event and the asteroid's own, and no selection").toEqual(["wakusei-body-click", "wakusei-asteroid-click"]);
  expect(heard[0]!.detail).toEqual({ id: "duende", name: "Duende", kind: "small-body" });
  expect(heard[1]!.detail).toEqual({ id: "duende", name: "Duende" });
  // a second press goes nowhere either: going to an asteroid is not part of the option
  await page.locator(`${SPACE} .sp-label[data-body="duende"]`).dispatchEvent("click");
  await quiet(page);
  expect(await page.locator(SPACE).evaluate((el) => [Reflect.get(el, "body"), Reflect.get(el, "lookingAt")])).toEqual(["earth", null]);
  const now = ((await statsOf(page)) as unknown as { camera: { position: number[] } }).camera.position;
  for (let i = 0; i < 3; i += 1) expect(now[i]!).toBeCloseTo(camera[i]!, 6);
});

test("the names are in the page's language, and the option reads its attribute", async ({ page }) => {
  await openSpace(page, QUERY);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await page.locator(SPACE).evaluate((el) => el.setAttribute("asteroids", ""));
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000 }).toBe(ASTEROIDS.length);
  await quiet(page);
  const ja = ASTEROIDS.find((one) => one.id === "duende")!.name.ja;
  await expect(page.locator(`${SPACE} .sp-label[data-body="duende"]`)).toContainText(ja);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("asteroids", "off"));
  await expect.poll(async () => (await asteroidsOf(page)).placed, { timeout: 60_000 }).toBe(0);
});

test("placing the asteroids costs a few milliseconds a draw, measured, and nothing is drawn at rest", async ({ page }, testInfo) => {
  await openSpace(page, QUERY);
  await turnOn(page);
  // the figure in the guide is this run, with the CPU at a quarter of its speed, so a slow machine takes longer and the number stays a number
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  // fifty draws, one for each step of the held clock, and the cost the view reports of placing the bodies at each
  const costs: number[] = [];
  for (let i = 0; i < 50; i += 1) {
    const before = await setCounted(page, "time", Date.UTC(2026, 10, 2, 14) + (i + 1) * 3_600_000);
    await drawnAfter(page, before, `step ${i}`);
    costs.push((await asteroidsOf(page)).ms);
  }
  costs.sort((a, b) => a - b);
  const median = costs[25]!;
  const worst = costs[49]!;
  testInfo.annotations.push({ type: "cost", description: `placing 104 asteroids: median ${median.toFixed(2)} ms, worst ${worst.toFixed(2)} ms over 50 draws` });
  console.log(`placing 104 asteroids: median ${median.toFixed(2)} ms, worst ${worst.toFixed(2)} ms over 50 draws`);
  expect(median, "the median cost of placing them is a few milliseconds").toBeLessThan(8);
  await session.detach();
  // at rest: no draw is made while nothing changes
  await quiet(page);
  const held = (await statsOf(page)).draws;
  await expect.poll(async () => (await statsOf(page)).draws, { timeout: 2_000, intervals: [500], message: "no draw at rest" }).toBe(held);
});
