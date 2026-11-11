// The orbiters in the space view (MODULES-929): off by default and their module not fetched; on, each craft with a path is a dot on its orbit line round the Moon or Mars once the body is big enough
// on the screen, named in the page's language, dim when its path is only modelled; from afar none is drawn. Chromium, drawing in software; every wait is on what the page reports.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { ORBITER_IDS, orbiterStatus } from "../src/orbiters.ts";
import { callOn, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Drawn {
  count: number;
  status: Record<string, string>;
}
const drawnOrbiters = async (page: Page): Promise<Drawn> => ((await statsOf(page)) as unknown as { orbiters: Drawn }).orbiters;
const nameOf = (page: Page, id: string) => page.locator(SPACE).locator(`.sp-label[data-body="${id}"]`);

async function drawn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = (await readCounts(page)).draws;
  await act();
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
}

test("off by default and not fetched; at the Moon the lunar orbiters with a path are drawn and named, the modelled ones dim, and from afar none", async ({ page }) => {
  test.setTimeout(240_000);
  const fetched: string[] = [];
  page.on("response", (response) => {
    if (/orbiters/i.test(response.url())) fetched.push(response.url());
  });
  const when = Date.UTC(2026, 10, 11, 12);
  await openSpace(page, "t=2026-11-11T12:00Z&play=off");
  // at the Moon itself (the demo's "goto=moon" is the Earth and the Moon's orbit, where the Moon is a few pixels across)
  await drawn(page, () => callOn(page, "goTo", "moon", { smooth: false }));
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
  await expect(nameOf(page, "lro")).toHaveText("Lunar Reconnaissance Orbiter");
  // Japanese
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(nameOf(page, "lro")).toHaveText("ルナー・リコネサンス・オービター");
  // from the whole solar system the Moon is nothing: no orbiter is drawn
  // (zoomed through the view controls, which hold the view's state: a zoom set on the element alone would leave them at 1, and the next goTo's zoom of 1 would be no change to them)
  const zoom = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system"));
  await drawn(page, () => page.locator("#controls").evaluate((el, z) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set({ yaw: 0, tilt: 0, zoom: z }, true, "set"), zoom));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 30_000 }).toBe(0);
  // at Mars: its craft with a path, Tianwen-1 with none, MAVEN modelled
  await drawn(page, () => callOn(page, "goTo", "mars", { smooth: false }));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 60_000 }).toBeGreaterThan(0);
  const mars = await drawnOrbiters(page);
  expect(mars.status["tianwen-1"]).toBeUndefined();
  expect(mars.status["maven"]).toBe("modelled");
  expect(mars.status["mro"]).toBe(orbiterStatus("mro", when));
  // and off again
  await drawn(page, () => page.locator("#orbiters").dispatchEvent("click"));
  expect((await drawnOrbiters(page)).count).toBe(0);
  await expect(nameOf(page, "mro")).toBeHidden();
});

test("the demo's Orbiters switch is kept in the address", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-11T12:00Z&play=off&orbiters=1");
  await drawn(page, () => callOn(page, "goTo", "moon", { smooth: false }));
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await page.locator("#orbiters").getAttribute("aria-pressed")).toBe("true");
  await page.locator("#orbiters").dispatchEvent("click");
  await expect.poll(async () => (await drawnOrbiters(page)).count, { timeout: 30_000 }).toBe(0);
  await expect.poll(() => new URL(page.url()).searchParams.get("orbiters"), { timeout: 10_000 }).toBeNull();
});
