// Help mode's axis line and spin arrow have depth against their own body (MODULES-914): by default nothing of the white axis is drawn over the globe (it runs into the near pole and out of the far pole), and `help-through` brings back
// the whole lines. A picture test: the pixels of the axis' colour inside the disc. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

/** How many pixels inside the disc of a body are the colour of the help mode's axis line (#9fd0ff), in the picture of the view. */
async function axisPixelsOver(page: Page, id: string): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  const png = (await page.locator(SPACE).screenshot()).toString("base64");
  return page.evaluate(async ({ data, p }) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let n = 0;
    for (let y = Math.max(0, Math.floor(p.y - p.r)); y < Math.min(bitmap.height, p.y + p.r); y += 1) {
      for (let x = Math.max(0, Math.floor(p.x - p.r)); x < Math.min(bitmap.width, p.x + p.r); x += 1) {
        if (Math.hypot(x - p.x, y - p.y) > p.r * 0.85) continue;
        const i = (y * bitmap.width + x) * 4;
        if (Math.abs(px[i]! - 159) < 30 && Math.abs(px[i + 1]! - 208) < 30 && Math.abs(px[i + 2]! - 255) < 22) n += 1;
      }
    }
    return n;
  }, { data: png, p: place! });
}

for (const [body, look, scale] of [["mars", "realistic", "true"], ["mars", "painted", "compressed"], ["saturn", "realistic", "true"], ["earth", "realistic", "compressed"]] as const) {
  test(`${body}, ${look}, ${scale} scale: the axis is not drawn over the globe by default, and help-through draws all of it`, async ({ page }) => {
    test.setTimeout(180_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}&look=${look}`);
    await callOn(page, "goTo", body, { smooth: false });
    await setOn(page, "help", true);
    await settle(page, 2500);
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough")), "depth is the default").toBe(false);
    const hidden = await axisPixelsOver(page, body);
    await setOn(page, "helpThrough", true);
    await settle(page, 1200);
    const whole = await axisPixelsOver(page, body);
    expect(whole, `the whole axis over the ${body}: ${whole} pixels`).toBeGreaterThan(25);
    expect(hidden, `with depth only ${hidden} pixels of it are over the ${body}`).toBeLessThan(whole * 0.15);
    // and the attribute says the same
    await page.locator(SPACE).evaluate((el) => {
      el.setAttribute("help-through", "");
      el.removeAttribute("help-through");
    });
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(false);
    await page.locator(SPACE).evaluate((el) => el.setAttribute("help-through", ""));
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(true);
  });
}
