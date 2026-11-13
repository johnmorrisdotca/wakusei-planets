// Moons in the squeezed view grow with moon-size. Jupiter is close enough that the radius on the screen can be read; Saturn and Uranus are pictured at the same two sizes.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&speed=0&scale=compressed";

test("squeezed moons grow from the default size to 4", async ({ page }, testInfo) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { stats: { distance: number } }).stats.distance)).toBeGreaterThan(1);

  // no glide (smooth: false): the camera stands still, so the radii read before and after a change are of the same view
  const show = (body: string, zoom: number) => space.evaluate((el, arg) => {
    const view = el as unknown as { scale: string; goTo: (name: string, options: { smooth: boolean; zoom: number }) => void };
    view.scale = "compressed";
    view.goTo(arg.body, { smooth: false, zoom: arg.zoom });
  }, { body, zoom });
  const size = (n: number) => space.evaluate((el, value) => {
    (el as unknown as { moonSize: number }).moonSize = value;
  }, n);
  const radius = (id: string) => space.evaluate((el, name) => (el as unknown as { placeOf: (body: string) => { r: number } | null }).placeOf(name)?.r ?? 0, id);
  const report = () => space.evaluate((el) => (el as unknown as { stats: { moonSize: { asked: number; factor: number; clamped: boolean } } }).stats.moonSize);

  await show("jupiter", 0.22);
  await expect.poll(() => space.evaluate((el) => (el as unknown as { body: string }).body)).toBe("jupiter");
  await size(2);
  await expect.poll(() => radius("ganymede")).toBeGreaterThan(2);
  const atDefault = await radius("ganymede");
  await testInfo.attach("moon-jupiter-size-2", { body: await page.screenshot(), contentType: "image/png" });
  expect((await report()).factor).toBeCloseTo(2, 5);
  await size(4);
  // twice the factor draws Ganymede about twice as wide (nothing at Jupiter limits 4); read until the next draw has it
  await expect.poll(() => radius("ganymede")).toBeGreaterThan(atDefault * 1.6);
  const atFour = await radius("ganymede");
  expect(atFour).toBeLessThan(atDefault * 2.4);
  const jupiter = await report();
  expect(jupiter.asked).toBe(4);
  expect(jupiter.factor).toBeCloseTo(4, 5);
  await testInfo.attach("moon-jupiter-size-4", { body: await page.screenshot(), contentType: "image/png" });

  for (const body of ["saturn", "uranus"]) {
    await show(body, 0.1);
    await expect.poll(() => space.evaluate((el) => (el as unknown as { body: string }).body)).toBe(body);
    await size(2);
    await expect.poll(() => report()).toMatchObject({ asked: 2, factor: 2 });
    await testInfo.attach(`moon-${body}-size-2`, { body: await page.screenshot(), contentType: "image/png" });
    await size(4);
    await expect.poll(() => report()).toMatchObject({ asked: 4, factor: 4 });
    await testInfo.attach(`moon-${body}-size-4`, { body: await page.screenshot(), contentType: "image/png" });
  }
});
