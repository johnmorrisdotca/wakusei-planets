// The orbiters in the space view: off by default and their module not fetched; on, each craft with a path is a dot on its orbit line round the Moon or Mars once the body is big enough
// on the screen, named in the page's language, dim when its path is modelled or predicted with a large error (`orbiterDim`); from afar none is drawn. Chromium, drawing in software; every wait is on what the page reports.
import { expect, test, type Page } from "@playwright/test";
import { ORBITER_IDS, orbiterDim, orbiterElements, orbiterStatus } from "../src/orbiters.ts";
import { callOn, drawnAtRest, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Drawn {
  count: number;
  status: Record<string, string>;
  dim: string[];
  lines: number;
  track: number;
}
const drawnOrbiters = async (page: Page): Promise<Drawn> => ((await statsOf(page)) as unknown as { orbiters: Drawn }).orbiters;
const nameOf = (page: Page, id: string) => page.locator(SPACE).locator(`.sp-label[data-body="${id}"]`);

test("off by default and not fetched; at the Moon the lunar orbiters with a path are drawn and named, the modelled ones dim, and from afar none", async ({ page }) => {
  test.setTimeout(240_000);
  const fetched: string[] = [];
  page.on("response", (response) => {
    if (/orbiters/i.test(response.url())) fetched.push(response.url());
  });
  // a moment in the days after the fit, from the data, so a refresh of the data keeps the test meaning the same: Hope predicted with a small error, the low orbits with a large one
  const hope = orbiterElements("hope")!;
  const when = Math.floor((Date.parse(hope.fitUntil) + Date.parse(hope.validUntil)) / 2 / 60_000) * 60_000;
  await openSpace(page, `t=${new Date(when).toISOString().slice(0, 16)}Z&play=off`);
  // at the Moon itself (the demo's "goto=moon" is the Earth and the Moon's orbit, where the Moon is a few pixels across)
  await drawnAtRest(page, () => callOn(page, "goTo", "moon", { smooth: false }));
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "orbiters"))).toBe(false);
  expect((await drawnOrbiters(page)).count).toBe(0);
  expect(fetched, "the orbiters' module is not fetched while they are off").toEqual([]);
  // the demo's own switch: the page holds the choice and applies it to the element at every render, so a value set on the element alone is undone at the next one (a move's announcement)
  await page.locator("#orbiters").dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(fetched.length).toBeGreaterThanOrEqual(1);
  const seen = await drawnOrbiters(page);
  // every lunar craft with a path, and none of Mars's (Mars is a dot from here), none without a path
  const lunar = ORBITER_IDS.filter((id) => ["lro", "chandrayaan-2", "danuri", "artemis-p1", "artemis-p2"].includes(id));
  for (const id of lunar) expect(seen.status[id], `${id} is drawn at the Moon`).toBe(orbiterStatus(id, when));
  expect(seen.status["capstone"], "CAPSTONE has no path").toBeUndefined();
  expect(seen.status["mro"], "Mars's craft are not drawn from the Moon").toBeUndefined();
  expect(seen.count).toBe(lunar.length);
  expect(seen.dim.sort(), "dim as orbiterDim says").toEqual(lunar.filter((id) => orbiterDim(id, when)).sort());
  await expect(nameOf(page, "lro")).toHaveText("Lunar Reconnaissance Orbiter");
  // Japanese
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(nameOf(page, "lro")).toHaveText("ルナー・リコネサンス・オービター");
  // from the whole solar system the Moon is nothing: no orbiter is drawn
  // (zoomed through the view controls, which hold the view's state: a zoom set on the element alone would leave them at 1, and the next goTo's zoom of 1 would be no change to them)
  const zoom = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system"));
  await drawnAtRest(page, () => page.locator("#controls").evaluate((el, z) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ yaw: 0, tilt: 0, zoom: z }, true, "set"), zoom));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 30_000 }).toBe(0);
  // at Mars: its craft with a path, Tianwen-1 with none, MAVEN modelled
  await drawnAtRest(page, () => callOn(page, "goTo", "mars", { smooth: false }));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 60_000 }).toBeGreaterThan(0);
  const mars = await drawnOrbiters(page);
  expect(mars.status["tianwen-1"]).toBeUndefined();
  expect(mars.status["maven"]).toBe("modelled");
  expect(mars.status["mro"]).toBe(orbiterStatus("mro", when));
  const drawnMars = Object.keys(mars.status);
  expect(mars.dim.sort(), "dim as orbiterDim says").toEqual(drawnMars.filter((id) => orbiterDim(id as never, when)).sort());
  expect(mars.status["hope"]).toBe("predicted");
  expect(mars.dim, "a predicted path within 2 per cent of Mars's radius is drawn full").not.toContain("hope");
  expect(mars.dim, "a modelled path is dim").toContain("maven");
  // and off again
  await drawnAtRest(page, () => page.locator("#orbiters").dispatchEvent("click"));
  expect((await drawnOrbiters(page)).count).toBe(0);
  await expect(nameOf(page, "mro")).toBeHidden();
});

test("the demo's Orbiters switch is kept in the address", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-11T12:00Z&play=off&orbiters=1");
  await drawnAtRest(page, () => callOn(page, "goTo", "moon", { smooth: false }));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await page.locator("#orbiters").getAttribute("aria-pressed")).toBe("true");
  await page.locator("#orbiters").dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 30_000 }).toBe(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("orbiters"), { timeout: 10_000 }).toBeNull();
});

test("a picked craft: its card, its line alone or none, its ground track, a ride along with it, all kept in the address", async ({ page }) => {
  test.setTimeout(240_000);
  // a moment inside MRO's fit, from the data, so a refresh keeps the test meaning the same
  const mro = orbiterElements("mro")!;
  const when = Math.floor((Date.parse(mro.validFrom) + Date.parse(mro.fitUntil)) / 2 / 60_000) * 60_000;
  await openSpace(page, `t=${new Date(when).toISOString().slice(0, 16)}Z&play=off&orbiters=1`);
  await expect(page.locator("#orbiter-row")).toBeVisible();
  await expect(page.locator("#orbiter-card")).toContainText("Pick a craft");
  // picking MRO brings Mars into view and fills the card
  await page.locator('#orbiter-picks-mars [data-orbiter="mro"]').dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).status["mro"], { timeout: 60_000 }).toBeDefined();
  const card = page.locator("#orbiter-card");
  await expect(card).toContainText("Mars Reconnaissance Orbiter: NASA");
  await expect(card).toContainText(/\d+ km up, [\d.]+ km\/s, once round in 11\d min, 92\.\d° to the equator\./);
  await expect(card).toContainText(/Tracked: within the fit to Horizons' track, \d+ km off at worst\./);
  await expect(card).toContainText(/Next pass over Perseverance: .+, \d+° up at best\./, { timeout: 30_000 });
  expect(await page.locator('#orbiter-picks-mars [data-orbiter="mro"]').getAttribute("aria-pressed")).toBe("true");
  expect((await drawnOrbiters(page)).lines).toBeGreaterThan(1);
  // only the chosen craft's line, then none
  await page.locator('#orbiter-lines [data-olines="chosen"]').dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).lines, { timeout: 30_000 }).toBe(1);
  await page.locator('#orbiter-lines [data-olines="none"]').dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).lines, { timeout: 30_000 }).toBe(0);
  // the ground track
  expect((await drawnOrbiters(page)).track).toBe(0);
  await page.locator("#orbiter-track").dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).track, { timeout: 30_000 }).toBeGreaterThan(100);
  await expect.poll(() => new URL(page.url()).searchParams.get("otrack"), { timeout: 10_000 }).toBe("1");
  expect(new URL(page.url()).searchParams.get("orbiter")).toBe("mro");
  expect(new URL(page.url()).searchParams.get("olines")).toBe("none");
  // ride along with it
  const ride = page.locator('#rides [data-ride="orbiter"]');
  await expect(ride).toBeVisible();
  await ride.dispatchEvent("click");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { ride: { riding: boolean } }).ride.riding, { timeout: 30_000 }).toBe(true);
  // a craft with no path: no numbers, no ride
  await page.locator('#rides [data-ride=""]').dispatchEvent("click");
  await page.locator('#orbiter-picks-mars [data-orbiter="tianwen-1"]').dispatchEvent("click");
  await expect(card).toContainText("No path: there is no public orbit track for it.");
  await expect(ride).toBeHidden();
  // Orbiters off: the row goes, and the craft leaves the address
  await page.locator("#orbiters").dispatchEvent("click");
  await expect(page.locator("#orbiter-row")).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("orbiter"), { timeout: 10_000 }).toBeNull();
});
