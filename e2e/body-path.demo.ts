// `pathOf` says where a body goes over a stretch of time, on the screen, in the view's own scale and from its camera (MODULES-1790). Held against the view's own drawing of the body: the path's ends and middle are
// where the Moon is drawn at those moments (the clock is set to each and the view draws), and a fortnight of the Moon is a ring round the Earth that turns half way (the Moon's period is 27.32 days).
import "./load.ts";
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

type Point = { ms: number; x: number; y: number; behind: boolean };
type Space = HTMLElement & {
  body: string;
  time: number;
  placeOf(id: string): { x: number; y: number; r: number } | null;
  pathOf(id: string, from: number, to: number, options?: { steps?: number; about?: string | null }): Point[];
  stats: { draws: number };
};

const DAY = 86_400_000;
const START = Date.parse("2026-11-02T14:00Z");
const PICTURES = process.env.PATH_PICTURES;

async function open(page: import("@playwright/test").Page, query: string) {
  await page.goto(`/wakusei-planets/space.html?t=2026-11-02T14:00Z&speed=0&scale=compressed&${query}`);
  const view = page.locator("wakusei-space[data-state=live]");
  await view.waitFor({ timeout: 90_000 });
  await view.scrollIntoViewIfNeeded();
  await expect.poll(() => view.evaluate((el) => (el as Space).placeOf("earth")?.r ?? 0), { timeout: 60_000 }).toBeGreaterThan(5);
  return view;
}

/** Set the clock to a moment and wait for the view to draw it. */
async function drawAt(view: import("@playwright/test").Locator, ms: number) {
  const before = await view.evaluate((el, at) => { const space = el as Space; const draws = space.stats.draws; space.time = at; return draws; }, ms);
  await expect.poll(() => view.evaluate((el) => (el as Space).stats.draws), { timeout: 30_000 }).toBeGreaterThan(before);
  // the view settles on the moment over a few frames: wait until the Moon is where it stays
  let last = "";
  await expect.poll(async () => {
    const now = await view.evaluate((el) => { const p = (el as Space).placeOf("moon"); return p ? `${p.x.toFixed(0)},${p.y.toFixed(0)}` : "none"; });
    const same = now === last;
    last = now;
    return same;
  }, { timeout: 30_000, intervals: [400] }).toBe(true);
}

test("the Moon's fortnight is a ring round the Earth, and where the path says the Moon is is where the view draws it", async ({ page }, info) => {
  test.setTimeout(150_000);
  const view = await open(page, "frame=stars"); // the camera held to the stars: it does not turn with the Earth as the clock moves, so the drawn Moon at each moment can be held against the path asked for once
  await view.evaluate((el) => { (el as Space).body = "earth"; });
  await expect.poll(() => view.evaluate((el) => (el as Space).placeOf("moon") !== null), { timeout: 30_000 }).toBe(true);
  const path = await view.evaluate((el, at) => (el as Space).pathOf("moon", at - 7 * 86_400_000, at + 7 * 86_400_000), START);
  expect(path.length, "96 steps and the two ends").toBe(97);
  expect(path.every((p) => !p.behind && Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true);
  expect(path[0]!.ms).toBe(START - 7 * DAY);
  expect(path[96]!.ms).toBe(START + 7 * DAY);
  // a ring round the Earth (the camera's tilt flattens it, but it still goes round the Earth's place): a fortnight is about half of the 27.32 days it takes
  const earth = await view.evaluate((el) => (el as Space).placeOf("earth")!);
  const polar = path.map((p) => ({ d: Math.hypot(p.x - earth.x, p.y - earth.y), a: Math.atan2(p.y - earth.y, p.x - earth.x) }));
  let swept = 0;
  for (let i = 1; i < polar.length; i++) swept += Math.atan2(Math.sin(polar[i]!.a - polar[i - 1]!.a), Math.cos(polar[i]!.a - polar[i - 1]!.a));
  const degrees = (Math.abs(swept) * 180) / Math.PI;
  expect(degrees, "a fortnight is 14 / 27.32 of a turn: about 184 degrees (the view's tilt bends it a little)").toBeGreaterThan(150);
  expect(degrees).toBeLessThan(215);
  // a path is of the view as it is now (the camera above the Earth's longitude 0 turns with the Earth as the clock moves), so it is held against the drawn Moon at the moment the clock is set to: the middle of the path
  // asked for then is where the view draws the Moon, wherever in its month it is
  for (const at of [START - 7 * DAY, START - 3.5 * DAY, START, START + 3.5 * DAY, START + 7 * DAY]) {
    await drawAt(view, at);
    const there = await view.evaluate((el, ms) => ({ drawn: (el as Space).placeOf("moon"), path: (el as Space).pathOf("moon", ms - 7 * 86_400_000, ms + 7 * 86_400_000) }), at);
    expect(there.drawn, "the Moon is drawn").not.toBeNull();
    const miss = Math.hypot(there.drawn!.x - there.path[48]!.x, there.drawn!.y - there.path[48]!.y);
    expect(miss, `the middle of the path is the drawn Moon at ${new Date(at).toISOString()} (${miss.toFixed(1)} px)`).toBeLessThan(2);
  }
  // the Moon's sidereal month is 27.3217 days: a path that long closes on itself (its ends meet), and half a month later it is on the far side of the Earth
  await drawAt(view, START);
  const month = await view.evaluate((el, ms) => (el as Space).pathOf("moon", ms, ms + 27.321661 * 86_400_000, { steps: 96 }), START);
  const extent = Math.max(...month.map((p) => Math.hypot(p.x - month[0]!.x, p.y - month[0]!.y)));
  expect(Math.hypot(month[96]!.x - month[0]!.x, month[96]!.y - month[0]!.y), "a sidereal month closes the ring").toBeLessThan(extent * 0.08);
  if (PICTURES) {
    mkdirSync(PICTURES, { recursive: true });
    await drawAt(view, START);
    await page.locator('#gotos [data-goto="moon"]').click(); // the Moon's own view: its orbit and the Earth in the picture
    await page.waitForTimeout(1500);
    await page.locator("#track").click();
    await page.waitForTimeout(1200);
    await page.locator(".track-layer circle").first().waitFor({ timeout: 10_000 });
    await view.screenshot({ path: join(PICTURES, `body-path-moon-${info.project.name}.png`) });
    const dots = await page.locator(".track-layer circle").count();
    expect(dots, "the demo draws the path as dots").toBeGreaterThan(40);
  }
});

test("steps are kept to 1 to 512, an unplaced body gives nothing, and the path is the body's own without `about`", async ({ page }) => {
  test.setTimeout(120_000);
  const view = await open(page, "");
  const counts = await view.evaluate((el) => {
    const space = el as Space;
    const a = space.time;
    return {
      many: space.pathOf("mars", a, a + 86_400_000, { steps: 5000 }).length,
      one: space.pathOf("mars", a, a + 86_400_000, { steps: 0 }).length,
      none: space.pathOf("not-a-body", a, a + 86_400_000).length,
      bad: space.pathOf("moon", Number.NaN, a).length,
    };
  });
  expect(counts).toEqual({ many: 513, one: 2, none: 0, bad: 0 });
  // Io round Jupiter: a ring round the planet by default; `about: null` is the line Io itself goes (the planet moves meanwhile)
  await view.evaluate((el) => { (el as Space).body = "jupiter"; });
  await expect.poll(() => view.evaluate((el) => (el as Space).placeOf("io") !== null || (el as Space).placeOf("jupiter") !== null), { timeout: 30_000 }).toBe(true);
  const both = await view.evaluate((el) => {
    const space = el as Space;
    const a = space.time;
    const ring = space.pathOf("io", a, a + 3 * 86_400_000, { steps: 24 });
    const free = space.pathOf("io", a, a + 3 * 86_400_000, { steps: 24, about: null });
    return { ring: ring.length, free: free.length, same: ring.every((p, i) => Math.abs(p.x - free[i]!.x) < 1e-6 && Math.abs(p.y - free[i]!.y) < 1e-6) };
  });
  expect(both.ring).toBe(25);
  expect(both.free).toBe(25);
  expect(both.same, "Jupiter moves over three days, so the free path is not the ring").toBe(false);
});
