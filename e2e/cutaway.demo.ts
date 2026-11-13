// The interior cutaway's legend. The shells and the graphics objects they give back are in freeze.demo.ts.
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
  // Chromium takes the throttle. WebKit has no CDP session for it; the same test still runs there.
  try {
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  } catch {
    // WebKit.
  }
});

/** The legend's rows, read in one go. `null` while the list is hidden. */
const legend = (page: Page) =>
  page.locator("#main").evaluate((el) => {
    const list = el.shadowRoot?.querySelector("#cutaway");
    if (!(list instanceof HTMLElement) || list.hidden) return null;
    return [...list.querySelectorAll("li")].map((item) => ({
      layer: (item as HTMLElement).dataset.layer ?? "",
      empty: (item as HTMLElement).dataset.empty !== undefined,
      name: item.querySelector("[data-name]")?.textContent ?? "",
      depth: item.querySelector("[data-depth]")?.textContent ?? "",
    }));
  });

test("the Earth's legend matches its layers, Japanese follows the language, and a body with no figures says so", async ({ page }) => {
  await page.goto("/wakusei-planets/?look=line&body=earth");
  const body = page.locator("#main");
  await expect(body).toHaveAttribute("body", "earth");
  await body.evaluate((el) => el.setAttribute("cutaway", ""));
  await expect.poll(() => legend(page)).toEqual([
    { layer: "crust", empty: false, name: "Crust", depth: "0 km to about 30 km" },
    { layer: "mantle", empty: false, name: "Mantle", depth: "about 30 km to 2886 km" },
    { layer: "outer-core", empty: false, name: "Outer core", depth: "2886 km to about 5150 km" },
    { layer: "inner-core", empty: false, name: "Inner core", depth: "about 5150 km to 6371 km" },
  ]);
  await body.evaluate((el) => el.setAttribute("lang", "ja"));
  await expect.poll(() => legend(page)).toEqual([
    { layer: "crust", empty: false, name: "地殻", depth: "0 km から 約 30 km" },
    { layer: "mantle", empty: false, name: "マントル", depth: "約 30 km から 2886 km" },
    { layer: "outer-core", empty: false, name: "外核", depth: "2886 km から 約 5150 km" },
    { layer: "inner-core", empty: false, name: "内核", depth: "約 5150 km から 6371 km" },
  ]);
  await body.evaluate((el) => el.removeAttribute("cutaway"));
  await expect.poll(() => legend(page)).toBeNull();
  await page.goto("/wakusei-planets/?look=line&body=jupiter");
  await page.locator("#main").evaluate((el) => el.setAttribute("cutaway", ""));
  await expect.poll(() => legend(page)).toEqual([{ layer: "", empty: true, name: "", depth: "" }]);
});
