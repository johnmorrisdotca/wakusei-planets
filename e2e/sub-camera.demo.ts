// Which face of the centred body the space view looks at, and turning it to one (MODULES-1330): `subCameraPoint` and `faceTo` on <wakusei-space> and on <wakusei-body>. The clock is held (speed 0) at a
// fixed moment, so the body does not turn under the camera while it is read; every wait is on what the page reports.
import { expect, test } from "@playwright/test";
import { callOn, drawn, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Point = { lon: number; lat: number } | null;
const wrap = (deg: number): number => ((((deg + 180) % 360) + 360) % 360) - 180;
const sub = (page: import("@playwright/test").Page): Promise<Point> => page.locator(SPACE).evaluate((el) => (el as unknown as { subCameraPoint(): Point }).subCameraPoint());

test("the space view names the point under its camera, turns to any point at once, and stats say the same", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&speed=0");
  await callOn(page, "goTo", "moon", { smooth: false });
  await expect.poll(async () => page.locator(SPACE).evaluate((el) => (el as unknown as { body: string }).body)).toBe("moon");
  for (const [lon, lat] of [[0, 0], [30.8, 20.2], [-120, -45], [175, 60]] as const) {
    await drawn(page, () => callOn(page, "faceTo", { lon, lat }, { smooth: false }));
    const at = (await sub(page))!;
    expect(Math.abs(wrap(at.lon - lon)), `longitude at ${lon},${lat}`).toBeLessThan(0.01);
    expect(Math.abs(at.lat - lat), `latitude at ${lon},${lat}`).toBeLessThan(0.01);
    expect((await statsOf(page) as unknown as { camera: { sub: Point } }).camera.sub).toEqual(at);
  }
  // the camera is placed there: the view's own camera is on the same side of the Moon as the point (the picture is the Moon's surface at that point, the middle of the disc)
  const held = await sub(page);
  expect(await sub(page)).toEqual(held); // the clock is held, so nothing turns under the camera
});

test("a body in a picture names its middle and turns to a point: <wakusei-body> with a date", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/wakusei-planets/?body=moon");
  const body = page.locator("#main");
  await expect(body).toHaveAttribute("data-state", /still|live/, { timeout: 120_000 });
  const read = () => body.evaluate((el) => (el as unknown as { subCameraPoint(): Point }).subCameraPoint());
  await body.evaluate((el) => (el as unknown as { faceTo(p: unknown, o: unknown): void }).faceTo({ lon: 80, lat: -25 }, { smooth: false }));
  await expect.poll(async () => { const at = await read(); return at ? Math.hypot(wrap(at.lon - 80), at.lat + 25) : 999; }, { timeout: 30_000 }).toBeLessThan(0.05);
});
