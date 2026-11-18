// The Moon's ring round the Earth stays when the view is close to the Earth with the orbits on (MODULES-1569): in the squeezed scale it lies 4 to 5 Earth radii out, and the fade of a body's own line near it (3 to 12 radii) took the whole ring away. The ring is a line
// that passes through nothing close, so it is not faded; the Earth's own line, which passes through the Earth, still is. The picture with the lines on and off differs only where the ring is, and is written to test-results/evidence/ for a person to look at.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, quiet, SPACE, setOn, statsOf } from "./space-ui.ts";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Place = { x: number; y: number; r: number };
const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
const orbitsOf = async (page: Page): Promise<{ drawn: string[]; hidden: string[]; faded: string[] }> => ((await statsOf(page)) as unknown as { orbits: { drawn: string[]; hidden: string[]; faded: string[] } }).orbits;

test("close to the Earth, in the squeezed scale, the Moon's ring is drawn whole and the Earth's own line is the one that is faded", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1076, height: 560 });
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  await setOn(page, "orbits", true);
  // the Earth's disc between 32 and 70 pixels across its radius: a close view (30) with the Moon's ring, 4 to 5 radii out, inside the picture
  let radius = 0;
  for (const zoom of [1, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05]) {
    await callOn(page, "goTo", "earth", { smooth: false, zoom });
    await quiet(page);
    radius = (await placeOf(page, "earth"))?.r ?? 0;
    if (radius >= 32 && radius <= 70) break;
  }
  expect(radius, "the Earth's disc is a close view's size").toBeGreaterThanOrEqual(32);
  expect(radius).toBeLessThanOrEqual(70);
  const moon = (await placeOf(page, "moon"))!;
  expect(moon, "the Moon is in the picture").not.toBeNull();
  const box = (await page.locator(SPACE).boundingBox())!;
  expect(moon.x).toBeGreaterThan(0);
  expect(moon.x).toBeLessThan(box.width);
  const orbits = await orbitsOf(page);
  expect(orbits.drawn, "the Moon's ring is built").toContain("moon");
  expect(orbits.hidden, "the lines that are not the Earth's system's are hidden").not.toContain("moon");
  expect(orbits.faded, "the Earth's own line is faded near it").toContain("earth");
  expect(orbits.faded, "the Moon's ring is not: it never meets the Earth").not.toContain("moon");
  // the picture with the lines on is not the picture with them off: the ring is there to see
  await page.locator(SPACE).scrollIntoViewIfNeeded();
  const withLines = await page.locator(SPACE).screenshot();
  await setOn(page, "orbits", false);
  await quiet(page);
  const without = await page.locator(SPACE).screenshot();
  await setOn(page, "orbits", true);
  await quiet(page);
  mkdirSync("test-results/evidence", { recursive: true });
  writeFileSync("test-results/evidence/moon-ring-earth-orbits-on.png", withLines);
  writeFileSync("test-results/evidence/moon-ring-earth-orbits-off.png", without);
  await testInfo.attach("moon-ring-earth-orbits-on.png", { body: withLines, contentType: "image/png" });
  expect(withLines.equals(without), "the Moon's ring is drawn: the picture with the lines on differs from the one with them off").toBe(false);
  // and close to the Moon the ring passes through the Moon, so it is the one that is faded
  await callOn(page, "goTo", "moon", { smooth: false, zoom: 0.5 });
  await quiet(page);
  await expect.poll(async () => (await placeOf(page, "moon"))?.r ?? 0, { timeout: 30_000 }).toBeGreaterThan(30);
  expect((await orbitsOf(page)).faded).toContain("moon");
});
