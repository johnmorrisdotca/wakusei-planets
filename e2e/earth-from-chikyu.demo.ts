// The Earth in the shaded looks drawn by chikyu-earth's realistic element, for a page that asks (`earth-from="chikyu"`) and has imported it, in Chromium drawn in software: its day and night by the real Sun
// instead of this package's lit picture, its own WebGL context beside this package's (this package makes none for the body another package draws), nothing drawn at rest, and this package's own Earth again when the
// attribute goes or the element is not on the page.
import "./load.ts";
import { COUNT_SCRIPT, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";

const URL = "/wakusei-planets/";
const main = (page: Page) => page.locator("#main");
const globe = (page: Page) => page.locator("#main chikyu-earth-realistic");

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Software WebGL is Chromium's");
  await page.addInitScript(COUNT_SCRIPT);
});

/**
 * How much of the picture's middle is dark and how much is bright: a lit Earth has both, a day and a night side.
 * This date faces mostly night. On a phone the day limb was 9 per cent of the middle, so a day side is a real bright share, not a tenth of the picture.
 */
const sides = async (page: Page): Promise<{ dark: number; bright: number }> => {
  const png = (await main(page).screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let dark = 0;
    let bright = 0;
    let all = 0;
    const cx = bitmap.width / 2;
    const cy = bitmap.height / 2;
    const radius = Math.min(cx, cy) * 0.7;
    for (let y = 0; y < bitmap.height; y += 2) {
      for (let x = 0; x < bitmap.width; x += 2) {
        if (Math.hypot(x - cx, y - cy) > radius) continue;
        const i = (y * bitmap.width + x) * 4;
        const lum = (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
        all += 1;
        if (lum < 40) dark += 1;
        else if (lum > 110) bright += 1;
      }
    }
    return { dark: dark / all, bright: bright / all };
  }, png);
};

test("with chikyu-earth's realistic element on the page and earth-from=chikyu, the shaded Earth is its realistic Earth: day and night, two contexts at most, nothing drawn at rest", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${URL}?body=earth&look=realistic&earth-from=chikyu&time=2026-06-21T12:00:00Z`);
  await expect(globe(page)).toBeAttached({ timeout: 60_000 });
  await expect(page.locator("#main chikyu-earth")).toHaveCount(0);
  await expect(main(page)).toHaveAttribute("data-state", "still");
  await expect(globe(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(4000);
  const shown = await sides(page);
  console.log(`realistic Earth by chikyu-earth: ${(shown.dark * 100).toFixed(0)} per cent dark, ${(shown.bright * 100).toFixed(0)} per cent bright`);
  expect(shown.dark, "a night side").toBeGreaterThan(0.1);
  expect(shown.bright, "and a day side").toBeGreaterThan(0.05);
  const before = await readCounts(page);
  // the page's row of tiles is this package's stills (one context, as ever); the big Earth is chikyu-earth's own (one more): this package makes none for a body another package draws
  expect(before.contexts, "two WebGL contexts at most: this package's tiles and chikyu-earth's Earth").toBeLessThanOrEqual(2);
  await page.waitForTimeout(2500);
  const after = await readCounts(page);
  expect(after.draws - before.draws, "nothing drawn at rest").toBe(0);
  expect(errors).toEqual([]);
});

test("a page that did not import chikyu-earth's realistic element draws its own Earth, and says once what to import; and the attribute taken away gives the own Earth back", async ({ page }) => {
  test.setTimeout(150_000);
  const info: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "info") info.push(message.text());
  });
  await page.goto(`${URL}?body=earth&look=realistic`);
  await expect(main(page)).toHaveAttribute("data-state", /^(still|live)$/, { timeout: 90_000 });
  await main(page).evaluate((el) => el.setAttribute("earth-from", "chikyu"));
  await expect.poll(() => info.filter((text) => text.includes('earth-from="chikyu"')).length, { timeout: 15_000, message: "the console is told what to import" }).toBe(1);
  expect(info.find((text) => text.includes('earth-from="chikyu"'))).toContain("@johnmorrisdotca/chikyu-earth/realistic/element");
  await expect(globe(page)).toHaveCount(0);
  await expect(main(page).locator("canvas, img").first()).toBeAttached();
  await main(page).evaluate((el) => el.removeAttribute("earth-from"));
  await page.waitForTimeout(1500);
  expect(info.filter((text) => text.includes('earth-from="chikyu"')).length, "once for the page").toBe(1);
});

test("the realistic Earth by chikyu-earth is put away when the look goes back to the line, and when the attribute goes", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto(`${URL}?body=earth&look=realistic&earth-from=chikyu`);
  await expect(globe(page)).toBeAttached({ timeout: 60_000 });
  await main(page).evaluate((el) => el.setAttribute("look", "line"));
  await expect(globe(page)).toHaveCount(0);
  await expect(page.locator("#main chikyu-earth")).toBeAttached();
  await main(page).evaluate((el) => el.setAttribute("look", "painted"));
  await expect(page.locator("#main chikyu-earth")).toHaveCount(0);
  await expect(globe(page)).toBeAttached();
  await main(page).evaluate((el) => el.removeAttribute("earth-from"));
  await expect(globe(page)).toHaveCount(0);
  await expect(main(page)).toHaveAttribute("data-state", /^(still|live)$/, { timeout: 90_000 });
});
