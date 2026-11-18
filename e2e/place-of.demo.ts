// `placeOf` says where a body is on the screen now, with the names off as well as on (MODULES-1401): the places were made only with the names on, so a page that switched them off was handed the last ones from before.
import "./load.ts";
import { expect, test } from "@playwright/test";

type Space = HTMLElement & { placeOf(id: string): { x: number; y: number; r: number } | null; labels: boolean; goTo(id: string, options?: { smooth?: boolean }): boolean };

test("with the names off, placeOf follows the view: the body it turns to is at the middle", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z&speed=0");
  const view = page.locator("wakusei-space[data-state=live]");
  await view.waitFor({ timeout: 90_000 });
  await view.scrollIntoViewIfNeeded();
  await expect.poll(() => view.evaluate((el) => (el as Space).placeOf("earth")?.r ?? 0)).toBeGreaterThan(20);
  await view.evaluate((el) => {
    (el as Space).setAttribute("labels", "off");
    // `center` is a place on the Earth (longitude and latitude), not a body: the view turns to a body with goTo
    (el as Space).goTo("mars", { smooth: false });
  });
  const middle = (id: string) =>
    view.evaluate((el, who) => {
      const place = (el as Space).placeOf(who);
      return place === null ? null : { off: Math.abs(place.x - el.clientWidth / 2) + Math.abs(place.y - el.clientHeight / 2), r: place.r };
    }, id);
  await expect.poll(async () => (await middle("mars"))?.off ?? 999, { timeout: 30_000 }).toBeLessThan(3);
  expect((await middle("mars"))!.r, "Mars is the body in the frame").toBeGreaterThan(20);
  // and the Earth it left is where the view now puts it (a dot, or off the screen), not where it was
  const earth = await middle("earth");
  expect(earth === null || earth.off > 20, "the Earth is no longer at the middle").toBe(true);
});
