// The code builder page: the family's <kazoku-embed-panel> with the builder's own choices in it, and the code for exactly what is chosen, for every way a page is made.
import { expect, test } from "@playwright/test";

test("the code builder writes the code for exactly what is chosen, and nothing scrolls sideways", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  await page.goto("/wakusei-planets/builder.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const code = page.locator('#embed-panel [part="code"]');
  await expect(code).toContainText('body="saturn"');
  await page.locator('[data-testid="body-mars"]').click();
  await page.locator('[data-testid="look-line"]').click();
  await page.locator('#embed-panel button[data-size="240"]').click();
  await page.locator('[data-testid="turn-12"]').click();
  await expect(code).toContainText('body="mars"');
  await expect(code).toContainText("240");
  await expect(code).toContainText("12");
  await page.locator('#embed-panel button[data-kind="iframe"]').click();
  await expect(code).toContainText("embed.html?");
  await expect(page.locator('#embed-panel [part="open"]')).toHaveAttribute("href", /embed\.html\?.*body=mars/);
  await page.locator('#embed-panel button[data-kind="react"]').click();
  await expect(code).toContainText("wakusei-body");
  // a planet's moons are a row of their own
  await page.locator('[data-testid="group-jupiter"]').click();
  await expect(page.locator('[data-testid="body-io"]')).toBeVisible();
  await expect(page.locator('[data-testid="body-mars"]')).toHaveCount(0);
  await expect(page.locator('#embed-panel [part="preview"] wakusei-body')).toHaveAttribute("body", "io");
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sideways).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
});

test("nothing the builder had before the shared panel is gone: its rows, seven tabs, four sizes, a picture, Copy, the embed page and the credit, and a docs link besides", async ({ page }) => {
  await page.goto("/wakusei-planets/builder.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const panel = page.locator("#embed-panel");
  await expect(page.locator("#groups button")).toHaveCount(12);
  await expect(page.locator("#bodies button")).toHaveCount(10);
  await expect(page.locator("#looks button")).toHaveText(["line", "realistic", "painted"]);
  await expect(page.locator("#skies button")).toHaveText(["A portrait", "The sky right now"]);
  await expect(page.locator("#turns button")).toHaveText(["Still", "Slow", "Fast"]);
  await expect(panel.locator('[role="tab"]')).toHaveText(["HTML", "ES module", "React", "Vue", "Angular", "Svelte", "iframe"]);
  await expect(panel.locator('[part="size-button"]')).toHaveText(["160", "240", "320", "480"]);
  await expect(panel.locator('[part="size-button"][aria-pressed="true"]')).toHaveText("320");
  await expect(panel.locator('[part="preview"] wakusei-body')).toHaveCount(1);
  await expect(panel.locator('[part="copy"]')).toHaveText("Copy code");
  await expect(panel.locator('[part="open"]')).toHaveText("Open the embed page");
  await expect(panel.locator('[part="open"]')).toHaveAttribute("href", /^embed\.html\?body=saturn&look=line/);
  await expect(panel.locator('[part="docs"]')).toHaveAttribute("href", "docs/");
  await expect(panel.locator('[part="credits"]')).toContainText("Wakusei Planets by John Morris (MIT)");
  await page.locator('[data-testid="look-painted"]').click();
  await expect(panel.locator('[part="credits"]')).toContainText("NASA, USGS and JPL");
});
