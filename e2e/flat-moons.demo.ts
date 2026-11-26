// The moons on their planet's flat map in a real browser: the `moons` attribute and the chip, each moon named and pressable, its track, the key, Japanese, and the phone.
import "./load.ts";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { flatMoons } from "../src/flat/index.ts";

type Flat = HTMLElement & {
  stats: { draws: number; custom: number; names: { id: string; kind: "place" | "mark" | "grid"; x0: number; y0: number; x1: number; y1: number }[] };
  placeOf(id: string): { x: number; y: number; lon: number; lat: number } | null;
  selected: string | null;
  center: number;
  marks: { id: string; group: string }[];
};

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ viewport }, info) => {
  test.skip((viewport?.width ?? 1280) < 500 && !info.title.startsWith("a phone"), "read on a desktop screen: the phone's own test is below");
});

const flat = (page: Page): Locator => page.locator("wakusei-flat#flat");
const custom = (page: Page): Promise<number> => flat(page).evaluate((el) => (el as Flat).stats.custom);
const settled = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done)))));
const open = async (page: Page, query: string): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/wakusei-planets/flat.html${query}`);
  await expect(flat(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(async () => flat(page).evaluate((el) => (el as Flat).stats.draws)).toBeGreaterThan(0);
  await flat(page).locator(".dots").scrollIntoViewIfNeeded();
  await flat(page).evaluate((el) => {
    el.setAttribute("speed", "0");
    el.setAttribute("time", "2026-11-23T12:00:00Z");
  });
  await settled(page);
  return errors;
};
const listen = (page: Page): Promise<void> =>
  flat(page).evaluate((el) => {
    Reflect.set(window, "__picks", []);
    el.addEventListener("wakusei-flat-pick", (event) => (Reflect.get(window, "__picks") as unknown[]).push((event as CustomEvent).detail));
  });
const picks = (page: Page): Promise<{ kind: string | null; id: string | null; name: string | null; via: string; mark?: { group: string; data: { moon: string; distanceKm: number } } }[]> => page.evaluate(() => Reflect.get(window, "__picks"));

test("Mars and Jupiter: the moons are off until the chip or the attribute asks, then each is marked over its place, named, in the key, and the chip puts them away again", async ({ page }) => {
  const errors = await open(page, "?body=jupiter");
  expect(await custom(page)).toBe(0);
  const chip = flat(page).locator('.chip[data-layer="moons"]');
  await expect(chip).toContainText("Moons");
  await expect(chip).toContainText("6");
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await flat(page).evaluate((el) => {
    Reflect.set(window, "__filters", []);
    el.addEventListener("wakusei-flat-filter", (event) => (Reflect.get(window, "__filters") as unknown[]).push((event as CustomEvent).detail));
  });
  await chip.click();
  await expect.poll(() => custom(page)).toBeGreaterThanOrEqual(5);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  expect(await flat(page).evaluate((el) => (el as Flat).marks.length)).toBe(0);
  for (const id of ["io", "europa", "ganymede", "callisto"]) expect(await flat(page).evaluate((el, who) => (el as Flat).placeOf(who) !== null, id), id).toBe(true);
  expect(await page.evaluate(() => (Reflect.get(window, "__filters") as { moons: boolean }[]).at(-1)!.moons)).toBe(true);
  await expect(page).toHaveURL(/moons=1/);
  expect(await flat(page).locator(".legend li").allInnerTexts()).toEqual(expect.arrayContaining([expect.stringContaining("A moon, over the place")]));
  await chip.click();
  await expect.poll(() => custom(page)).toBe(0);
  expect(errors).toEqual([]);
  // the attribute alone asks too: some ids, all, or off
  await flat(page).evaluate((el) => el.setAttribute("moons", "io,europa"));
  await expect.poll(() => custom(page)).toBe(2);
  await flat(page).evaluate((el) => el.setAttribute("moons", ""));
  await expect.poll(() => custom(page)).toBeGreaterThanOrEqual(5);
  await flat(page).evaluate((el) => el.setAttribute("moons", "off"));
  await expect.poll(() => custom(page)).toBe(0);
});

test("a body with no moon has no chip, and the Moon of the Earth is on the Earth's map", async ({ page }) => {
  await open(page, "?body=mercury");
  await expect(flat(page).locator('.chip[data-layer="moons"]')).toHaveCount(0);
  await flat(page).evaluate((el) => el.setAttribute("moons", ""));
  await settled(page);
  expect(await custom(page)).toBe(0);
  await flat(page).evaluate((el) => el.setAttribute("body", "earth"));
  await expect(flat(page).locator('.chip[data-layer="moons"]')).toContainText("1");
  await expect.poll(() => custom(page)).toBe(1);
  expect(await flat(page).evaluate((el) => (el as Flat).placeOf("moon") !== null)).toBe(true);
});

test("a moon is named when pointed at, chosen by a tap with its record and distance, reached by the keyboard, and its name is Japanese on a Japanese page; its track is drawn with the ground track", async ({ page }) => {
  await open(page, "?body=mars&moons=1");
  await listen(page);
  await expect.poll(() => custom(page)).toBe(2);
  const phobos = (await flat(page).evaluate((el) => (el as Flat).placeOf("phobos")))!;
  const box = (await flat(page).locator(".dots").boundingBox())!;
  await page.mouse.move(box.x + phobos.x, box.y + phobos.y);
  await expect(flat(page).locator(".tip")).toContainText("Phobos");
  await expect(flat(page).locator(".tip")).toContainText("a moon of Mars");
  await page.mouse.click(box.x + phobos.x, box.y + phobos.y);
  const tapped = (await picks(page)).at(-1)!;
  expect(tapped).toMatchObject({ kind: "mark", id: "phobos", via: "tap", mark: { group: "moons", data: { moon: "phobos" } } });
  expect(tapped.mark!.data.distanceKm).toBeGreaterThan(9000);
  expect(tapped.mark!.data.distanceKm).toBeLessThan(9800);
  await expect(page.locator("#card-name")).toContainText("Phobos");
  await expect(page.locator("#card-facts")).toContainText("From the centre");
  // the chosen moon's track alone is drawn: more is painted than before
  const painted = (): Promise<number> =>
    flat(page).locator(".dots").evaluate((canvas: HTMLCanvasElement) => {
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let n = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n += 1;
      return n;
    });
  // the tap asks for a draw at the next frame: the pixels are read once it has been made (Linux WebKit reads them before it otherwise, and sees the picture as it was)
  await settled(page);
  const chosen = await painted();
  await page.mouse.click(box.x + 4, box.y + 4);
  await settled(page);
  const none = await painted();
  expect(chosen).toBeGreaterThan(none + 80);
  await flat(page).locator('button[data-act="track"]').click();
  await settled(page);
  expect(await painted()).toBeGreaterThan(none + 150);
  expect(await flat(page).locator(".legend li").allInnerTexts()).toEqual(expect.arrayContaining([expect.stringContaining("A moon's track")]));
  // the keyboard reaches the moons
  await flat(page).locator(".dots").focus();
  const seen = new Set<string>();
  await page.keyboard.press("Home");
  for (let i = 0; i < 40; i += 1) {
    const pick = (await picks(page)).at(-1)!;
    if (pick.kind === "mark") seen.add(pick.id!);
    await page.keyboard.press("ArrowRight");
  }
  expect([...seen].sort()).toEqual(["deimos", "phobos"]);
  // Japanese
  await flat(page).evaluate((el) => el.setAttribute("lang", "ja"));
  await settled(page);
  const again = (await flat(page).evaluate((el) => (el as Flat).placeOf("deimos")))!;
  await page.mouse.click(box.x + again.x, box.y + again.y);
  expect((await picks(page)).at(-1)).toMatchObject({ kind: "mark", id: "deimos", name: "ダイモス" });
  await expect(flat(page).locator(".tip")).toContainText("火星の衛星");
});

test("the moons move as the clock runs: Io's place over Jupiter is another place a short while later", async ({ page }) => {
  await open(page, "?body=jupiter&moons=1");
  await expect.poll(() => custom(page)).toBeGreaterThanOrEqual(5);
  const a = (await flat(page).evaluate((el) => (el as Flat).placeOf("io")))!;
  await flat(page).evaluate((el) => el.setAttribute("time", "2026-11-23T12:20:00Z"));
  await settled(page);
  const b = (await flat(page).evaluate((el) => (el as Flat).placeOf("io")))!;
  expect(Math.abs(a.lon - b.lon)).toBeGreaterThan(1);
});

// MODULES-1861: a moon's name was drawn over the name of a feature (Deimos over Pavonis Mons on Mars's map), because the two were laid out apart. The moon's name now takes what room the places' names left (beside its dot, or above, or below), and no two names overlap.
test("a moon's name never lies over a place's name, nor over another moon's, nor over the degrees along the edges, as the clock runs", async ({ page }) => {
  await open(page, "?body=mars&moons=1&look=map");
  await flat(page).evaluate((el) => el.setAttribute("places", "landing crash feature"));
  await expect.poll(() => custom(page)).toBe(2);
  const overlaps = (a: Flat["stats"]["names"][number], b: Flat["stats"]["names"][number]): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  let moonNames = 0;
  let places = 0;
  for (let step = 0; step < 150; step += 1) {
    await flat(page).evaluate((el, ms) => el.setAttribute("time", new Date(ms).toISOString()), Date.UTC(2026, 10, 23, 12) + step * 20 * 60_000);
    await settled(page);
    const names = await flat(page).evaluate((el) => (el as Flat).stats.names);
    moonNames += names.filter((n) => n.kind === "mark").length;
    places = Math.max(places, names.filter((n) => n.kind === "place").length);
    for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) expect(overlaps(names[i]!, names[j]!), `step ${step}: ${names[i]!.id} and ${names[j]!.id} overlap`).toBe(false);
  }
  expect(places, "the places are named").toBeGreaterThan(3);
  expect((await flat(page).evaluate((el) => (el as Flat).stats.names)).filter((n) => n.kind === "grid").length, "the degrees are named").toBeGreaterThan(4);
  expect(moonNames, "the moons are named most of the time").toBeGreaterThan(100);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("a phone: the Moons chip is tappable, a finger picks a moon and nothing scrolls sideways", async ({ page }) => {
    await open(page, "?body=mars");
    const chip = flat(page).locator('.chip[data-layer="moons"]');
    await chip.scrollIntoViewIfNeeded();
    await chip.tap();
    // the phone shows part of the world, so one of the two may be off the screen
    await expect.poll(() => custom(page)).toBeGreaterThanOrEqual(1);
    await listen(page);
    // the phone shows part of the world: Deimos is put in the middle
    const where = flatMoons("mars", Date.UTC(2026, 10, 23, 12)).find((moon) => moon.id === "deimos")!;
    await flat(page).evaluate((el, lon) => ((el as Flat).center = lon), where.lon);
    await settled(page);
    await flat(page).locator(".dots").scrollIntoViewIfNeeded();
    const deimos = (await flat(page).evaluate((el) => (el as Flat).placeOf("deimos")))!;
    const canvas = (await flat(page).locator(".dots").boundingBox())!;
    await page.touchscreen.tap(canvas.x + deimos.x, canvas.y + deimos.y);
    expect((await picks(page)).at(-1)).toMatchObject({ kind: "mark", id: "deimos", via: "tap" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
