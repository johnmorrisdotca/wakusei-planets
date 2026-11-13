// The orbit paths of a page's own (MODULES-1328): `paths` draws up to 16 orbits at once, each in a named look, as one draw with a real width and dashes; a moon's ring passes through the moon; a pointer finds a path
// (`path-hover`, `path-click`, `pathAt`) after a body and before the sky. Chromium, in software. The time is held by the page's own `t` (no clock runs), and every wait is for a draw, never for time to pass.
import { expect, test, type Page } from "@playwright/test";
import { callCounted, callOn, drawnAfter, goTo, openSpace, quiet, SPACE, setCounted, shot, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface PathStats {
  requested: number;
  drawn: number;
  dropped: number;
  unresolved: number;
  hidden: string[];
  solid: string[];
  draws: number;
  hover: string | null;
  hits: number;
}
interface Hit {
  id: string;
  style: string;
  x: number;
  y: number;
  distancePx: number;
  pointer: string;
}
const pathsOf = async (page: Page): Promise<PathStats> => ((await statsOf(page)) as unknown as { paths: PathStats }).paths;
/** Set the paths and wait for the draw that follows, then for the view to be at rest. */
async function showPaths(page: Page, list: unknown[]): Promise<void> {
  const before = await callCounted(page, "setPaths", list);
  await drawnAfter(page, before, "the paths");
  await quiet(page);
}
/** Set the time (the page's own `time` attribute: no clock runs) and wait for the draw that shows it. */
async function showTime(page: Page, iso: string): Promise<void> {
  const before = await callCounted(page, "setAttribute", "time", iso);
  await drawnAfter(page, before, `the time ${iso}`);
  await quiet(page);
}
/** Go to a body at once (no glide) and wait for the draw that shows it and for the view to be at rest. */
async function flyTo(page: Page, id: string): Promise<void> {
  const before = await callCounted(page, "goTo", id, { smooth: false });
  await drawnAfter(page, before, `the move to ${id}`);
  await quiet(page);
}
const placeOf = (page: Page, id: string) => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
const pathAt = (page: Page, x: number, y: number, radius?: number): Promise<Hit | null> => callOn(page, "pathAt", x, y, radius) as Promise<Hit | null>;
/** How many pixels of a picture of the view are brighter than a grey (a white path on the dark sky, nothing else bright but the Sun). */
const bright = (page: Page, data: string, over = 450): Promise<number> =>
  page.evaluate(
    async ({ picture, limit }) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${picture}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const px = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      let count = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i]! + px[i + 1]! + px[i + 2]! > limit) count += 1;
      return count;
    },
    { picture: data, limit: over },
  );

test("a page's paths are drawn in one draw call, whatever Orbits says, and the plain line is not drawn beneath", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  expect((await pathsOf(page)).drawn, "no paths until asked").toBe(0);
  await showPaths(page, [{ id: "mars", style: "favourite" }, { id: "jupiter", style: "selected" }, "saturn"]);
  const first = await pathsOf(page);
  expect(first).toMatchObject({ requested: 3, drawn: 3, dropped: 0, unresolved: 0, draws: 1 });
  // Orbits off lets the plain lines go; the paths were asked for, so they stay
  const before = await setCounted(page, "orbits", false);
  await drawnAfter(page, before, "Orbits off");
  await quiet(page);
  expect(await pathsOf(page)).toMatchObject({ drawn: 3, draws: 1 });
  expect(((await statsOf(page)) as unknown as { orbits: { drawn: string[] } }).orbits.drawn).toEqual([]);
  // none asked: nothing is drawn for them, and the one draw call goes with them
  await showPaths(page, []);
  expect(await pathsOf(page)).toMatchObject({ requested: 0, drawn: 0, draws: 0 });
});

test("a craft, an unknown id and the Sun are no paths; the last sixteen of a longer list are kept", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  await showPaths(page, ["roadster", "voyager1", "nowhere", "sun", "mars", { id: 4 }, "orbiter-1"]);
  expect(await pathsOf(page)).toMatchObject({ requested: 6, drawn: 1, unresolved: 5 });
  const twenty = ["earth", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "ceres", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna", "vesta", "pallas", "moon"];
  await showPaths(page, twenty);
  const many = await pathsOf(page);
  expect(many).toMatchObject({ requested: 20, dropped: 4, unresolved: 0 });
  expect(many.drawn + many.hidden.length, "the sixteen kept are drawn or let go, none lost").toBe(16);
  expect(many.draws).toBe(1);
  // a body named twice is one path, in the look of the last
  await showPaths(page, [{ id: "mars", style: "hovered" }, { id: "mars", style: "favourite" }]);
  expect(await pathsOf(page)).toMatchObject({ drawn: 1 });
});

test("the looks: built-in names differ by width and dash, a page's own override them, and a bad value is held to its range", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  const table = await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pathStyles") as Record<string, { color: string; width: number; opacity: number; dash: [number, number] | null }>);
  const keys = new Set(Object.values(table).map((l) => `${l.width}/${JSON.stringify(l.dash)}`));
  expect(keys.size).toBe(Object.keys(table).length);
  await callOn(page, "setPathStyles", { favourite: { color: "tomato", width: 99, dash: [0, 0] }, mine: { width: 3 } });
  const mine = await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pathStyles") as Record<string, { color: string; width: number; dash: [number, number] | null }>);
  expect(mine["favourite"]).toMatchObject({ color: "tomato", width: 8, dash: [1, 1] });
  expect(mine["mine"]!.width).toBe(3);
  await callOn(page, "setPathStyles", { favourite: null });
  expect(((await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pathStyles"))) as typeof mine)["favourite"]!.color).toBe("#ffd166");
});

test("a dashed path is drawn in dashes along its length, and a wider one is wider", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  const off = await setCounted(page, "orbits", false);
  await drawnAfter(page, off, "Orbits off");
  await quiet(page);
  const none = await bright(page, await shot(page));
  const solid = async (width: number, dash: [number, number] | null): Promise<number> => {
    await callOn(page, "setPathStyles", { probe: { color: "#ffffff", width, opacity: 1, dash } });
    await showPaths(page, [{ id: "jupiter", style: "probe" }]);
    expect((await pathsOf(page)).solid, "the dashes are drawn as dashes").toEqual([]);
    return (await bright(page, await shot(page))) - none;
  };
  const thin = await solid(2, null);
  const wide = await solid(6, null);
  const dashed = await solid(2, [6, 6]);
  expect(thin).toBeGreaterThan(100);
  expect(wide / thin, "three times the width, about three times the pixels").toBeGreaterThan(2);
  expect(wide / thin).toBeLessThan(4);
  expect(dashed / thin, "a dash as long as its gap is about half the line").toBeGreaterThan(0.35);
  expect(dashed / thin).toBeLessThan(0.65);
});

for (const [moon, system, times] of [
  ["io", "jupiter", ["2026-11-02T14:00Z"]],
  ["titan", "saturn", ["2026-11-02T14:00Z"]],
] as const) {
  for (const scale of ["true", "compressed"] as const) {
    test(`${moon}'s ring runs through ${moon} at two moments (${scale} scale)`, async ({ page }) => {
      await openSpace(page, `t=${times[0]}&scale=${scale}`);
      await flyTo(page, system);
      await showPaths(page, [{ id: moon, style: "favourite" }]);
      expect(await pathsOf(page)).toMatchObject({ drawn: 1, unresolved: 0 });
      // two moments at which the moon is drawn and clear of its planet's disc (in front of it the ring is let go, behind it the moon is not drawn): the first two of a day's moments, every three hours, that are
      let checked = 0;
      for (let h = 0; h < 96 && checked < 2; h += 3) {
        const iso = new Date(Date.parse(times[0]) + h * 3_600_000).toISOString();
        if (h > 0) await showTime(page, iso);
        const at = await placeOf(page, moon);
        const planet = await placeOf(page, system);
        if (at === null || Math.hypot(at.x - planet!.x, at.y - planet!.y) < planet!.r + 8) continue;
        const hit = await pathAt(page, at.x, at.y, 4);
        expect(hit, `a path at ${moon} on ${iso}`).not.toBeNull();
        expect(hit!.id).toBe(moon);
        expect(hit!.distancePx, `the ring is within a pixel or two of ${moon} on ${iso}`).toBeLessThan(1.5);
        checked += 1;
      }
      expect(checked, "two moments with the moon clear of the planet").toBe(2);
    });
  }
}

test("the Moon's ring and a planet's path run through the body, as its plain line does", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  await showPaths(page, ["earth", "mars", "neptune"]);
  for (const id of ["earth", "mars", "neptune"]) {
    const at = await placeOf(page, id);
    if (at === null) continue;
    const hit = await pathAt(page, at.x, at.y, 6);
    expect(hit?.id, `${id}'s path is under ${id}`).toBe(id);
    expect(hit!.distancePx).toBeLessThan(2);
  }
});

test("the pointer finds a path: hover, click, the style's name, a body first, and a touch has twice the reach", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  await page.locator(SPACE).evaluate((el) => {
    const log: { type: string; detail: Record<string, unknown> }[] = [];
    (window as unknown as { __paths: typeof log }).__paths = log;
    for (const type of ["wakusei-path-hover", "wakusei-path-hover-end", "wakusei-path-click", "wakusei-body-click"]) el.addEventListener(type, (e) => log.push({ type, detail: (e as CustomEvent).detail as Record<string, unknown> }));
  });
  await showPaths(page, [{ id: "neptune", style: "favourite" }]);
  const box = (await page.locator(SPACE).boundingBox())!;
  const free = await page.locator(SPACE).evaluate(
    (el, size) => {
      const view = el as unknown as { pathAt(x: number, y: number, r?: number): { x: number; y: number } | null; placeOf(id: string): { x: number; y: number; r: number } | null };
      const ids = ["sun", "earth", "mercury", "venus", "mars", "neptune", "saturn", "uranus", "neptune", "moon"];
      for (let y = 10; y < size.height; y += 6) {
        for (let x = 10; x < size.width; x += 6) {
          const hit = view.pathAt(x, y, 4);
          if (!hit) continue;
          if (ids.some((id) => { const p = view.placeOf(id); return p !== null && Math.hypot(p.x - hit.x, p.y - hit.y) < Math.max(p.r, 14) + 30; })) continue;
          return { x: hit.x, y: hit.y };
        }
      }
      return null;
    },
    { width: box.width, height: box.height },
  );
  expect(free, "a place on the path clear of every body").not.toBeNull();
  const hit = (await pathAt(page, free!.x, free!.y))!;
  expect(hit).toMatchObject({ id: "neptune", style: "favourite", pointer: "mouse" });
  expect(hit.distancePx).toBeLessThan(1);
  // 10 px off the line: not a hit with the default 8, a hit with a radius of 12
  expect(await pathAt(page, free!.x + 10, free!.y + 10, 3)).toBeNull();
  // the mouse moves onto the path: hover once, and again only after it leaves
  await page.mouse.move(box.x + free!.x, box.y + free!.y);
  await expect.poll(async () => (await pathsOf(page)).hover).toBe("neptune");
  await page.mouse.move(box.x + 2, box.y + 2);
  await expect.poll(async () => (await pathsOf(page)).hover).toBeNull();
  // a press on it is a path click, once; a drag is not
  await page.mouse.click(box.x + free!.x, box.y + free!.y);
  await expect.poll(async () => (await pathsOf(page)).hits).toBe(1);
  const log = await page.evaluate(() => (window as unknown as { __paths: { type: string; detail: Record<string, unknown> }[] }).__paths);
  expect(log.filter((e) => e.type === "wakusei-path-hover").length).toBe(1);
  expect(log.filter((e) => e.type === "wakusei-path-hover-end").length).toBe(1);
  const click = log.find((e) => e.type === "wakusei-path-click")!;
  expect(click.detail).toMatchObject({ id: "neptune", style: "favourite", pointer: "mouse" });
  expect(log.filter((e) => e.type === "wakusei-body-click").length, "a press on a path is no body press").toBe(0);
  await page.mouse.move(box.x + free!.x, box.y + free!.y);
  await page.mouse.down();
  await page.mouse.move(box.x + free!.x + 40, box.y + free!.y + 40, { steps: 4 });
  await page.mouse.up();
  expect((await pathsOf(page)).hits, "a drag that turns the view is not a click").toBe(1);
});

test("a press on a body that the path runs under is the body's, not the path's", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  await page.locator(SPACE).evaluate((el) => {
    const log: string[] = [];
    (window as unknown as { __order: string[] }).__order = log;
    for (const type of ["wakusei-path-click", "wakusei-body-click"]) el.addEventListener(type, () => log.push(type));
  });
  await showPaths(page, ["jupiter"]);
  const box = (await page.locator(SPACE).boundingBox())!;
  const jup = (await placeOf(page, "jupiter"))!;
  // Jupiter sits on its own path: a press on it is a press on Jupiter and nothing else
  await page.mouse.click(box.x + jup.x, box.y + jup.y);
  await expect.poll(async () => page.evaluate(() => (window as unknown as { __order: string[] }).__order.length)).toBeGreaterThan(0);
  const order = await page.evaluate(() => (window as unknown as { __order: string[] }).__order);
  expect(order).toEqual(["wakusei-body-click"]);
  expect((await pathsOf(page)).hits).toBe(0);
});

test("path-hit off finds no path, and a ride has no hit test unless path-hit is set", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await goTo(page, "Whole solar system");
  await showPaths(page, ["jupiter"]);
  const jup = (await placeOf(page, "jupiter"))!;
  expect((await pathAt(page, jup.x, jup.y))?.id).toBe("jupiter");
  await callOn(page, "setAttribute", "path-hit", "off");
  expect(await pathAt(page, jup.x, jup.y), "off: no hit by the default radius").toBeNull();
  expect((await pathAt(page, jup.x, jup.y, 5))?.id, "a radius asked for in the call is used").toBe("jupiter");
  await callOn(page, "removeAttribute", "path-hit");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pathHit"))).toBe(8);
  await callOn(page, "setAttribute", "path-hit", "500");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "pathHit"))).toBe(40);
});

test("close to a planet only its own system's paths are drawn, and a moon's ring is drawn round it", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await flyTo(page, "jupiter");
  await showPaths(page, ["mars", "saturn", "io", "europa"]);
  const stats = await pathsOf(page);
  expect(stats.hidden.sort(), "the paths of other systems are let go close to Jupiter").toEqual(["mars", "saturn"]);
  expect(stats.drawn).toBe(2);
  expect(stats.draws).toBe(1);
});
