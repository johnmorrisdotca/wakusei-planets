import { expect, test } from "@playwright/test";

test("the embed frame turns by itself when it is asked to, and a line drawing is the same picture each time", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?body=mars&look=line&time=2026-11-02T12:00Z");
  const first = await page.locator("wakusei-body").evaluate((el) => el.shadowRoot?.innerHTML ?? "");
  await page.reload();
  const second = await page.locator("wakusei-body").evaluate((el) => el.shadowRoot?.innerHTML ?? "");
  expect(second).toBe(first);
});
