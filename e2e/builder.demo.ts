// The code builder page: one screen of choices, and the code for exactly what is chosen, for every way a page is made.
import { expect, test } from "@playwright/test";

test("the code builder writes the code for exactly what is chosen, and nothing scrolls sideways", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  await page.goto("/wakusei-planets/builder.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const code = page.locator('[data-testid="builder-code"]');
  await expect(code).toContainText('body="saturn"');
  await page.locator('[data-testid="body-mars"]').click();
  await page.locator('[data-testid="look-line"]').click();
  await page.locator('[data-testid="size-240"]').click();
  await page.locator('[data-testid="turn-12"]').click();
  await expect(code).toContainText('body="mars"');
  await expect(code).toContainText("240");
  await expect(code).toContainText("12");
  await page.locator('[data-testid="kind-iframe"]').click();
  await expect(code).toContainText("embed.html?");
  await expect(page.locator('[data-testid="builder-open"]')).toHaveAttribute("href", /embed\.html\?.*body=mars/);
  await page.locator('[data-testid="kind-react"]').click();
  await expect(code).toContainText("wakusei-body");
  // a planet's moons are a row of their own
  await page.locator('[data-testid="group-jupiter"]').click();
  await expect(page.locator('[data-testid="body-io"]')).toBeVisible();
  await expect(page.locator('[data-testid="body-mars"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="builder-preview"] wakusei-body')).toHaveAttribute("body", "io");
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
});
