// The Sun is a globe like the others in the turning view (MODULES-922): its surface turns with the view and with its own spin, while its glow still faces the camera. A picture test: the Sun's pixels change when
// the view turns and when days pass, in both looks and both scales, and are the same when nothing has turned. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const shot = async (page: Page): Promise<string> => (await page.locator(SPACE).screenshot()).toString("base64");

/** How many pixels inside the Sun's disc differ between two pictures of the view. */
async function changed(page: Page, a: string, b: string): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf("sun"));
  expect(place, "the Sun is drawn").not.toBeNull();
  return page.evaluate(async ({ pa, pb, p }) => {
    const read = async (data: string): Promise<{ px: Uint8ClampedArray; width: number; height: number }> => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return { px: context.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
    };
    const [x, y] = [await read(pa), await read(pb)];
    let n = 0;
    for (let j = Math.max(0, Math.floor(p.y - p.r)); j < Math.min(x.height, p.y + p.r); j += 1) {
      for (let i = Math.max(0, Math.floor(p.x - p.r)); i < Math.min(x.width, p.x + p.r); i += 1) {
        if (Math.hypot(i - p.x, j - p.y) > p.r * 0.8) continue;
        const k = (j * x.width + i) * 4;
        if (Math.abs(x.px[k]! - y.px[k]!) + Math.abs(x.px[k + 1]! - y.px[k + 1]!) + Math.abs(x.px[k + 2]! - y.px[k + 2]!) > 60) n += 1;
      }
    }
    return n;
  }, { pa: a, pb: b, p: place! });
}

for (const [look, scale] of [["realistic", "true"], ["painted", "compressed"]] as const) {
  test(`${look}, ${scale} scale: the Sun's face changes when the view turns and when days pass, and not when nothing turns`, async ({ page }) => {
    test.setTimeout(180_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}&look=${look}&play=off`);
    await callOn(page, "goTo", "sun", { smooth: false });
    await settle(page, 2500);
    const first = await shot(page);
    await settle(page, 800);
    const again = await shot(page);
    expect(await changed(page, first, again), "nothing turned: the same picture").toBeLessThan(60);
    // the view turns about the Sun: another side of it comes round
    await page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void }).setView({ yaw: 90, tilt: 0, zoom: 1 }));
    await settle(page, 1500);
    const turnedView = await shot(page);
    expect(await changed(page, first, turnedView), "the view turned a quarter: the Sun shows another face").toBeGreaterThan(300);
    await page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void }).setView({ yaw: 0, tilt: 0, zoom: 1 }));
    await settle(page, 1500);
    const back = await shot(page);
    expect(await changed(page, first, back), "turned back, it is the same face again").toBeLessThan(150);
    // its own spin: a few days later (the Sun turns 14 degrees a day) the markings have moved
    await setOn(page, "time", Date.UTC(2026, 10, 7, 14));
    await settle(page, 1800);
    const later = await shot(page);
    expect(await changed(page, first, later), "five days on, the Sun has turned about 70 degrees").toBeGreaterThan(300);
  });
}
