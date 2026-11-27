// The interior cutaway's legend. The shells and the graphics objects they give back are in freeze.demo.ts.
import { expect, test, type Page } from "@playwright/test";
import type { WakuseiBody } from "../src/element.ts";

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
    { layer: "mantle", empty: false, name: "Mantle", depth: "about 30 km to 2,890 km" },
    { layer: "outer-core", empty: false, name: "Outer core", depth: "2,890 km to about 5,150 km" },
    { layer: "inner-core", empty: false, name: "Inner core", depth: "about 5,150 km to 6,370 km" },
  ]);
  await body.evaluate((el) => el.setAttribute("lang", "ja"));
  await expect.poll(() => legend(page)).toEqual([
    { layer: "crust", empty: false, name: "地殻", depth: "0 km から 約30 km" },
    { layer: "mantle", empty: false, name: "マントル", depth: "約30 km から 2,890 km" },
    { layer: "outer-core", empty: false, name: "外核", depth: "2,890 km から 約5,150 km" },
    { layer: "inner-core", empty: false, name: "内核", depth: "約5,150 km から 6,370 km" },
  ]);
  await body.evaluate((el) => el.removeAttribute("cutaway"));
  await expect.poll(() => legend(page)).toBeNull();
  await page.goto("/wakusei-planets/?look=line&body=ceres");
  await page.locator("#main").evaluate((el) => el.setAttribute("cutaway", ""));
  await expect.poll(() => legend(page)).toEqual([{ layer: "", empty: true, name: "", depth: "" }]);
});

test("the Venus legend explains the two models and leaves room for the cross-section", async ({ page }) => {
  await page.goto("/wakusei-planets/?look=line&body=venus&cutaway=quarter");
  const body = page.locator("#main");
  await expect(body.locator("#stage svg [data-layer]")).toHaveCount(2);
  await expect(body.locator("#cutaway [data-note]")).toHaveText(/Margot.+3,500 km.+500 km.+Dumoulin.+2,900–3,450 km/);
  await body.evaluate((el) => el.setAttribute("lang", "ja"));
  await expect(body.locator("#cutaway [data-name]").first()).toHaveText("マントル");
  await expect(body.locator("#cutaway [data-note]")).toHaveText(/約3,500 km.+約500 km.+2,900〜3,450 km/);
  await expect.poll(() => body.evaluate((el) => {
    const stage = el.shadowRoot!.getElementById("stage")!.getBoundingClientRect();
    const legend = el.shadowRoot!.getElementById("cutaway-panel")!.getBoundingClientRect();
    return stage.bottom <= legend.top + 1 && stage.height > 0 && legend.width <= el.clientWidth;
  })).toBe(true);
});

test("explicit cut sizes carry over to the line view, where flow can be played and paused", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/wakusei-planets/?body=earth&look=line&cutaway=half");
  const body = page.locator("#main");
  const cuts = page.getByRole("group", { name: "Cutaway", exact: true });
  await expect(cuts.getByRole("button", { name: "Cross-section" })).toHaveAttribute("aria-pressed", "true");
  const band = body.locator("#stage svg [data-flow]").first();
  const still = await band.getAttribute("d");
  await page.getByRole("button", { name: "Play flow" }).click();
  await body.scrollIntoViewIfNeeded();
  await expect(band).not.toHaveAttribute("d", still ?? "");
  await page.getByRole("button", { name: "Pause flow" }).click();
  const paused = await band.getAttribute("d");
  await page.waitForTimeout(180);
  await expect(band).toHaveAttribute("d", paused ?? "");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("#cutaway-flow")).toBeHidden();
  await cuts.getByRole("button", { name: "Off", exact: true }).click();
  await expect(body.locator("#cutaway-panel")).toBeHidden();
  await expect(band).toHaveCount(0);
});

test("Jupiter's rings do not pull either 3D cut farther back than the classic fit", async ({ page }) => {
  await page.goto("/wakusei-planets/?body=jupiter&look=realistic&cutaway=quarter");
  const body = page.locator("#main");
  for (const size of ["quarter", "half"]) {
    await page.locator(`#cutaway-options button[data-cutaway="${size}"]`).click();
    await expect(body).toHaveAttribute("cutaway", size);
    const visibleFraction = await body.evaluate((el) => {
      const stage = el.shadowRoot!.getElementById("stage")!;
      return (2 * (el as WakuseiBody).discRadius) / Math.min(stage.clientHeight, stage.clientWidth);
    });
    expect(visibleFraction).toBeCloseTo(1 / 2.2, 3);
  }
});
