// The places on the space view's Earth ask nothing of the machine: nothing is drawn at rest with them on, no animation runs, they add no WebGL context, and changing them (the list, the look, the turn of the Earth, taking them away and back)
// gives back what it took. Played in headless Chromium, drawing WebGL in software. One test at a time, one page.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";
import { callOn, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
});

const settle = (page: Page, ms: number) => page.waitForTimeout(ms);
/** The counters once the graphics objects alive and the contexts have stopped changing: the same on four reads a quarter of a second apart. */
const settledCounts = async (page: Page) => {
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const counts = await readCounts(page);
        const now = `${gpuObjects(counts)}:${counts.contexts}`;
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { intervals: [250], timeout: 60_000, message: "the graphics objects alive never stopped changing" },
    )
    .toBeGreaterThanOrEqual(3);
  return readCounts(page);
};
const PLACES = [
  { id: "me", lon: 10, lat: 20, label: "You are here", kind: "here" },
  { id: "a", lon: 30, lat: 25, label: "Alpha" },
  { id: "b", lon: -10, lat: 5, label: "Bravo" },
  ...Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, lon: (i % 10) * 4 - 18, lat: Math.floor(i / 10) * 4 - 10 })),
];
const marks = (page: Page) => page.locator(SPACE).evaluate((el) => (Reflect.get(el, "earthPlacesShown") as { marks: unknown[] }).marks.length);

test("the space view with places on the Earth draws nothing at rest, runs no animation, and changing the places gives back what they took", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&look=painted&goto=earth");
  await callOn(page, "setAttribute", "center", "10,20");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify(PLACES));
  await expect.poll(() => marks(page), { timeout: 60_000 }).toBe(32);
  await settle(page, 2500);
  const before = await readCounts(page);
  await settle(page, 3000);
  const after = await readCounts(page);
  expect(after.contexts, "no context of their own").toBe(1);
  expect(after.draws - before.draws, "nothing drawn at rest with the places on").toBe(0);
  expect(after.rafRequests - before.rafRequests).toBe(0);
  expect(await page.locator(SPACE).evaluate((el) => el.shadowRoot!.getAnimations().length), "no animation runs").toBe(0);

  const round = async (): Promise<void> => {
    for (const look of ["pin", "ring", "beam"]) {
      await callOn(page, "setAttribute", "earth-places-look", look);
      await settle(page, 200);
    }
    for (const centre of ["100,0", "10,20"]) {
      await callOn(page, "setAttribute", "center", centre);
      await settle(page, 400);
    }
    await callOn(page, "removeAttribute", "earth-places");
    await settle(page, 200);
    await callOn(page, "setAttribute", "earth-places", JSON.stringify(PLACES));
    await expect.poll(() => marks(page), { timeout: 60_000 }).toBe(32);
  };
  let before2 = Infinity;
  let first = await settledCounts(page);
  for (let i = 0; i < 8; i += 1) {
    await round();
    first = await settledCounts(page);
    if (gpuObjects(first) <= before2) break;
    before2 = gpuObjects(first);
  }
  for (let i = 0; i < 3; i += 1) await round();
  await settle(page, 2500);
  const last = await settledCounts(page);
  expect(last.contexts).toBe(1);
  expect(gpuObjects(last)).toBeLessThanOrEqual(gpuObjects(first) + 4);
  // at rest again once the changes have ended
  const a = await readCounts(page);
  await settle(page, 3000);
  expect((await readCounts(page)).draws - a.draws).toBe(0);
  // the markers are a few kept elements, not one made for each draw
  expect(await page.locator(SPACE).evaluate((el) => el.shadowRoot!.querySelectorAll(".wk-eplace").length)).toBeLessThanOrEqual(32);
});
