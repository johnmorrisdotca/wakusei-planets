// The spacecraft page at rest and at play (MODULES-1210): nothing is scheduled while it is paused or its tab is hidden, a frame is asked for each page frame while it plays, and on a phone nothing runs past the screen.
// The page's clock is the test's: installed before the page, held once it has loaded and stepped by the test, so two seconds are two seconds of the page's time and not of this machine's.
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(!["chromium-desk", "chromium-phone", "webkit-desk", "webkit-phone"].includes(testInfo.project.name), "the four browsers");
});

declare global {
  interface Window {
    __craft: { frames: number; mutations: number };
  }
}

/** Open the page with its clock the test's, counting the frames the page asks for and the changes made to it, then hold the clock. */
async function openHeld(page: Page): Promise<void> {
  await page.clock.install();
  await page.addInitScript(() => {
    const seen = { frames: 0, mutations: 0 };
    window.__craft = seen;
    const ask = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => {
      seen.frames += 1;
      return ask(callback);
    };
    document.addEventListener("DOMContentLoaded", () => new MutationObserver((list) => (seen.mutations += list.length)).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }));
  });
  await page.goto("/wakusei-planets/craft.html?lang=en");
  await expect(page.locator("#where")).toContainText("au", { timeout: 30_000 });
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}
/** Let `ms` of the page's time pass, a frame at a time. */
const advance = async (page: Page, ms: number): Promise<void> => {
  for (let spent = 0; spent < ms; spent += 16) await page.clock.runFor(16);
};
const seen = (page: Page) => page.evaluate(() => ({ ...window.__craft }));
const reset = (page: Page) => page.evaluate(() => void Object.assign(window.__craft, { frames: 0, mutations: 0 }));

test("playing, a frame is asked for each page frame and the page changes with each; paused, nothing is asked for or changed in two seconds", async ({ page }) => {
  await openHeld(page);
  // it plays on load
  await expect(page.locator("#play")).toHaveAttribute("aria-pressed", "true");
  await reset(page);
  await advance(page, 1000);
  const playing = await seen(page);
  // the page's own loop asks for one a page frame (62 here), and the shared frame code of the family's controls may ask for some of its own: never twice a frame
  expect(playing.frames, "a frame asked for each of the 62 page frames").toBeGreaterThan(50);
  expect(playing.frames).toBeLessThan(2 * 62 + 4);
  expect(playing.mutations, "and the page changed with them").toBeGreaterThan(50);
  // pause: the frame in flight ends, and then nothing
  await page.locator("#play").click();
  await expect(page.locator("#play")).toHaveAttribute("aria-pressed", "false");
  await advance(page, 100);
  await reset(page);
  await advance(page, 2000);
  expect(await seen(page), "nothing asked for and nothing changed while paused").toEqual({ frames: 0, mutations: 0 });
  // play again: it starts again from the button
  await page.locator("#play").click();
  await advance(page, 500);
  expect((await seen(page)).frames, "playing again asks for frames again").toBeGreaterThan(20);
});

test("a hidden tab asks for no frames, and the page plays again when it is seen", async ({ page }) => {
  await openHeld(page);
  const hide = (hidden: boolean) =>
    page.evaluate((value) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => value });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await hide(true);
  await advance(page, 100);
  await reset(page);
  await advance(page, 2000);
  expect(await seen(page), "nothing asked for or changed while the tab is hidden").toEqual({ frames: 0, mutations: 0 });
  await hide(false);
  await advance(page, 500);
  expect((await seen(page)).frames, "seen again, it plays").toBeGreaterThan(20);
});

test("on a phone the page does not run past the screen: no sideways scroll, the picker, the chart and the events inside it, the buttons at least 40 px tall", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.endsWith("phone"), "phones only");
  await openHeld(page);
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
  expect(sizes.scroll, "no horizontal scroll").toBeLessThanOrEqual(sizes.inner);
  for (const selector of ["#crafts", "#chart", "#events"]) {
    const box = await page.locator(selector).boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box!.x, `${selector} starts inside the screen`).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width, `${selector} ends inside the screen`).toBeLessThanOrEqual(sizes.inner + 0.5);
  }
  const small: string[] = [];
  for (const button of await page.locator("main button, #crafts button, #play").all()) {
    const box = await button.boundingBox();
    if (box !== null && box.height < 40) small.push(`${(await button.textContent())?.trim()} ${Math.round(box.height)}`);
  }
  expect(small, "every button at least 40 px tall").toEqual([]);
});
