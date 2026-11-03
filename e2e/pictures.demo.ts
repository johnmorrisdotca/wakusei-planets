// The painted look draws from the pictures the package ships: Saturn's rings from the Cassini strip (and the table's strip when the look is realistic), and a moon from its map. Chromium, in software.
import { expect, test } from "@playwright/test";

const URL = "/wakusei-planets/";

test("painted Saturn asks for the Cassini ring strip, and the realistic look does not", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("response", (response) => {
    if (/saturn-ring-2048\.webp$/.test(response.url())) asked.push(`${response.status()}`);
  });
  await page.goto(`${URL}?body=saturn&look=painted`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(() => asked, { timeout: 10_000 }).toEqual(["200"]);
  asked.length = 0;
  await page.goto(`${URL}?body=saturn&look=realistic`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(1500);
  expect(asked).toEqual([]);
});

test("a painted moon draws from its map", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const asked: string[] = [];
  page.on("response", (response) => {
    if (/\/textures\/moon-\d+\.webp$/.test(response.url()) && response.status() === 200) asked.push(response.url().split("/").pop()!);
  });
  await page.goto(`${URL}?body=moon&look=painted`);
  await page.locator("#main").hover();
  await expect(page.locator("#main")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await expect.poll(() => asked.includes("moon-512.webp") || asked.includes("moon-1024.webp"), { timeout: 10_000 }).toBe(true);
});
