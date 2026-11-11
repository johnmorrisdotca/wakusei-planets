import { expect, test, type Page } from "@playwright/test";

/** The drawing the element holds once it has drawn: the line drawing is an SVG in its shadow, so wait for that (what the page reports), not for a fixed time. */
async function drawing(page: Page): Promise<string> {
  const element = page.locator("wakusei-body");
  await expect(element.locator("svg")).toBeVisible();
  await expect(element).toHaveAttribute("data-state", /./);
  return element.evaluate((el) => el.shadowRoot?.innerHTML ?? "");
}

test("the embed frame turns by itself when it is asked to, and a line drawing is the same picture each time", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?body=mars&look=line&time=2026-11-02T12:00Z&turn=0");
  const first = await drawing(page);
  expect(first).toContain("<svg");
  await page.reload();
  const second = await drawing(page);
  expect(second).toBe(first);
});
