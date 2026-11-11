// Help mode's axis line and spin arrow have depth against their own body (MODULES-914): by default less of them is drawn over the globe than whole (the axis runs into the near pole and out of the far pole, the part of the
// arrow behind the globe is hidden), and `help-through` brings back the whole lines. A picture test: the pixels inside the disc that help mode changes, with it off, with depth and whole. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const shot = async (page: Page): Promise<string> => (await page.locator(SPACE).screenshot()).toString("base64");

/** How many pixels inside the disc of a body differ between two pictures of the view (by more than a fifth of the brightness range). */
async function changedInside(page: Page, id: string, a: string, b: string): Promise<number> {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body), id);
  expect(place, `${id} is drawn`).not.toBeNull();
  return page.evaluate(async ({ pa, pb, p }) => {
    const read = async (data: string): Promise<Uint8ClampedArray> => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const [x0, x1] = [await read(pa), await read(pb)];
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${pa}`)).blob());
    let n = 0;
    for (let y = Math.max(0, Math.floor(p.y - p.r)); y < Math.min(bitmap.height, p.y + p.r); y += 1) {
      for (let x = Math.max(0, Math.floor(p.x - p.r)); x < Math.min(bitmap.width, p.x + p.r); x += 1) {
        if (Math.hypot(x - p.x, y - p.y) > p.r * 0.85) continue;
        const i = (y * bitmap.width + x) * 4;
        const d = Math.abs(x0[i]! - x1[i]!) + Math.abs(x0[i + 1]! - x1[i + 1]!) + Math.abs(x0[i + 2]! - x1[i + 2]!);
        if (d > 150) n += 1;
      }
    }
    return n;
  }, { pa: a, pb: b, p: place! });
}

for (const [body, look, scale] of [["mars", "realistic", "true"], ["mars", "painted", "compressed"], ["saturn", "realistic", "true"], ["earth", "realistic", "compressed"]] as const) {
  test(`${body}, ${look}, ${scale} scale: less of the help lines is drawn over the globe by default than whole with help-through`, async ({ page }) => {
    test.setTimeout(180_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}&look=${look}&play=off`);
    await callOn(page, "goTo", body, { smooth: false });
    await settle(page, 2500);
    const off = await shot(page);
    await setOn(page, "help", true);
    await settle(page, 1500);
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough")), "depth is the default").toBe(false);
    const depth = await shot(page);
    await setOn(page, "helpThrough", true);
    await settle(page, 1500);
    const whole = await shot(page);
    const hidden = await changedInside(page, body, off, depth);
    const full = await changedInside(page, body, off, whole);
    expect(full, `help-through changes ${full} pixels over the ${body}`).toBeGreaterThan(25);
    expect(hidden, `with depth help changes ${hidden} pixels over the ${body}, against ${full} whole`).toBeLessThan(full);
    // the attribute and the property say the same
    await page.locator(SPACE).evaluate((el) => {
      el.setAttribute("help-through", "");
      el.removeAttribute("help-through");
    });
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(false);
    await page.locator(SPACE).evaluate((el) => el.setAttribute("help-through", ""));
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "helpThrough"))).toBe(true);
  });
}
