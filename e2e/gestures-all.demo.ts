// kazoku-ui's shared gesture check on the 3D views: every gesture of the view controls (turn, roll, keys, wheel, pinch, every kind of move) changes the view as the guide says, and the picture
// moves by as many pixels as the controls report. Chromium in software drawing, one view at a time.
import { checkGestures, COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const live = async (page: Page, selector: string): Promise<void> => {
  await expect(page.locator(selector)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(800);
};

test("every gesture works on the space view", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z");
  await live(page, "wakusei-space");
  await checkGestures(page, "wakusei-space", { controls: "#controls", ready: () => page.waitForTimeout(250) });
});

test("every gesture works on the body view in its shaded look", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/?body=mars&look=realistic");
  await page.locator("#main").hover();
  await live(page, "#main");
  await checkGestures(page, "#main", { controls: "#controls", ready: () => page.waitForTimeout(250) });
});
