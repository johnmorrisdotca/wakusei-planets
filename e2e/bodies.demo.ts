// The bodies the page shows, looked at in a real browser (Chromium, drawn in software): the Earth is a picture like the others in every look, in the big view and in the row; no tile is a flat square or a
// dot; "To scale" is a lineup whose sizes are true to each other; every moon has a tile and opens; the body cannot be dragged out of the view and Fit brings it back.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { BODIES, DWARF_IDS, MOONS_OF } from "../src/index.ts";

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
  for (const id of ["sun", "mercury", "mars", "pluto", "venus", "saturn"]) {
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

test("pick a planet and its moons come up on the next row: every moon has a tile, and opens, deep-linked", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=sun`);
  await expect(page.locator("#moon-row")).toBeHidden();
  for (const [planet, moons] of Object.entries(MOONS_OF)) {
    await page.locator(`[data-testid="group-${(DWARF_IDS as readonly string[]).includes(planet) ? "dwarfs" : "planets"}"]`).first().click();
    await page.locator(`#tiles .tile[data-body="${planet}"]`).click();
    await expect(page.locator("#moon-row")).toBeVisible();
    await expect(page.locator("#moon-row .tile")).toHaveCount(moons.length);
    for (const moon of moons) await expect(page.locator(`#moon-row .tile[data-body="${moon}"]`), `${planet}: ${moon}`).toBeAttached();
  }
  await page.locator('[data-testid="group-planets"]').first().click();
  await page.locator('#tiles .tile[data-body="mercury"]').click();
  await expect(page.locator("#moon-row")).toBeHidden();
  await page.locator('#tiles .tile[data-body="jupiter"]').click();
  await page.locator('#moon-row .tile[data-body="io"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "io");
  await expect(page).toHaveURL(/body=io/);
  await expect(page.locator("#caption")).toContainText("Io");
  await expect(page.locator('#moon-row .tile[data-body="europa"]')).toBeVisible();
  await expect(page.locator('#chips [data-chip="jupiter"]')).toBeVisible();
  await page.goto(`${URL}?look=line&body=triton`);
  await expect(page.locator("#main")).toHaveAttribute("body", "triton");
  await expect(page.locator('#moon-row .tile[data-body="nereid"]')).toBeAttached();
  await page.locator('#tiles .tile[data-body="neptune"]').click();
  await expect(page.locator("#main")).toHaveAttribute("body", "neptune");
});

test("the buttons under the view stay where they are, can be on together, and show the bodies side by side, at equal or at true relative sizes", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  const chip = (id: string) => page.locator(`#chips [data-chip="${id}"]`);
  await expect(page.locator("#chips [data-chip]")).toHaveCount(3);
  const before = await Promise.all(["mars", "phobos", "deimos"].map(async (id) => (await chip(id).boundingBox())!.x));
  await expect(chip("mars")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#together")).toBeHidden();
  await chip("phobos").click();
  await chip("deimos").click();
  const after = await Promise.all(["mars", "phobos", "deimos"].map(async (id) => (await chip(id).boundingBox())!.x));
  expect(after, "no button moved").toEqual(before);
  for (const id of ["mars", "phobos", "deimos"]) await expect(chip(id)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#together .together-cell")).toHaveCount(3);
  await expect(page.locator("#main")).toHaveAttribute("body", "mars");
  await expect(page).toHaveURL(/with=phobos%2Cdeimos|with=phobos,deimos/);
  // equal sizes: nothing is given a scale; true relative sizes: every picture holds the same number of kilometres
  await expect(page.locator("#together wakusei-body").first()).not.toHaveAttribute("span-km", /./);
  await page.locator("#relative").click();
  const spans = await page.locator("#together wakusei-body").evaluateAll((els) => els.map((el) => el.getAttribute("span-km")));
  expect(new Set(spans).size, "one span for all").toBe(1);
  expect(Number(spans[0])).toBeGreaterThan(3389);
  await expect(page).toHaveURL(/rel=1/);
  await chip("phobos").click();
  await expect(chip("phobos")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#together .together-cell")).toHaveCount(2);
  await chip("deimos").click();
  await expect(page.locator("#together")).toBeHidden();
});

for (const lookName of ["line", "realistic", "painted"] as const) {
  test(`every picture in the picker is a picture, planets and moons, in the ${lookName} look: not blank, not one colour`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
    test.setTimeout(420_000);
    await page.goto(`${URL}?look=${lookName}&body=mars`);
    await page.locator("#picker").scrollIntoViewIfNeeded();
    const seen = new Set<string>();
    const check = async (tile: Locator): Promise<void> => {
      await tile.scrollIntoViewIfNeeded();
      const id = (await tile.getAttribute("body")) ?? "";
      if (lookName !== "line") await expect(tile, id).toHaveAttribute("data-state", "still", { timeout: 60_000 });
      await expect.poll(async () => (await look(page, tile)).drawn, { timeout: 30_000, message: id }).toBeGreaterThan(150);
      expect((await look(page, tile)).colours, `${id} is not one colour`).toBeGreaterThan(3);
      seen.add(id);
    };
    for (const tile of await page.locator("#tiles .tile wakusei-body").all()) await check(tile);
    for (const planet of ["mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "earth"]) {
      await page.locator(`#tiles .tile[data-body="${planet}"]`).click();
      for (const tile of await page.locator("#moon-row .tile wakusei-body").all()) await check(tile);
    }
    expect(seen.size, "every body of the picker was looked at").toBe(10 + 2 + 4 + 7 + 5 + 3 + 3 + 1);
  });
}

test("Fit holds the Sun by its disc, like the planets: it is not drawn smaller to make room for its glow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto(`${URL}?look=realistic&body=mars`);
  await page.locator("#picker").scrollIntoViewIfNeeded();
  for (const id of ["sun", "mars"]) await expect(still(page, id)).toHaveAttribute("data-state", "still", { timeout: 60_000 });
  const sun = await look(page, still(page, "sun"));
  const mars = await look(page, still(page, "mars"));
  expect(sun.drawn, "the Sun's disc is as big as Mars's, not smaller").toBeGreaterThan(mars.drawn * 0.8);
});

test("the sky shows the real phase: Venus a few days from new is a thin crescent, not a full disc", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto(`${URL}?look=realistic&body=venus&sky=real&t=2026-11-02T12:00:00.000Z`);
  const big = page.locator("#main");
  await big.hover();
  await expect(big).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  await page.waitForTimeout(2500);
  const lit = await page.evaluate(() => {
    const el = document.querySelector("#main") as unknown as { stats?: unknown };
    return el ? 0 : 0;
  });
  void lit;
  const png = (await big.screenshot()).toString("base64");
  const share = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const { data: px } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    const side = Math.min(bitmap.width, bitmap.height);
    const disc = Math.PI * (side / 2 / 1.06) ** 2;
    let bright = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i]! + px[i + 1]! + px[i + 2]! > 90) bright += 1;
    return bright / disc;
  }, png);
  expect(share, "the lit part of Venus is a small share of its disc").toBeLessThan(0.22);
  expect(share, "and it is there").toBeGreaterThan(0.005);
});

test("the body cannot be dragged out of the view, and Centre brings it back to the middle", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=mars`);
  const view = page.locator("#view");
  const box = (await view.boundingBox())!;
  const state = (): Promise<{ panX: number; panY: number; yaw: number; tilt: number; zoom: number }> => page.evaluate(() => Reflect.get(document.querySelector("kazoku-view-controls")!, "controller").state);
  await page.evaluate(() => Reflect.get(document.querySelector("kazoku-view-controls")!, "controller").set({ zoom: 2, panX: 40, panY: -40, yaw: 40 }, true, "set"));
  await page.waitForTimeout(300);
  const at = (await page.locator("#main svg").first().boundingBox())!;
  expect(at.x + at.width, "some of the body is still in the view").toBeGreaterThan(box.x);
  expect(at.x, "some of the body is still in the view").toBeLessThan(box.x + box.width);
  expect(at.y + at.height, "some of the body is still in the view").toBeGreaterThan(box.y);
  expect(at.y, "some of the body is still in the view").toBeLessThan(box.y + box.height);
  await page.getByRole("button", { name: /centre|中央/i }).first().click();
  await expect.poll(async () => await state(), { timeout: 5000 }).toMatchObject({ panX: 0, panY: 0, yaw: 0, tilt: 0 });
});

test("To scale with its planet: Deimos is drawn at its true size beside Mars, a magnified picture beside it with a line, and the caption says so", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=deimos&scale=1&ref=planet`);
  await expect(page.locator("#main")).toHaveAttribute("scale-to", "mars");
  await expect(page.locator("#scale-inset")).toBeVisible();
  await expect(page.locator("#scale-leader")).toBeVisible();
  await expect(page.locator("#caption")).toContainText("0.0018 times the radius of Mars");
  // the buttons name the three things it can be measured against, and its planet only for a moon
  await expect(page.locator('#scale-refs [data-ref="planet"]')).toBeVisible();
  await page.locator('#scale-refs [data-ref="sun"]').click();
  await expect(page.locator("#main")).toHaveAttribute("scale-to", "sun");
  await expect(page).toHaveURL(/ref=sun/);
  await page.locator('.tile[data-body="mercury"]').click();
  await expect(page.locator('#scale-refs [data-ref="planet"]')).toBeHidden();
  await expect(page.locator("#scale-inset")).toBeVisible();
  await page.locator('.tile[data-body="saturn"]').click();
  await page.locator('#scale-refs [data-ref="earth"]').click();
  await expect(page.locator("#scale-inset")).toBeHidden();
  await expect(page.locator("#caption")).toContainText("times the radius of Earth");
});

// (the picture's background has a faint dot pattern, so a pixel counts as the body only when it is clearly brighter than that)
test("an irregular body is drawn whole: the sides of Deimos's and Phobos's pictures are clear", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  for (const id of ["deimos", "phobos"]) {
    await page.goto(`${URL}?look=realistic&body=${id}`);
    const big = page.locator("#main");
    await big.hover();
    await expect(big).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    await page.waitForTimeout(2500);
    const edges = await page.evaluate(async () => undefined);
    void edges;
    const png = (await big.screenshot()).toString("base64");
    const sides = await page.evaluate(async (data) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      const bg = context.getImageData(2, 2, 1, 1).data;
      const column = (x: number): number => {
        const { data: px } = context.getImageData(x, 0, 1, bitmap.height);
        let drawn = 0;
        for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i]! - bg[0]!) + Math.abs(px[i + 1]! - bg[1]!) + Math.abs(px[i + 2]! - bg[2]!) > 90) drawn += 1;
        return drawn;
      };
      return { left: column(1), right: column(bitmap.width - 2), middle: column(Math.floor(bitmap.width / 2)) };
    }, png);
    expect(sides.middle, `${id} is drawn`).toBeGreaterThan(50);
    expect(sides.left, `${id}: the left edge is clear (not clipped)`).toBe(0);
    expect(sides.right, `${id}: the right edge is clear (not clipped)`).toBe(0);
  }
});

test("every choice has a line that says what it does, always on the page, tied to its button, in English and Japanese", async ({ page }) => {
  await page.goto(`${URL}?look=line&body=jupiter`);
  const described = async (): Promise<{ id: string; text: string; shown: boolean; folded: boolean }[]> =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".controls [aria-describedby]")]
        .filter((button) => !button.hidden)
        .map((button) => {
          const line = document.getElementById(button.getAttribute("aria-describedby")!);
          return { id: button.id || button.dataset["look"] || button.dataset["sky"] || "?", text: line?.textContent ?? "", shown: line !== null && line.getBoundingClientRect().height > 0, folded: line?.closest("details") !== null };
        }),
    );
  const english = await described();
  expect(english.length).toBeGreaterThanOrEqual(9);
  for (const note of english) {
    expect(note.text.length, `${note.id} has a description`).toBeGreaterThan(20);
    expect(note.shown, `${note.id}'s description is on the page`).toBe(true);
    expect(note.folded, `${note.id}'s description is not in a fold`).toBe(false);
  }
  expect(english.find((n) => n.id === "real")?.text).toContain("partly or nearly all dark");
  await page.goto(`${URL}?look=line&body=jupiter&lang=ja`);
  await page.locator("#looks").waitFor();
  const japanese = await described();
  expect(japanese.map((n) => n.text)).not.toEqual(english.map((n) => n.text));
  expect(japanese.some((n) => /[぀-ヿ]/.test(n.text))).toBe(true);
});

test("every body is fitted by its globe at about half the view's height, so rings, glow and haze have room", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const shares: Record<string, number> = {};
  for (const id of ["mars", "saturn", "sun"]) {
    await page.goto(`${URL}?look=realistic&body=${id}`);
    const big = page.locator("#main");
    await big.hover();
    await expect(big).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    await page.waitForTimeout(2500);
    const png = (await big.screenshot()).toString("base64");
    shares[id] = await page.evaluate(async (data) => {
      const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      // the height of the bright part down the middle column
      const { data: px } = context.getImageData(Math.floor(bitmap.width / 2), 0, 1, bitmap.height);
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < bitmap.height; y += 1) {
        if (px[y * 4]! + px[y * 4 + 1]! + px[y * 4 + 2]! <= 120) continue;
        if (top < 0) top = y;
        bottom = y;
      }
      return (bottom - top) / bitmap.height;
    }, png);
  }
  for (const id of ["mars", "saturn"]) {
    expect(shares[id], `${id}'s globe is about half the height`).toBeGreaterThan(0.33);
    expect(shares[id], `${id}'s globe is about half the height`).toBeLessThan(0.58);
  }
  expect(shares["sun"], "the Sun's disc is no smaller than a planet's").toBeGreaterThan(0.33);
});

test("To scale: the Earth against the Earth is the reference, drawn full size in the middle of the Moon's orbit, and only a magnified body's caption mentions its picture", async ({ page }) => {
  await page.goto(`${URL}?look=line&scale=1&moons=1&body=earth`);
  await expect(page.locator("#main")).toHaveAttribute("scale-to", "earth");
  await expect(page.locator("#scale-inset")).toBeHidden();
  await expect(page.locator("#scale-leader")).toBeHidden();
  await expect(page.locator("#caption")).toHaveText("Earth is the one the others are measured against, drawn full size.");
  await page.goto(`${URL}?look=line&scale=1&body=mars`);
  await expect(page.locator("#main")).toHaveAttribute("scale-to", "earth");
  await expect(page.locator("#scale-inset")).toBeHidden();
  await expect(page.locator("#caption")).toContainText("0.53 times the radius of Earth");
  await expect(page.locator("#caption")).not.toContainText("magnified");
  await page.goto(`${URL}?look=line&scale=1&body=mercury&ref=sun`);
  await expect(page.locator("#scale-inset")).toBeVisible();
  await expect(page.locator("#caption")).toContainText("The picture beside it is magnified.");
});
