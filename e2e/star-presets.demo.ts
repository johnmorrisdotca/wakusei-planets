// The star page's presets are the size line-up's rows, so the two pages give the same radius for the same star.
import { expect, test } from "@playwright/test";
import { LINEUP_STARS } from "../src/lineup/data.ts";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "the numbers do not depend on the browser");
});

for (const [preset, id] of [["sirius-a", "sirius-a"], ["betelgeuse", "betelgeuse"], ["vega", "vega"], ["rigel", "rigel"]] as const) {
  test(`the ${preset} preset on the star page has the line-up's radius and temperature`, async ({ page }) => {
    const row = LINEUP_STARS.find((one) => one.id === id)!;
    await page.goto(`/wakusei-planets/star.html?star=${preset}&look=line`);
    await expect(page.locator("#n-radius")).toHaveValue(String(row.radiusSun));
    await expect(page.locator("#n-temperature")).toHaveValue(String(row.look.temperatureK));
  });
}

test("Betelgeuse is 1,057 Suns on the star page, Sirius A 1.7144 and Vega 2.726", async ({ page }) => {
  for (const [preset, radius] of [["betelgeuse", "1057"], ["sirius-a", "1.7144"], ["vega", "2.726"]] as const) {
    await page.goto(`/wakusei-planets/star.html?star=${preset}&look=line`);
    await expect(page.locator("#n-radius")).toHaveValue(radius);
  }
});
