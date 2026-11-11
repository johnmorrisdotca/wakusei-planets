// The data door in the space view, in a real browser (Chromium, drawn in software): a source of small bodies is drawn as points in one instanced draw, its credit is on the page in English and Japanese with its licence,
// the points change the picture and switching the source off brings the first picture back and frees the records, and `data=own` ignores it.
import { COUNT_SCRIPT } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, type Page, test } from "@playwright/test";
import { addRocks } from "./door-fixture.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.addInitScript(COUNT_SCRIPT);
});

const SPACE = "wakusei-space";
const PAGE = "/wakusei-planets/space.html";
type Credit = { id: string; own: boolean; used: number };
const sky = (page: Page) => page.locator(SPACE);
const creditsOf = (page: Page): Promise<Credit[]> => sky(page).evaluate((el) => (el as unknown as { credits(): { source: { id: string }; own: boolean; used: number }[] }).credits().map((c) => ({ id: c.source.id, own: c.own, used: c.used })));
const doorOf = (page: Page) => sky(page).evaluate((el) => (Reflect.get(el, "stats") as { door: { points: number; sources: { records: Record<string, { status: string; kept: number; skipped: number }> } } }).door);
const line = (page: Page) => page.getByTestId("door-credit");

async function open(page: Page, query = ""): Promise<void> {
  // the package's own belts are off here (belts=0): these tests are of a page's own sources, which a view with none draws as it always did
  await page.goto(`${PAGE}?t=2026-11-02T14:00Z&scale=compressed&play=off&belts=0${query}`);
  await expect(sky(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await expect.poll(async () => (await creditsOf(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
}

/** The picture of the view as a list of pixel values, to count what changed. */
async function pixels(page: Page): Promise<number[]> {
  const png = (await sky(page).screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const out: number[] = [];
    for (let i = 0; i < px.length; i += 4) out.push(px[i]! + px[i + 1]! + px[i + 2]!);
    return out;
  }, png);
}
const differ = (a: number[], b: number[]): number => a.reduce((n, v, i) => n + (Math.abs(v - (b[i] ?? 0)) > 60 ? 1 : 0), 0);

test("a source of small bodies is drawn as points in one instanced draw, credited with its licence in English, and off brings the first picture back", async ({ page }) => {
  await open(page);
  expect((await doorOf(page)).points).toBe(0);
  expect((await creditsOf(page)).map((c) => c.id)).toEqual(["wakusei-pictures", "wakusei-orbits"]);
  await expect(line(page)).toContainText("Surface pictures");
  const before = await pixels(page);
  await addRocks(page, SPACE, 1500);
  await expect.poll(async () => (await doorOf(page)).points, { timeout: 30_000 }).toBe(1500);
  const drawn = await pixels(page);
  expect(differ(before, drawn), "the points change the picture").toBeGreaterThan(30);
  const credits = await creditsOf(page);
  expect(credits.map((c) => [c.id, c.own])).toEqual([["wakusei-pictures", true], ["wakusei-orbits", true], ["rocks", false]]);
  expect(credits[2]!.used).toBe(1500);
  await expect(line(page)).toContainText("Rocks: mine, A. Person (2026) (CC BY-NC 4.0; non-commercial).");
  expect(await page.evaluate(() => (Reflect.get(window, "__rocks") as { count: number }).count), "read once").toBe(1);
  expect((await doorOf(page)).sources.records["rocks"]).toEqual({ status: "ok", kept: 1500, skipped: 0 });
  await sky(page).evaluate((el) => (el as unknown as { enableSource(id: string, on: boolean): void }).enableSource("rocks", false));
  await expect.poll(async () => (await doorOf(page)).points, { timeout: 30_000 }).toBe(0);
  await expect.poll(async () => (await creditsOf(page)).some((c) => c.id === "rocks")).toBe(false);
  await expect(line(page)).not.toContainText("Rocks: mine");
  expect((await doorOf(page)).sources.records).toEqual({});
  await page.waitForTimeout(800);
  expect(differ(before, await pixels(page)), "the first picture again").toBeLessThan(40);
});

test("at rest the points are not drawn again, and a source of 20,000 bodies is read once", async ({ page }) => {
  await open(page);
  await addRocks(page, SPACE, 20_000);
  await expect.poll(async () => (await doorOf(page)).points, { timeout: 60_000 }).toBe(20_000);
  await page.waitForTimeout(2000);
  const before = await sky(page).evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);
  await page.waitForTimeout(2500);
  const after = await sky(page).evaluate((el) => (Reflect.get(el, "stats") as { draws: number }).draws);
  expect(after - before).toBe(0);
  expect(await page.evaluate(() => (Reflect.get(window, "__rocks") as { count: number }).count)).toBe(1);
});

test("the credit line is in Japanese in Japanese, with the licence and 非営利のみ beside the credit", async ({ page }) => {
  await open(page, "&lang=ja");
  await addRocks(page, SPACE, 300);
  await expect.poll(async () => (await doorOf(page)).points, { timeout: 30_000 }).toBe(300);
  await expect(line(page)).toContainText("小天体：私の（A. Person、2026年）（CC BY-NC 4.0、非営利のみ）");
  await expect(line(page)).toContainText("表面の地図");
});

test("data=own in the address ignores a source of small bodies: nothing is read, nothing drawn, nothing credited", async ({ page }) => {
  await open(page, "&data=own");
  await expect(sky(page)).toHaveAttribute("data", "own");
  await addRocks(page, SPACE, 300);
  await page.waitForTimeout(1500);
  expect((await doorOf(page)).points).toBe(0);
  expect(await page.evaluate(() => (Reflect.get(window, "__rocks") as { count: number }).count)).toBe(0);
  expect((await creditsOf(page)).some((c) => c.id === "rocks")).toBe(false);
});
