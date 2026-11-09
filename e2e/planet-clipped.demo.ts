import { expect, test, type Locator, type Page } from "@playwright/test";

/** Sample the rendered stage, including the area beyond the old square view. */
async function pixel(page: Page, stage: Locator, x: number, y: number): Promise<number> {
  const png = (await stage.screenshot({ scale: "css" })).toString("base64");
  return page.evaluate(async ({ png, x, y }) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    return data[0]! + data[1]! + data[2]!;
  }, { png, x, y });
}

async function stageGeometry(page: Page, view: Locator) {
  const stage = page.locator(".space-stage");
  const bounds = await stage.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    return { width: rect.width, x: rect.x, y: rect.y, inner: rect.width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) };
  });
  return { stage, bounds, view: (await view.boundingBox())! };
}

test("a panned Jupiter in the moons view is not cut at the old square edge", async ({ page }) => {
  await page.goto("/wakusei-planets/?moons=1&sky=real&t=2026-11-09T10:53:00Z");
  const body = page.locator("#main");
  await body.evaluate((el) => { el.setAttribute("live", "always"); el.setAttribute("range", "4"); });
  await expect(body).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  const before = await stageGeometry(page, page.locator("#view"));
  const pan = before.view.height < 450 ? 40 : 220;
  await body.evaluate((el, amount) => Reflect.apply(Reflect.get(el, "setView"), el, [{ zoom: 1.5, panX: amount, panY: 0 }]), pan);
  await page.waitForTimeout(1200);
  const { stage, bounds, view } = await stageGeometry(page, page.locator("#view"));
  const radius = view.height * 1.5 / 8;
  const x = bounds.width / 2 + pan + radius * 0.6;
  const y = view.y - bounds.y + view.height / 2;
  expect(await pixel(page, stage, x, y), "Jupiter's right side is drawn inside the stage").toBeGreaterThan(70);
  expect(view.width).toBeCloseTo(bounds.inner, 0);
});

test("an off-centre Earth in space is not cut at the old square edge", async ({ page }) => {
  await page.goto("/wakusei-planets/space.html?t=2026-11-09T10:53:00Z");
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  const { view: before } = await stageGeometry(page, page.locator("#sky"));
  const yaw = before.height < 450 ? 5 : 32;
  await space.evaluate((el, angle) => {
    Reflect.set(el, "light", "lit");
    Reflect.set(el, "labels", false);
    Reflect.apply(Reflect.get(el, "ride"), el, [{ at: () => ({ position: [0, 0, 19134.411], velocity: [0, 7, 0] }) }, { around: "earth", look: "down", smooth: false }]);
    Reflect.apply(Reflect.get(el, "setView"), el, [{ yaw: angle, tilt: 0, zoom: 1 }, true]);
  }, yaw);
  await page.waitForTimeout(2000);
  const { stage, bounds, view } = await stageGeometry(page, page.locator("#sky"));
  const y = view.y - bounds.y + view.height / 2;
  const x = bounds.width / 2 + view.height * (view.height < 450 ? 0.22 : 0.54);
  expect(await pixel(page, stage, x, y), "Earth's right side is drawn inside the stage").toBeGreaterThan(50);
  expect(view.width).toBeCloseTo(bounds.inner, 0);
});
