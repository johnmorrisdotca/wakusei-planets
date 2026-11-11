// The view from beside the Moon (MODULES-854): the camera beyond the Moon and off the line to the Earth, so the Moon is large in the foreground and the Earth is in view behind it and never hidden by it, with a glide to it
// and back. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Place {
  x: number;
  y: number;
  r: number;
}
const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
const rideOf = async (page: Page): Promise<{ riding: boolean; gliding: boolean }> => ((await statsOf(page)) as unknown as { ride: { riding: boolean; gliding: boolean } }).ride;

/** Both bodies are whole on the screen and the near one does not cover the far one. */
async function bothInView(page: Page, near: string, far: string): Promise<void> {
  const box = (await page.locator(SPACE).boundingBox())!;
  await expect.poll(async () => (await placeOf(page, near)) !== null && (await placeOf(page, far)) !== null, { timeout: 30_000 }).toBe(true);
  await settle(page, 600);
  const a = (await placeOf(page, near))!;
  const b = (await placeOf(page, far))!;
  for (const [id, at] of [[near, a], [far, b]] as const) {
    expect(at.x - at.r, `${id}: left edge`).toBeGreaterThanOrEqual(-2);
    expect(at.x + at.r, `${id}: right edge`).toBeLessThanOrEqual(box.width + 2);
    expect(at.y - at.r, `${id}: top edge`).toBeGreaterThanOrEqual(-2);
    expect(at.y + at.r, `${id}: bottom edge`).toBeLessThanOrEqual(box.height + 2);
  }
  expect(a.r, `${near} is large`).toBeGreaterThan(0.2 * (Math.min(box.width, box.height) / 2));
  expect(Math.hypot(a.x - b.x, a.y - b.y), `${far} is not under ${near}`).toBeGreaterThan(a.r + b.r);
}

for (const scale of ["true", "compressed"] as const) {
  test(`${scale} scale: from beside the Moon the Moon is large and the Earth is in view behind it, never hidden`, async ({ page }) => {
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}`);
    await callOn(page, "ride", "moon", { view: "beside", smooth: false });
    await bothInView(page, "moon", "earth");
    // the Earth is at its real size from there: about two degrees across, a few pixels, in the true scale
    if (scale === "true") expect((await placeOf(page, "earth"))!.r).toBeLessThan(0.2 * ((await page.locator(SPACE).boundingBox())!.height / 2));
  });
}

test("on a phone's tall screen both are still in view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  await callOn(page, "ride", "moon", { view: "beside", smooth: false });
  await bothInView(page, "moon", "earth");
});

test("the same from beside Io, with Jupiter behind it; and glides to the view and back to where the camera was", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  await callOn(page, "ride", "io", { view: "beside" });
  expect((await rideOf(page)).gliding, "it glides there").toBe(true);
  await expect.poll(async () => (await rideOf(page)).gliding, { timeout: 8000 }).toBe(false);
  await bothInView(page, "io", "jupiter");
  await callOn(page, "ride", null);
  expect((await rideOf(page)).gliding, "and glides back").toBe(true);
  await expect.poll(async () => (await rideOf(page)).gliding, { timeout: 8000 }).toBe(false);
  expect((await rideOf(page)).riding).toBe(false);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("earth");
});

test("the view from beside a moon is for a moon: a planet or a point of your own is refused", async ({ page }) => {
  await openSpace(page);
  await callOn(page, "ride", "mars", { view: "beside", smooth: false });
  expect((await rideOf(page)).riding).toBe(false);
  await page.locator(SPACE).evaluate((el) => (el as unknown as { ride(t: unknown, o: unknown): void }).ride({ at: () => null }, { view: "beside" }));
  expect((await rideOf(page)).riding).toBe(false);
});

test("north is up beside a moon, whatever the date: the picture's up the page reports has north near 1 at four dates a quarter of the Moon's month apart, and beside Io and Titan", async ({ page }) => {
  test.setTimeout(240_000);
  const up = async (): Promise<number[]> => ((await statsOf(page)) as unknown as { camera: { up: number[] } }).camera.up;
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  for (const [target, dates] of [
    ["moon", [Date.UTC(2026, 10, 2, 14), Date.UTC(2026, 10, 9, 20), Date.UTC(2026, 10, 17, 2), Date.UTC(2026, 10, 24, 8)]],
    ["io", [Date.UTC(2026, 10, 2, 14), Date.UTC(2026, 10, 3, 1)]],
    ["titan", [Date.UTC(2026, 10, 2, 14), Date.UTC(2026, 10, 10, 14)]],
  ] as const) {
    for (const when of dates) {
      await setOn(page, "time", when);
      await callOn(page, "ride", target, { view: "beside", smooth: false });
      await expect.poll(async () => (await rideOf(page)).riding && !(await rideOf(page)).gliding, { timeout: 30_000 }).toBe(true);
      await expect.poll(async () => (await up())[1]!, { timeout: 30_000, message: `beside ${target} at ${new Date(when).toISOString()}: north is up` }).toBeGreaterThan(0.99);
      await callOn(page, "ride", null, { smooth: false });
    }
  }
});
