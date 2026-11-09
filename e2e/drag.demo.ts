// The surface under the pointer follows the pointer, in every look: drag right and it moves right, drag up and it moves up, the arrow keys agree, and Auto-turn goes the body's real way
// (the shared check of the family's drag rule: kazoku-ui's templates/e2e-ground.mjs, copied unchanged as e2e/ground.mjs). On top of it: exact grab (a drag of a few pixels moves the ground at
// the middle of the body by as many pixels, because the view controls are told the disc's radius) and the Turn button's direction (Mars goes right, Venus, which turns backwards, goes left).
// Real pointer events, real key presses, and the pictures compared. Chromium only, in software: the 3D looks have no software drawing in WebKit.
import { expect, test, type Page } from "@playwright/test";
import { checkFollowsTheHand, dragBy, groundShift, movedBy } from "./ground.mjs";

const URL = "/wakusei-planets/";
const CASES: readonly (readonly [string, string])[] = [
  ["mars", "line"],
  ["mars", "realistic"],
  ["mars", "painted"],
  ["venus", "painted"],
  ["moon", "painted"],
];
// the middle of the picture where the body is: the picture is wide and the body takes the middle of it
const WINDOW: [number, number, number, number] = [0.42, 0.58, 0.42, 0.58];

/** `upright`: the body's axis is set straight up for the check, as a drag turns it about its own axis, so a body whose axis leans on the page (Mars, 25 degrees) moves along a slanted path. */
async function open(page: Page, body: string, look: string, upright = false): Promise<void> {
  await page.goto(`${URL}?body=${body}&look=${look}`);
  if (upright) await page.locator("#main").evaluate((el) => el.setAttribute("tilt", "0"));
  const main = page.locator("#main");
  if (look !== "line") {
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  }
  await page.locator("#controls").evaluate((el) => (el as unknown as { pause(): void }).pause());
  await page.waitForTimeout(1500);
}

for (const [body, look] of CASES) {
  test(`${body}, ${look}: the surface follows a drag and the arrow keys, and Auto-turn goes the right way`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "a pointer and keyboard test, in software 3D");
    await open(page, body, look, true);
    await checkFollowsTheHand(page, { view: "#view", controls: "#controls", window: WINDOW, autoTurn: body === "venus" ? false : "right" });
  });
}

for (const [body, look] of [["mars", "painted"], ["moon", "painted"]] as const) {
  test(`${body}, ${look}: exact grab, a drag moves the ground at the middle by as many pixels`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "a pointer test, in software 3D");
    await open(page, body, look, true);
    const radius = await page.locator("#main").evaluate((el) => (el as unknown as { discRadius: number }).discRadius);
    expect(radius, "the disc has a radius on the screen").toBeGreaterThan(60);
    await expect(page.locator("#controls")).toHaveAttribute("grab-radius", String(Math.round(radius)));
    const view = page.locator("#view");
    const pixels = Math.max(12, Math.round(radius * 0.15));
    const moved = await movedBy(page, view, () => dragBy(page, view, pixels, 0), { reach: pixels * 2, window: WINDOW });
    expect(Math.abs(moved.x - pixels), `a drag of ${pixels} px moves the ground by ${pixels} px, within 25% (moved ${moved.x},${moved.y})`).toBeLessThanOrEqual(Math.max(3, pixels * 0.25));
    expect(Math.abs(moved.y)).toBeLessThanOrEqual(Math.max(3, pixels * 0.25));
    await dragBy(page, view, -pixels, 0);
    const up = await movedBy(page, view, () => dragBy(page, view, 0, -pixels), { reach: pixels * 2, window: WINDOW });
    expect(Math.abs(up.y + pixels), `a drag up of ${pixels} px moves the ground up by ${pixels} px, within 25% (moved ${up.x},${up.y})`).toBeLessThanOrEqual(Math.max(3, pixels * 0.25));
  });
}

// Venus turns backwards: its ground goes left while Turn runs (the picture is compared). Mars turns forwards, the other way: its Turn is the same call with the opposite sign, so the page's
// own sign is read (a positive turn is eastward, which the check above shows is to the right).
test("Venus: the Turn button turns the body its real way, the ground goes left", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "a pointer test, in software 3D");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, "venus", "painted", true);
  // A sharper cloud picture replaces the first one. Wait until that has stopped, or the check follows the swap.
  const width = async (): Promise<number> => page.locator("#main").evaluate((el) => (el as unknown as { stats: { textureWidth: number } }).stats.textureWidth);
  await expect.poll(async () => {
    const first = await width();
    await page.waitForTimeout(400);
    return (await width()) === first && first > 0 ? first : 0;
  }, { timeout: 30_000 }).toBeGreaterThan(0);
  const view = page.locator("#view");
  // The button is pressed without moving the pointer, and the speed row opens before the two pictures, so neither of those moves the globe.
  // The picture is put back on the live context after that, and the two pictures are taken while it keeps turning.
  await page.locator("#spin").evaluate((el: HTMLButtonElement) => el.click());
  await expect(page.locator("#main")).toHaveAttribute("turn", "-14");
  await page.locator("#main").evaluate((el) => (el as unknown as { goLive(): Promise<boolean> }).goLive());
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live");
  await page.waitForTimeout(200);
  // The two pictures are of the middle of the globe only: photographing the whole wide stage takes seconds on a slow machine, and the globe goes on turning meanwhile.
  const box = (await view.boundingBox())!;
  const clip = { x: box.x + box.width / 2 - 160, y: box.y + box.height / 2 - 100, width: 320, height: 200 };
  const before = await page.screenshot({ clip, scale: "css" });
  await page.waitForTimeout(1000);
  const after = await page.screenshot({ clip, scale: "css" });
  const turned = await groundShift(page, before, after, 110, [0.3, 0.7, 0.3, 0.7]);
  expect(turned.x, `Turn moves the ground left (moved ${turned.x},${turned.y})`).toBeLessThan(-3);
});

test("Mars turns forwards: the Turn button is a positive turn, and a body that turns backwards a negative one", async ({ page }) => {
  await page.goto(`${URL}?body=mars&look=line`);
  await page.locator("#spin").click();
  await expect(page.locator("#main")).toHaveAttribute("turn", "14");
  await page.goto(`${URL}?body=uranus&look=line&spin=1`);
  await expect(page.locator("#main")).toHaveAttribute("turn", "-14");
  await page.goto(`${URL}?body=jupiter&look=line&spin=1`);
  await expect(page.locator("#main")).toHaveAttribute("turn", "14");
});
