// A ride starts the space page's clock, and Off puts it back as it was: held if the ride started it, running at its own speed if it was already playing. Chromium, drawing in software.
import { expect, type Page, test } from "@playwright/test";
import { openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const ride = (page: Page, name: string) => page.getByRole("group", { name: "Ride along" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
const speedOf = (page: Page): Promise<number> => page.locator(SPACE).evaluate((el) => Number(Reflect.get(el, "speed")));
/** Wait for the move to end, then count the draws over thirty of the page's own frames. */
async function drawsOverThirtyFrames(page: Page): Promise<number> {
  await expect.poll(async () => (await statsOf(page) as unknown as { ride: { gliding: boolean } }).ride.gliding, { timeout: 90_000 }).toBe(false);
  await expect.poll(async () => (await statsOf(page) as unknown as { travelling: unknown }).travelling, { timeout: 30_000 }).toBeNull();
  // counted in the one call, so no draw lands between the first count and the first frame
  return page.locator(SPACE).evaluate(async (el) => {
    const stats = (): number => Number((Reflect.get(el, "stats") as { draws: number }).draws);
    const before = stats();
    for (let frame = 0; frame < 30; frame += 1) await new Promise((resolve) => requestAnimationFrame(resolve));
    return stats() - before;
  });
}

test("a ride that started the clock stops it again on Off, and the view then draws nothing", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z");
  expect(await speedOf(page), "the clock is held to begin with").toBe(0);
  await ride(page, "The Moon");
  await expect.poll(async () => speedOf(page), { message: "the ride starts the clock" }).toBeGreaterThan(0);
  const started = (await statsOf(page)).time;
  await expect.poll(async () => (await statsOf(page)).time, { message: "and it runs" }).toBeGreaterThan(started);
  await ride(page, "Off");
  await expect.poll(async () => speedOf(page), { message: "Off holds it again" }).toBe(0);
  expect(await drawsOverThirtyFrames(page), "nothing is drawn at rest after the ride").toBe(0);
});

test("a clock that was playing before the ride keeps playing at its speed after Off", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=on&speed=3600");
  expect(await speedOf(page)).toBe(3600);
  await ride(page, "Mars");
  await ride(page, "Off");
  await expect.poll(async () => (await statsOf(page) as unknown as { ride: { gliding: boolean } }).ride.gliding, { timeout: 90_000 }).toBe(false);
  expect(await speedOf(page), "still at its speed").toBe(3600);
  const before = (await statsOf(page)).time;
  await expect.poll(async () => (await statsOf(page)).time, { message: "and still running" }).toBeGreaterThan(before);
});
