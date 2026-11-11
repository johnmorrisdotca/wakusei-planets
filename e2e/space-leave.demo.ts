// Leaving a body gently (MODULES-912): a slow launch so the departure is seen, and the named transitions (turn-travel, direct, look-back, auto, cut) chosen by an attribute, a property and a call. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type V = [number, number, number];
const camera = async (page: Page): Promise<V> => ((await statsOf(page)) as unknown as { camera: { position: V } }).camera.position;
const gliding = async (page: Page): Promise<boolean> => ((await statsOf(page)) as unknown as { ride: { gliding: boolean } }).ride.gliding;
const away = (a: V, b: V): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const prop = (page: Page, name: string) => page.locator(SPACE).evaluate((el, key) => Reflect.get(el, key), name);

test("the transition, the launch and the turn are attributes and properties, read in any case, with sensible limits", async ({ page }) => {
  await openSpace(page);
  expect(await prop(page, "transition")).toBe("turn-travel");
  expect(await prop(page, "launchMs")).toBe(500);
  expect(await prop(page, "turnMs")).toBe(700);
  await page.locator(SPACE).evaluate((el) => {
    el.setAttribute("transition", "Look-Back");
    el.setAttribute("launch", "900");
    el.setAttribute("turn", "400");
  });
  expect([await prop(page, "transition"), await prop(page, "launchMs"), await prop(page, "turnMs")]).toEqual(["look-back", 900, 400]);
  await setOn(page, "transition", "auto");
  await setOn(page, "launchMs", 99_999);
  expect([await prop(page, "transition"), await prop(page, "launchMs")]).toEqual(["auto", 10_000]);
  await setOn(page, "transition", "sideways");
  expect(await prop(page, "transition"), "a name that is none changes nothing").toBe("auto");
});

test("the first frames of a glide: the camera has hardly left after a quarter of a second, and it arrives at the middle of the destination", async ({ page }) => {
  test.setTimeout(120_000);
  await openSpace(page);
  const start = await camera(page);
  await callOn(page, "goTo", "jupiter");
  await page.waitForTimeout(250);
  const early = await camera(page);
  expect(await gliding(page), "it glides").toBe(true);
  await expect.poll(() => gliding(page), { timeout: 30_000 }).toBe(false);
  await settle(page, 500);
  const end = await camera(page);
  const share = away(early, start) / away(end, start);
  expect(share, `a quarter of a second covered ${(share * 100).toFixed(1)} percent of the way`).toBeLessThan(0.12);
});

test("cut goes at once, a call can choose for one trip, and look-back keeps the body being left in view while the trip begins", async ({ page }) => {
  test.setTimeout(180_000);
  await openSpace(page);
  await callOn(page, "goTo", "mars", { transition: "cut" });
  expect(await gliding(page), "cut is not a glide").toBe(false);
  expect(await prop(page, "transition"), "the call did not change the setting").toBe("turn-travel");
  await settle(page, 800);
  await callOn(page, "goTo", "earth", { smooth: false });
  await settle(page, 600);
  // looking back: a second into the trip to a far body the Earth is still in the middle of the picture
  await callOn(page, "goTo", "neptune", { transition: "look-back" });
  await page.waitForTimeout(900);
  const box = (await page.locator(SPACE).boundingBox())!;
  const earth = await page.locator(SPACE).evaluate((el) => (el as unknown as { placeOf(id: string): { x: number; y: number } | null }).placeOf("earth"));
  expect(earth, "the Earth is still drawn").not.toBeNull();
  expect(Math.hypot(earth!.x - box.width / 2, earth!.y - box.height / 2), "and near the middle").toBeLessThan(Math.min(box.width, box.height) * 0.3);
  await expect.poll(() => prop(page, "body"), { timeout: 30_000 }).toBe("neptune");
  await expect.poll(() => gliding(page), { timeout: 30_000 }).toBe(false);
});

test.describe("a reader who prefers reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("gets a cut whatever the transition", async ({ page }) => {
    await openSpace(page);
    await setOn(page, "transition", "look-back");
    await callOn(page, "goTo", "jupiter");
    expect(await gliding(page)).toBe(false);
  });
});
