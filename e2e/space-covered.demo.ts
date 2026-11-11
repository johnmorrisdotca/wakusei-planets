// A body behind another (MODULES-924): with `covered="arrow"` its name and ring are not drawn over the nearer body's disc; one quiet arrow sits outside the disc's edge instead, named for the surest
// hidden body, and a press on it goes there. Off (the default) the names are drawn over the disc as before. Chromium, drawing in software; every wait is on what the page reports.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Place {
  x: number;
  y: number;
  r: number;
  behind?: string;
}
const placesOf = (page: Page): Promise<Record<string, Place | null>> =>
  page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): Place | null; bodyList(): { id: string }[] };
    const out: Record<string, Place | null> = {};
    for (const { id } of space.bodyList()) out[id] = space.placeOf(id);
    return out;
  });
const visibleNames = (page: Page): Promise<string[]> => page.locator(SPACE).evaluate((el) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label:not([hidden])")].map((n) => n.dataset["body"]!));
const arrowsOf = (page: Page): Promise<{ cover: string; body: string; text: string; hidden: boolean }[]> =>
  page.locator(SPACE).evaluate((el) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-arrow")].map((n) => ({ cover: n.dataset["cover"]!, body: n.dataset["body"]!, text: n.textContent ?? "", hidden: n.hidden })));

async function drawn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = (await readCounts(page)).draws;
  await act();
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  let held = -1;
  await expect
    .poll(
      async () => {
        const now = (await readCounts(page)).draws;
        const same = now === held;
        held = now;
        return same;
      },
      { timeout: 30_000, intervals: [300] },
    )
    .toBe(true);
}

/** From beside the Moon the Earth is a big disc: turn the view until some body is behind it, and say which. */
async function behindTheEarth(page: Page): Promise<string[]> {
  for (const yaw of [0, 60, 120, 180, 240, 300]) {
    await drawn(page, () => callOn(page, "setView", { yaw, tilt: 0, zoom: 1 }));
    const places = await placesOf(page);
    const behind = Object.entries(places).filter(([, at]) => at?.behind === "earth").map(([id]) => id);
    if (behind.length > 0) return behind;
  }
  return [];
}

test("off by default: a body behind the Earth keeps its name over the disc; with covered=\"arrow\" the name goes and one arrow on the Earth's edge names the surest of them", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed&ride=moon:beside");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "covered"))).toBe("name");
  const behind = await behindTheEarth(page);
  expect(behind.length, "some body sits behind the Earth's disc from beside the Moon").toBeGreaterThan(0);
  // as before: the names over the disc, no arrow
  const shownBefore = await visibleNames(page);
  expect((await arrowsOf(page)).filter((a) => !a.hidden)).toEqual([]);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("covered", "arrow"));
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "covered"))).toBe("arrow");
  await expect.poll(async () => (await arrowsOf(page)).filter((a) => !a.hidden).length, { timeout: 30_000 }).toBeGreaterThan(0);
  const arrows = (await arrowsOf(page)).filter((a) => !a.hidden);
  const earthArrow = arrows.find((a) => a.cover === "earth");
  expect(earthArrow, "one arrow for the Earth's disc").toBeDefined();
  expect(behind).toContain(earthArrow!.body);
  expect(earthArrow!.text.startsWith(await page.locator(SPACE).evaluate((el, id) => (el as unknown as { bodyInfo(id: string): { name: string } }).bodyInfo(id).name, earthArrow!.body))).toBe(true);
  if (behind.length > 1) expect(earthArrow!.text).toMatch(/\+\d+$/);
  const shownAfter = await visibleNames(page);
  for (const id of behind) expect(shownAfter, `${id}'s name is not drawn over the Earth`).not.toContain(id);
  expect(shownBefore.some((id) => behind.includes(id)) || shownBefore.length >= shownAfter.length).toBe(true);
  // the arrow sits just outside the Earth's disc
  const earth = (await placesOf(page))["earth"]!;
  const box = await page.locator(SPACE).locator('.sp-arrow[data-cover="earth"]').boundingBox();
  const host = await page.locator(SPACE).boundingBox();
  const near = Math.min(Math.hypot(box!.x - host!.x - earth.x, box!.y + 8 - host!.y - earth.y), Math.hypot(box!.x + box!.width - host!.x - earth.x, box!.y + 8 - host!.y - earth.y));
  expect(near, "the arrow's tip is at the Earth's edge").toBeGreaterThan(earth.r - 2);
  expect(near).toBeLessThan(earth.r + 30);
  // a press on the arrow goes to the body it names
  const before = (await readCounts(page)).draws;
  await page.locator(SPACE).locator('.sp-arrow[data-cover="earth"]').dispatchEvent("click");
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  await expect.poll(() => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body")), { timeout: 30_000 }).toBe(earthArrow!.body);
});

test("labels=\"off\" hides the arrows with the names", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed&ride=moon:beside");
  await page.locator(SPACE).evaluate((el) => el.setAttribute("covered", "arrow"));
  const behind = await behindTheEarth(page);
  expect(behind.length).toBeGreaterThan(0);
  await expect.poll(async () => (await arrowsOf(page)).filter((a) => !a.hidden).length, { timeout: 30_000 }).toBeGreaterThan(0);
  await drawn(page, () => page.locator(SPACE).evaluate((el) => Reflect.set(el, "labels", false)));
  expect((await arrowsOf(page)).filter((a) => !a.hidden)).toEqual([]);
  expect(await visibleNames(page)).toEqual([]);
});
