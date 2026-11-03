// The surface under the pointer follows the pointer, in every look: drag right and it moves right, drag up and it moves up, and the arrow keys agree. Real pointer events, real key presses,
// and the pictures compared: the surface's move is found by sliding the middle of the first picture over the second (e2e/ground.ts). Bodies with features to follow only: a banded
// planet looks the same when it turns. Chromium only, in software: the 3D looks have no software drawing in WebKit.
import { expect, test, type Page } from "@playwright/test";
import { dragBy, groundShift } from "./ground.ts";

const URL = "/wakusei-planets/";
const MIN = 8;
const CASES: readonly (readonly [string, string])[] = [
  ["mars", "line"],
  ["mars", "realistic"],
  ["mars", "painted"],
  ["venus", "painted"],
  ["moon", "painted"],
];

async function open(page: Page, body: string, look: string): Promise<void> {
  await page.goto(`${URL}?body=${body}&look=${look}`);
  const main = page.locator("#main");
  if (look !== "line") {
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  }
  await page.locator("#controls").evaluate((el) => (el as unknown as { pause(): void }).pause());
  await page.waitForTimeout(1500);
}

for (const [body, look] of CASES) {
  test(`${body}, ${look}: the surface follows a drag and the arrow keys`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "a pointer and keyboard test, in software 3D");
    await open(page, body, look);
    const view = page.locator("#view");
    const moved = async (act: () => Promise<void>): Promise<{ x: number; y: number }> => {
      const before = await view.screenshot();
      await act();
      await page.waitForTimeout(900);
      const shift = await groundShift(page, before, await view.screenshot(), 70);
      return { x: shift.x, y: shift.y };
    };
    const right = await moved(() => dragBy(page, view, 30, 0));
    expect(right.x, `a drag right moves the surface right (moved ${right.x},${right.y})`).toBeGreaterThan(MIN);
    await dragBy(page, view, -30, 0);
    const up = await moved(() => dragBy(page, view, 0, -30));
    expect(up.y, `a drag up moves the surface up (moved ${up.x},${up.y})`).toBeLessThan(-MIN);
    await dragBy(page, view, 0, 30);
    await page.waitForTimeout(600);

    await view.focus();
    const arrowRight = await moved(() => page.keyboard.press("ArrowRight"));
    expect(arrowRight.x, `the right arrow moves the surface right (moved ${arrowRight.x},${arrowRight.y})`).toBeGreaterThan(MIN);
    await page.keyboard.press("ArrowLeft");
    const arrowUp = await moved(() => page.keyboard.press("ArrowUp"));
    expect(arrowUp.y, `the up arrow moves the surface up (moved ${arrowUp.x},${arrowUp.y})`).toBeLessThan(-MIN);
  });
}
