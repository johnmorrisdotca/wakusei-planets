// The Sun is a globe like the others in the turning view: its surface turns with the view and with its own spin, while its glow still faces the camera. A picture test: the Sun's pixels change when
// the view turns (yaw, tilt and roll) and when days pass, in both looks and both scales, are the same when nothing has turned, and change too when the Sun is seen from another body. Chromium, drawing in
// software. Every wait is on what the page reports: the draws the renderer counts.
import { expect, test, type Page } from "@playwright/test";
import { callOn, changedBetween, changedInside, drawn, openSpace, pictureOf, setOn, shot, SPACE } from "./space-ui.ts";

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
/** The view as the shared controls hold it now: what `goTo` left, to come back to exactly. */
const viewNow = (page: Page): Promise<View> =>
  page.locator(SPACE).evaluate((el) => {
    const state = (Reflect.get(el, "controller") as { state: View }).state;
    return { yaw: state.yaw, tilt: state.tilt, zoom: state.zoom, roll: state.roll ?? 0 };
  });
const setView = (page: Page, view: View): Promise<void> => drawn(page, () => callOn(page, "setView", view));
const sunPicture = (page: Page) => pictureOf(page, "sun");
/** How many pixels inside the Sun's disc differ between two pictures of the view (its place now). */
const changed = (page: Page, a: string, b: string): Promise<number> => changedInside(page, "sun", a, b, 60, 0.8);

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

test("seen from another body (Mercury, the distances squeezed): the Sun's face still turns in place when the view rolls and when days pass", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&scale=compressed&look=painted&play=off");
  await drawn(page, () => callOn(page, "goTo", "mercury", { smooth: false }));
  // out from Mercury to the zoom that frames the inner planets: the Sun is in the view as a small disc
  const inner = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("inner"));
  const home = { ...(await viewNow(page)), zoom: inner };
  await setView(page, home);
  const first = await sunPicture(page);
  const box = await page.locator(SPACE).boundingBox();
  expect(first.x > first.r && first.y > first.r && first.x < box!.width - first.r && first.y < box!.height - first.r, `the Sun is inside the view (at ${first.x.toFixed(0)}, ${first.y.toFixed(0)}, radius ${first.r.toFixed(0)} in ${box!.width}x${box!.height})`).toBe(true);
  expect(first.r, "the Sun's disc is a few pixels across").toBeGreaterThan(4);
  const disc = Math.PI * (0.8 * first.r) ** 2;
  // the view rolls a quarter about the line of sight: the Sun stays where it is on the screen and its face turns in place, while its glow, round, does not
  await setView(page, { ...home, roll: home.roll + 90 });
  const rolled = await changedBetween(page, first, await sunPicture(page));
  expect(rolled, `the view rolled a quarter: ${rolled} of the Sun's ${Math.round(disc)} pixels changed`).toBeGreaterThan(disc * 0.1);
  await setView(page, home);
  expect(await changedBetween(page, first, await sunPicture(page)), "rolled back, the same face").toBeLessThan(disc * 0.05 + 20);
  // five days on: Mercury has moved along its orbit, so the Sun sits elsewhere on the screen, and its own face has turned about 70 degrees
  await drawn(page, () => setOn(page, "time", Date.UTC(2026, 10, 7, 14)));
  const later = await changedBetween(page, first, await sunPicture(page));
  expect(later, `five days on: ${later} of the Sun's ${Math.round(disc)} pixels changed`).toBeGreaterThan(disc * 0.1);
});
