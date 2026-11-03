// The bodies the page shows, looked at in a real browser (Chromium, drawn in software): the Earth is a picture like the others in every look, in the big view and in the row; no tile is a flat square or a
// dot; "To scale" is a lineup whose sizes are true to each other; every moon has a tile and opens; the body cannot be dragged out of the view and Fit brings it back.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { BODIES, MOONS_OF } from "../src/index.ts";

const URL = "/wakusei-planets/";

/** What a picture holds: how many pixels differ from its corner (the background), how many distinct colours, and whether the corners are background. */
async function look(page: Page, locator: Locator): Promise<{ drawn: number; colours: number; cornersClear: boolean }> {
  const png = (await locator.screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const at = (x: number, y: number): number[] => [...px.slice((y * bitmap.width + x) * 4, (y * bitmap.width + x) * 4 + 3)];
    const bg = at(2, 2);
    const near = (c: number[]): boolean => Math.abs(c[0]! - bg[0]!) + Math.abs(c[1]! - bg[1]!) + Math.abs(c[2]! - bg[2]!) < 24;
    let drawn = 0;
    const seen = new Set<number>();
    for (let i = 0; i < px.length; i += 4) {
      const c = [px[i]!, px[i + 1]!, px[i + 2]!];
      if (!near(c)) {
        drawn += 1;
        seen.add(((c[0]! >> 4) << 8) | ((c[1]! >> 4) << 4) | (c[2]! >> 4));
      }
    }
    const w = bitmap.width - 3;
    const h = bitmap.height - 3;
    return { drawn, colours: seen.size, cornersClear: [at(2, 2), at(w, 2), at(2, h), at(w, h)].every(near) };
  }, png);
}

const still = (page: Page, id: string): Locator => page.locator(`.tile[data-body="${id}"] wakusei-body`);

for (const lookName of ["line", "realistic", "painted"] as const) {
  test(`the Earth is drawn in the ${lookName} look in the big view and in the row, like the other bodies`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
    await page.goto(`${URL}?body=earth&look=${lookName}`);
    const big = page.locator("#main");
    if (lookName !== "line") {
      await big.hover();
      await expect(big).toHaveAttribute("data-state", "live", { timeout: 90_000 });
      await page.waitForTimeout(2500);
    } else await expect(page.locator("#main chikyu-earth")).toBeAttached();
    expect((await look(page, big)).drawn, "the big view is not blank").toBeGreaterThan(5000);
    await page.locator("#tiles").scrollIntoViewIfNeeded();
    const earthTile = still(page, "earth");
    const marsTile = still(page, "mars");
    if (lookName !== "line") {
      await expect(earthTile).toHaveAttribute("data-state", "still", { timeout: 120_000 });
      await expect(marsTile).toHaveAttribute("data-state", "still", { timeout: 120_000 });
    }
    // the Earth's tile is in the same look as Mars's
    await expect(earthTile).toHaveAttribute("look", lookName);
    await expect.poll(async () => (await look(page, earthTile)).drawn, { timeout: 30_000 }).toBeGreaterThan(400);
    if (lookName !== "line") expect((await look(page, earthTile)).colours, "the Earth tile is a picture, not a flat colour").toBeGreaterThan(6);
  });
}

test("with To scale on, no tile is a flat square or a dot", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto(`${URL}?look=line&scale=1&body=jupiter`);
  await page.locator("#tiles").scrollIntoViewIfNeeded();
  for (const id of ["sun", "mercury", "mars", "pluto", "moon", "saturn"]) {
    const tile = still(page, id);
    await expect.poll(async () => (await look(page, tile)).drawn, { message: id, timeout: 30_000 }).toBeGreaterThan(300);
    const s = await look(page, tile);
    expect(s.cornersClear, `${id} fills its tile to the corners: a square`).toBe(true);
  }
});

test("To scale is a lineup in true proportion, with the Sun as a curved edge and a magnified picture for each small body", async ({ page }) => {
  await page.goto(`${URL}?look=line&scale=1&body=earth`);
  const cells = page.locator("#lineup .cell");
  await expect(cells).toHaveCount(11);
  const diameter = async (id: string): Promise<number> => Number(await page.locator(`#lineup .cell[data-body="${id}"]`).getAttribute("data-diameter-px"));
  const ratio = (await diameter("jupiter")) / (await diameter("earth"));
  expect(ratio).toBeCloseTo(BODIES.jupiter.radiusKm / BODIES.earth.radiusKm, 2);
  expect((await diameter("saturn")) / (await diameter("mars"))).toBeCloseTo(BODIES.saturn.radiusKm / BODIES.mars.radiusKm, 2);
  await expect(page.locator('#lineup .cell[data-body="sun"] svg.limb')).toBeVisible();
  await expect(page.locator('#lineup .cell[data-body="sun"] wakusei-body')).toHaveCount(0);
  for (const id of ["mercury", "venus", "earth", "moon", "mars", "pluto"]) await expect(page.locator(`#lineup .cell[data-body="${id}"] .inset`), id).toBeAttached();
  for (const id of ["jupiter", "saturn", "uranus", "neptune"]) await expect(page.locator(`#lineup .cell[data-body="${id}"] .inset`), id).toHaveCount(0);
  // the pictures are drawn at that proportion: Jupiter's disc is as many times Mars's as their radii say
  const width = async (id: string): Promise<number> => {
    const box = await page.locator(`#lineup .cell[data-body="${id}"] wakusei-body.true svg`).first().boundingBox();
    return box?.width ?? 0;
  };
  expect(await width("jupiter")).toBeCloseTo(await width("mars"), 0);
});

test("every moon has a tile under its planet, and opens in the big view, deep-linked", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  for (const [planet, moons] of Object.entries(MOONS_OF)) {
    if (planet === "earth") continue;
    for (const moon of moons) {
      const tile = page.locator(`#moon-groups .tiles[data-planet="${planet}"] .tile[data-body="${moon}"]`);
      await expect(tile, moon).toBeAttached();
    }
  }
  await expect(page.locator("#moon-groups .tile")).toHaveCount(24);
  const io = page.locator('#moon-groups .tile[data-body="io"]');
  await io.scrollIntoViewIfNeeded();
  await io.click();
  await expect(page.locator("#main")).toHaveAttribute("body", "io");
  await expect(page).toHaveURL(/body=io/);
  await expect(page.locator("#caption")).toContainText("Io");
  await expect(page.locator('#chips [data-chip="jupiter"]')).toBeVisible();
  await expect(page.locator('#chips [data-chip="europa"]')).toBeVisible();
  await page.goto(`${URL}?look=line&body=triton`);
  await expect(page.locator("#main")).toHaveAttribute("body", "triton");
  await page.locator('#chips [data-chip="neptune"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "neptune");
});

test("the body cannot be dragged out of the view, and Fit brings it back to the middle", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  const view = page.locator("#view");
  const box = (await view.boundingBox())!;
  // zoom in so the view can be moved, then drag far off
  await page.evaluate(() => Reflect.get(document.querySelector("kazoku-view-controls")!, "controller").set({ zoom: 2, panX: 40, panY: -40 }, true, "set"));
  await page.waitForTimeout(300);
  const svg = page.locator("#main svg").first();
  const at = (await svg.boundingBox())!;
  expect(at.x + at.width, "some of the body is still in the view").toBeGreaterThan(box.x);
  expect(at.x, "some of the body is still in the view").toBeLessThan(box.x + box.width);
  const centred = (await page.evaluate(() => {
    const controller = Reflect.get(document.querySelector("kazoku-view-controls")!, "controller");
    controller.set({ yaw: 40, panX: 40 }, true, "set");
    return controller.state;
  })) as { panX: number };
  expect(centred.panX).toBe(40);
  await page.getByRole("button", { name: /^fit$/i }).first().click();
  await expect.poll(async () => (await page.evaluate(() => Reflect.get(document.querySelector("kazoku-view-controls")!, "controller").state)) as { panX: number; yaw: number }, { timeout: 5000 }).toMatchObject({ panX: 0, yaw: 0 });
});
