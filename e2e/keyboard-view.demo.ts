// A reader with the keyboard only: from the top of the page, real Tab presses reach the view (it has a name), and the arrow keys turn it, with no click first. Read from the view controls' own state.
import { expect, test } from "@playwright/test";

const PAGES: readonly (readonly [string, string, string])[] = [
  ["the body page", "/wakusei-planets/?body=mars&look=line", "main"],
  ["the space view", "/wakusei-planets/space.html?t=2026-11-12T12:00:00Z&speed=0&play=off", "space"],
  ["the embed page", "/wakusei-planets/embed.html", "view"],
];

for (const [name, url, id] of PAGES) {
  test(`${name}: Tab reaches the view and the arrow keys turn it, with no click`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator(`#${id}`)).toBeAttached();
    await page.waitForTimeout(1500);
    const yaw = () => page.evaluate(() => Number((Reflect.get(document.querySelector("kazoku-view-controls")!, "state") as { yaw: number }).yaw));
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let reached = 0;
    for (let i = 1; i <= 60 && reached === 0; i += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((x) => document.activeElement?.id === x, id)) reached = i;
    }
    expect(reached, `Tab reaches #${id}`).toBeGreaterThan(0);
    expect(await page.locator(`#${id}`).getAttribute("aria-label"), "the view has a name").toBeTruthy();
    const before = await yaw();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await expect.poll(async () => Math.abs((await yaw()) - before), { timeout: 10_000, message: "the arrow keys turned the view" }).toBeGreaterThan(1);
  });
}

// An element a page adds with no tabindex of its own is a Tab stop all the same, so a page that forgets the attribute does not lock the keyboard out.
for (const tag of ["wakusei-body", "wakusei-space"]) {
  test(`a bare <${tag}> is a Tab stop and has a name`, async ({ page }) => {
    await page.goto("/wakusei-planets/embed.html");
    const stop = await page.evaluate(async (name) => {
      const el = document.createElement(name);
      el.id = "bare";
      if (name === "wakusei-body") el.setAttribute("look", "line");
      document.body.append(el);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { tabIndex: (el as HTMLElement).tabIndex, label: el.getAttribute("aria-label") ?? "", role: el.getAttribute("role") ?? "" };
    }, tag);
    expect(stop.tabIndex, "a Tab stop").toBe(0);
    expect(stop.label.length + (stop.role === "img" ? 1 : 0), "it has a name or a role").toBeGreaterThan(0);
  });
}
