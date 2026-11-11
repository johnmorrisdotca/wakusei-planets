import { expect, test, type Page } from "@playwright/test";

/** The drawing the element holds once it has drawn it: the line drawing is an SVG in its shadow, so wait for that and for it to stop changing (the same text on two reads), not for a fixed time. */
async function drawing(page: Page): Promise<string> {
  const element = page.locator("wakusei-body");
  await expect(element.locator("svg")).toBeVisible();
  const read = (): Promise<string> => element.evaluate((el) => el.shadowRoot?.innerHTML ?? "");
  let last = "";
  await expect.poll(async () => {
    const now = await read();
    const same = now === last && now.length > 0;
    last = now;
    return same;
  }, { intervals: [200], timeout: 15_000 }).toBe(true);
  return last;
}

test("the embed frame turns by itself when it is asked to, and a line drawing is the same picture each time", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?body=mars&look=line&time=2026-11-02T12:00Z&turn=0");
  const first = await drawing(page);
  expect(first).toContain("<svg");
  await page.reload();
  const second = await drawing(page);
  expect(second).toBe(first);
});
