// kazoku-ui's shared gesture check on the other pages that carry the shared controls: the star page, and the embed page (a body, and a portrait, which is flat). The portrait page itself has its own
// hands (`controls="none"`: bodies are chosen, dragged and sized one by one), so the shared check does not apply to it; its embed does, and is checked here.
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

test("every gesture works on the star page", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/star.html");
  await page.locator("#star").hover();
  await live(page, "#star");
  await checkGestures(page, "#star", { controls: "#controls", ready: () => page.waitForTimeout(250) });
});

test("every gesture works on the embed page's body", async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/embed.html?body=mars&look=realistic&turn=0");
  await page.locator("#view").hover();
  await live(page, "#view");
  await expect(page.locator("kazoku-view-controls")).toBeAttached();
  await checkGestures(page, "#view", { ready: () => page.waitForTimeout(250) });
});

test("every gesture a flat portrait has works on the embed page's portrait", async ({ page }) => {
  test.setTimeout(600_000);
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto(`/wakusei-planets/embed.html?scene=${encodeURIComponent("look:painted~jupiter_-0.3_0_0.25_0~io_0.45_0.15_0.1_0~mars_0.1_-0.35_0.12_0")}`);
  await live(page, "#view");
  await expect(page.locator("kazoku-view-controls")).toBeAttached();
  const flat = "a portrait is a flat picture: it has no turn and no roll";
  await checkGestures(page, "#view", { lacks: { turn: flat, roll: flat, "key-turn": flat }, window: [0, 1, 0, 1], zoom: 1.5, ready: () => page.waitForTimeout(250) });
});
