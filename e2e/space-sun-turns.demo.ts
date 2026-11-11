// The Sun is a globe like the others in the turning view (MODULES-922): its surface turns with the view and with its own spin, while its glow still faces the camera. A picture test: the Sun's pixels change when
// the view turns (yaw, tilt and roll) and when days pass, in both looks and both scales, are the same when nothing has turned, and change too when the Sun is seen from another body. Chromium, drawing in
// software. Every wait is on what the page reports: the draws the renderer counts.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, setOn, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface View {
  yaw: number;
  tilt: number;
  zoom: number;
  roll: number;
}
const shot = async (page: Page): Promise<string> => (await page.locator(SPACE).screenshot()).toString("base64");
/** The view as the shared controls hold it now: what `goTo` left, to come back to exactly. */
const viewNow = (page: Page): Promise<View> =>
  page.locator(SPACE).evaluate((el) => {
    const state = (Reflect.get(el, "controller") as { state: View }).state;
    return { yaw: state.yaw, tilt: state.tilt, zoom: state.zoom, roll: state.roll ?? 0 };
  });
const sunPlace = (page: Page) => page.locator(SPACE).evaluate((el) => (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf("sun"));

/** Do something, then wait until the view has drawn it and the draws hold (two reads apart with no new draw). */
async function drawn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = (await readCounts(page)).draws;
  await act();
  await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(before);
  let held = -1;
  await expect
    .poll(
      async () => {
        const now = (await readCounts(page)).draws;
        const same = now === held;
        held = now;
        return same;
      },
      { timeout: 30_000, intervals: [400] },
    )
    .toBe(true);
}
const setView = (page: Page, view: View): Promise<void> => drawn(page, () => callOn(page, "setView", view));

/** How many pixels inside the Sun's disc differ between two pictures of the view. */
async function changed(page: Page, a: string, b: string): Promise<number> {
  const place = await sunPlace(page);
  expect(place, "the Sun is drawn").not.toBeNull();
  return page.evaluate(
    async ({ pa, pb, p }) => {
      const read = async (data: string): Promise<{ px: Uint8ClampedArray; width: number; height: number }> => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return { px: context.getImageData(0, 0, bitmap.width, bitmap.height).data, width: bitmap.width, height: bitmap.height };
      };
      const [x, y] = [await read(pa), await read(pb)];
      const ratio = x.width / (document.querySelector("wakusei-space")?.clientWidth ?? x.width);
      const [cx, cy, r] = [p.x * ratio, p.y * ratio, p.r * ratio];
      let n = 0;
      for (let j = Math.max(0, Math.floor(cy - r)); j < Math.min(x.height, cy + r); j += 1) {
        for (let i = Math.max(0, Math.floor(cx - r)); i < Math.min(x.width, cx + r); i += 1) {
          if (Math.hypot(i - cx, j - cy) > r * 0.8) continue;
          const k = (j * x.width + i) * 4;
          if (Math.abs(x.px[k]! - y.px[k]!) + Math.abs(x.px[k + 1]! - y.px[k + 1]!) + Math.abs(x.px[k + 2]! - y.px[k + 2]!) > 60) n += 1;
        }
      }
      return n;
    },
    { pa: a, pb: b, p: place! },
  );
}

for (const [look, scale] of [["realistic", "true"], ["painted", "compressed"]] as const) {
  test(`${look}, ${scale} scale: the Sun's face changes when the view turns (yaw, tilt, roll) and when days pass, and not when nothing turns`, async ({ page }) => {
    test.setTimeout(240_000);
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}&look=${look}&play=off`);
    await drawn(page, () => callOn(page, "goTo", "sun", { smooth: false }));
    // the view goTo left, read and restored exactly, whatever it is
    const home = await viewNow(page);
    const first = await shot(page);
    const again = await shot(page);
    expect(await changed(page, first, again), "nothing turned: the same picture").toBeLessThan(60);
    // the view turns about the Sun: another side of it comes round
    await setView(page, { ...home, yaw: home.yaw + 90 });
    expect(await changed(page, first, await shot(page)), "the view turned a quarter: the Sun shows another face").toBeGreaterThan(300);
    await setView(page, home);
    expect(await changed(page, first, await shot(page)), "turned back, it is the same face again").toBeLessThan(150);
    // tipped: its pole comes towards the camera, and the markings move with it
    await setView(page, { ...home, tilt: home.tilt + 45 });
    expect(await changed(page, first, await shot(page)), "the view tipped 45 degrees: the face moved").toBeGreaterThan(300);
    await setView(page, home);
    // rolled: the picture turns about the line of sight, so the markings turn in place while the glow (round) does not
    await setView(page, { ...home, roll: home.roll + 90 });
    expect(await changed(page, first, await shot(page)), "the view rolled a quarter: the face turned in place").toBeGreaterThan(300);
    await setView(page, home);
    expect(await changed(page, first, await shot(page)), "back again, the same face").toBeLessThan(150);
    // its own spin: a few days later (the Sun turns 14 degrees a day) the markings have moved
    await drawn(page, () => setOn(page, "time", Date.UTC(2026, 10, 7, 14)));
    expect(await changed(page, first, await shot(page)), "five days on, the Sun has turned about 70 degrees").toBeGreaterThan(300);
  });
}

test("seen from another body (Mercury, the distances squeezed): the Sun's face still changes when the view turns, by a share of its smaller disc", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed&look=painted&play=off");
  await drawn(page, () => callOn(page, "goTo", "mercury", { smooth: false }));
  // out from Mercury until the Sun is in the view, as a disc a few pixels across
  const inner = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("inner"));
  const home = { ...(await viewNow(page)), zoom: inner * 3 };
  await setView(page, home);
  const place = await sunPlace(page);
  expect(place, "the Sun is in the view").not.toBeNull();
  expect(place!.r, "the Sun's disc is a few pixels across").toBeGreaterThan(4);
  const disc = Math.PI * (0.8 * place!.r) ** 2;
  const first = await shot(page);
  await setView(page, { ...home, yaw: home.yaw + 90 });
  const turned = await changed(page, first, await shot(page));
  expect(turned, `the view turned a quarter: ${turned} of the Sun's ${Math.round(disc)} pixels changed`).toBeGreaterThan(disc * 0.1);
  await setView(page, home);
  expect(await changed(page, first, await shot(page)), "turned back, the same face").toBeLessThan(disc * 0.05 + 20);
});
