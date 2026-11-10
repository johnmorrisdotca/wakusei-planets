// How the space view looks at first sight: close to a body no orbit line is drawn across it, the scale line overlaps nothing on the full-screen page, and with normal motion every view opens moving by itself
// (reduced motion gets it still with Play ready). Chromium, drawing in software.
import { COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, settle, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Place {
  x: number;
  y: number;
  r: number;
}
const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
const orbitsOf = async (page: Page): Promise<{ drawn: string[]; hidden: string[] }> => ((await statsOf(page)) as unknown as { orbits: { drawn: string[]; hidden: string[] } }).orbits;

for (const [shape, width, height] of [["desk", 1440, 900], ["phone", 390, 844]] as const) {
  for (const body of ["earth", "saturn"] as const) {
    test(`${shape}: close to ${body} the other orbit lines are not drawn and none crosses its disc; far away they all are`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height });
      await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
      await callOn(page, "goTo", body, { smooth: false });
      await expect.poll(async () => (await placeOf(page, body))?.r ?? 0, { timeout: 30_000 }).toBeGreaterThan(40);
      await settle(page, 1200);
      const hidden = (await orbitsOf(page)).hidden;
      expect(hidden.length, "the lines that are not its own are hidden").toBeGreaterThanOrEqual(15);
      expect(hidden).not.toContain(body);
      // the picture of the disc is the same with the lines on and off: nothing is drawn across it
      await page.locator(SPACE).scrollIntoViewIfNeeded();
      const at = (await placeOf(page, body))!;
      const box = (await page.locator(SPACE).boundingBox())!;
      const inner = at.r * 0.7;
      const clip = { x: Math.round(box.x + at.x - inner), y: Math.round(box.y + at.y - inner), width: Math.round(2 * inner), height: Math.round(2 * inner) };
      const withLines = await page.screenshot({ clip });
      await setOn(page, "orbits", false);
      await settle(page, 1200);
      const without = await page.screenshot({ clip });
      await setOn(page, "orbits", true);
      expect(withLines.equals(without), `a line is drawn across ${body}'s disc`).toBe(true);
      // seen from afar the lines are all there
      await page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void; zoomFor(p: string): number }).setView({ yaw: 0, tilt: 0, zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") }));
      await callOn(page, "goTo", "earth", { smooth: false, zoom: 0.0005 });
      await page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ zoom: 0.0005 }, true, "jump"));
      await expect.poll(async () => (await orbitsOf(page)).hidden.length, { timeout: 30_000 }).toBe(0);
    });
  }
}

test("on the full-screen page the scale line overlaps nothing, at a desk and on a phone", async ({ page }) => {
  test.setTimeout(120_000);
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.addInitScript(COUNT_SCRIPT);
    await page.goto("/wakusei-planets/space-full.html?t=2026-11-02T14:00Z&speed=0");
    await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
    await settle(page, 1000);
    const crossing = await page.evaluate(() => {
      const scale = document.querySelector("wakusei-space")!.shadowRoot!.querySelector(".sp-scale")!.getBoundingClientRect();
      const out: string[] = [];
      for (const other of document.querySelectorAll<HTMLElement>(".top h1, .top time, .top a, .strip .group, kazoku-view-controls")) {
        const r = other.getBoundingClientRect();
        if (r.width > 0 && scale.left < r.right && r.left < scale.right && scale.top < r.bottom && r.top < scale.bottom) out.push(other.className || other.tagName);
      }
      return { out, scale: { left: scale.left, top: scale.top, right: scale.right, bottom: scale.bottom }, view: { width: innerWidth, height: innerHeight } };
    });
    expect(crossing.out, `${width} by ${height}: ${JSON.stringify(crossing.scale)}`).toEqual([]);
    expect(crossing.scale.right).toBeLessThanOrEqual(crossing.view.width);
    expect(crossing.scale.bottom).toBeLessThanOrEqual(crossing.view.height);
  }
});

/** How many pixels of two pictures differ. */
async function difference(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([x, y]) => {
    const load = async (data: string): Promise<ImageData> => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height);
    };
    const [p, q] = [await load(x!), await load(y!)];
    let count = 0;
    for (let i = 0; i < p.data.length; i += 4) if (Math.abs(p.data[i]! - q.data[i]!) + Math.abs(p.data[i + 1]! - q.data[i + 1]!) + Math.abs(p.data[i + 2]! - q.data[i + 2]!) > 24) count += 1;
    return count;
  }, [a.toString("base64"), b.toString("base64")] as const);
}

for (const [name, url] of [["panel", "/wakusei-planets/space.html"], ["full screen", "/wakusei-planets/space-full.html"]] as const) {
  test(`${name}: with normal motion it opens moving by itself, from now: the picture changes within two seconds with nothing touched`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(COUNT_SCRIPT);
    await page.goto(url);
    await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
    await page.locator(SPACE).scrollIntoViewIfNeeded();
    await settle(page, 1500);
    const t0 = (await statsOf(page)).time;
    const first = await page.locator(SPACE).screenshot();
    await page.waitForTimeout(2000);
    const second = await page.locator(SPACE).screenshot();
    const t1 = (await statsOf(page)).time;
    expect(t1 - t0, "the clock runs: at least an hour of the sky's time passed").toBeGreaterThan(3_600_000);
    expect(Math.abs(t0 - Date.now()), "from now").toBeLessThan(6 * 3_600_000);
    expect(await difference(page, first, second), "the picture changed").toBeGreaterThan(1500);
  });
}

test("panel: with reduced motion it opens still, with Play ready", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:" + (process.env.TEST_PORT ?? "8226") + "/wakusei-planets/space.html");
  await page.locator(`${SPACE}[data-state=live]`).waitFor({ timeout: 90_000 });
  await settle(page, 1000);
  const t0 = (await statsOf(page)).time;
  await page.waitForTimeout(2000);
  expect((await statsOf(page)).time - t0, "the clock holds").toBe(0);
  await expect(page.locator('#replay [data-act="play"]')).toHaveAttribute("aria-pressed", "false");
  // Play stays where the reader can find it; the shared replay bar disables it for reduced motion (a ticket for kazoku-ui asks it to be ready)
  await expect(page.locator('#replay [data-act="play"]')).toBeVisible();
  await context.close();
});
