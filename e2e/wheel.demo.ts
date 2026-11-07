import { expect, test } from "@playwright/test";

test("Ctrl and the wheel zooms the body", async ({ page }) => {
  await page.goto("/wakusei-planets/");
  const bar = page.locator("#controls");
  const view = page.locator("#view");
  await expect(bar).toBeVisible();
  await view.scrollIntoViewIfNeeded();
  const zoom = () => bar.evaluate((el: HTMLElement & { state: { zoom: number } }) => el.state.zoom);
  await expect.poll(zoom).toBeGreaterThan(0);
  const before = await zoom();
  const box = await view.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -240);
  await page.keyboard.up("Control");
  await expect.poll(zoom).toBeGreaterThan(before);
});
