import "./load.ts";
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

// `rate=0` holds the clock at the time asked for: with it running, two loads draw Mars at times a few milliseconds apart, and a coordinate that sits on a rounding edge (169.745) comes out 169.75 on one and 169.74 on the other (webkit-desk, 2026-11-18)
test("the embed frame turns by itself when it is asked to, and a line drawing is the same picture each time", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?body=mars&look=line&time=2026-11-02T12:00Z&turn=0&rate=0");
  const first = await drawing(page);
  expect(first).toContain("<svg");
  await page.reload();
  const second = await drawing(page);
  expect(second).toBe(first);
});
