// Every planet and moon of the space view shows its real picture in every look (MODULES-850, 809): the realistic look draws each body that has a surface map from it, Mars and the Moon included, so the finer map tiles
// come to them too. Chromium, drawing in software.
import { expect, test } from "@playwright/test";
import { openSpace, SPACE, statsOf } from "./space-ui.ts";
import { routeTiles } from "./tiles-fixture.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

test("the realistic look asks for the picture of every planet and of the Moon, as the painted look does", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&look=realistic");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "look"))).toBe("realistic");
  const wanted = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon"];
  await expect
    .poll(async () => page.evaluate(() => performance.getEntriesByType("resource").map((e) => /\/([a-z]+)-\d+\.webp/.exec(e.name)?.[1] ?? "")), { timeout: 60_000, message: "the pictures asked for" })
    .toEqual(expect.arrayContaining(wanted));
});

for (const body of ["mars", "moon"] as const) {
  test(`in the realistic look the ${body} gets the finer map tiles when the camera is near, as in the painted look`, async ({ page }) => {
    test.setTimeout(240_000);
    const log = await routeTiles(page);
    await openSpace(page, "t=2026-11-02T14:00Z&look=realistic");
    await page.locator(SPACE).evaluate((el, id) => {
      const s = el as unknown as { body: string; setView(v: unknown): void };
      s.body = id;
      s.setView({ yaw: 0, tilt: 0, zoom: 3.1 });
    }, body);
    await expect.poll(async () => (await statsOf(page) as unknown as { tiles: { shown: number | null } }).tiles.shown, { timeout: 90_000 }).toBe(3);
    expect(log.tiles.length).toBeGreaterThan(0);
    expect(log.tiles.every((tile) => tile.startsWith(`${body}/`))).toBe(true);
  });
}
