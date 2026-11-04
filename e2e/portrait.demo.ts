// The portrait builder: real pointer drags, the wheel, real key presses and the saved pictures. The 3D tests run in Chromium in software (WebKit has no software switch); the line look needs no WebGL
// and runs everywhere. Heavy things (the number of draws, graphics memory) are in freeze.demo.ts.
import { expect, test, type Page } from "@playwright/test";
import { dragBy, groundShift } from "./ground.ts";

const PAGE = "/wakusei-planets/portrait.html";
const MANUAL = "layout:manual~look:painted~labels:0~orbits:0~shadows:0";
const open = async (page: Page, scene: string): Promise<void> => {
  await page.goto(`${PAGE}?scene=${encodeURIComponent(scene)}`);
  await expect(page.locator("#view")).toHaveAttribute("data-state", /live|line/, { timeout: 90_000 });
};
interface Dbg {
  scene(): { items: { body: string; x: number; y: number; r: number; spin: number; pitch?: number; turn: number }[]; camera: { x: number; y: number; h: number }; layout: string; look: string };
}
const scene = (page: Page) => page.evaluate(() => (globalThis as unknown as { wakuseiPortraitDebug: Dbg }).wakuseiPortraitDebug.scene());
const metrics = (page: Page) => page.evaluate(() => (document.querySelector("#view") as unknown as { metrics: { width: number; height: number; scale: number } }).metrics);
const centreOf = async (page: Page, index: number): Promise<{ x: number; y: number; scale: number }> => {
  const box = (await page.locator("#view").boundingBox())!;
  const m = await page.evaluate(() => {
    const view = document.querySelector("#view") as unknown as { metrics: { width: number; height: number; scale: number; camera: { x: number; y: number }; placed: { x: number; y: number }[] } };
    return view.metrics;
  });
  const item = m.placed[index]!;
  return { x: box.x + m.width / 2 + (item.x - m.camera.x) * m.scale, y: box.y + m.height / 2 - (item.y - m.camera.y) * m.scale, scale: m.scale };
};
const drag = async (page: Page, from: { x: number; y: number }, dx: number, dy: number, modifier?: string): Promise<void> => {
  if (modifier !== undefined) await page.keyboard.down(modifier);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(from.x + (dx * i) / 8, from.y + (dy * i) / 8);
  await page.mouse.up();
  if (modifier !== undefined) await page.keyboard.up(modifier);
};

test.describe("3D", () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(browserName !== "chromium" || testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  });

  test("a body follows a drag in a manual layout, undo and redo put it back, and the address holds the scene", async ({ page }) => {
    await open(page, `${MANUAL}~earth_-0.5_0_0.2_0~mars_0.5_0_0.15_0~jupiter_0_0.5_0.3_0`);
    const before = (await scene(page)).items[0]!;
    const at = await centreOf(page, 0);
    await drag(page, at, 120, 60, "Alt");
    const moved = (await scene(page)).items[0]!;
    expect((moved.x - before.x) * at.scale).toBeGreaterThan(110);
    expect((moved.x - before.x) * at.scale).toBeLessThan(130);
    expect((before.y - moved.y) * at.scale).toBeGreaterThan(50);
    expect((before.y - moved.y) * at.scale).toBeLessThan(70);
    await page.locator("#undo").click();
    expect((await scene(page)).items[0]!.x).toBeCloseTo(before.x, 6);
    await page.locator("#redo").click();
    expect((await scene(page)).items[0]!.x).toBeCloseTo(moved.x, 6);
    await page.waitForTimeout(600);
    expect(page.url()).toContain("scene=");
    const text = new URL(page.url()).searchParams.get("scene")!;
    await page.reload();
    await expect(page.locator("#view")).toHaveAttribute("data-state", "live", { timeout: 90_000 });
    const again = (await scene(page)).items[0]!;
    expect(again.x).toBeCloseTo(moved.x, 3);
    expect(text).toContain("earth_");
  });

  test("a body snaps to the others and says so, and Alt turns the snap off", async ({ page }) => {
    await open(page, `${MANUAL}~earth_-0.5_0_0.2_0~mars_0.5_0.3_0.15_0`);
    const mars = await centreOf(page, 1);
    // drag Mars to almost the height of the Earth: it snaps to it
    await drag(page, mars, 0, 0.3 * mars.scale - 3);
    expect((await scene(page)).items[1]!.y).toBeCloseTo(0, 6);
    await page.locator("#undo").click();
    await drag(page, await centreOf(page, 1), 0, 0.3 * mars.scale - 3, "Alt");
    expect(Math.abs((await scene(page)).items[1]!.y)).toBeGreaterThan(0.002);
  });

  test("Shift and the wheel over a body sizes it, the wheel zooms the view, a drag on empty space moves the view, Centre and Fit all bring the bodies back", async ({ page }) => {
    await open(page, `${MANUAL}~earth_-0.5_0_0.2_0~mars_0.5_0_0.15_0`);
    const mars = await centreOf(page, 1);
    await page.mouse.move(mars.x, mars.y);
    const before = await scene(page);
    await page.mouse.wheel(0, -300);
    await expect.poll(async () => (await scene(page)).camera.h).toBeLessThan(before.camera.h * 0.9);
    expect((await scene(page)).items[1]!.r).toBe(before.items[1]!.r);
    await page.locator("#fit").click();
    const marsAgain = await centreOf(page, 1);
    await page.mouse.move(marsAgain.x, marsAgain.y);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, -300);
    await page.keyboard.up("Shift");
    await expect.poll(async () => (await scene(page)).items[1]!.r).toBeGreaterThan(0.17);
    const cam = (await scene(page)).camera;
    const box = (await page.locator("#view").boundingBox())!;
    await drag(page, { x: box.x + 60, y: box.y + box.height - 40 }, -150, -50);
    const panned = (await scene(page)).camera;
    expect(panned.x).toBeGreaterThan(cam.x + 0.1);
    expect(panned.y).toBeLessThan(cam.y);
    await page.locator("#fit").click();
    const fit = (await scene(page)).camera;
    expect(Math.abs(fit.x)).toBeLessThan(0.2);
    expect(fit.h).toBeGreaterThan(0.2);
    await page.locator("#centre").click();
    expect(Math.abs((await scene(page)).camera.x)).toBeLessThan(0.2);
  });

  test("the keys: arrows nudge, [ and ] size, Page Up and End order, Delete removes, and Control Z undoes", async ({ page }) => {
    await open(page, `${MANUAL}~earth_-0.5_0_0.2_0~mars_0.5_0_0.15_0~jupiter_0_0.5_0.3_0`);
    await page.locator('[data-testid="item-earth"]').click();
    await page.locator("#wrap").focus();
    const m = await metrics(page);
    const x0 = (await scene(page)).items[0]!.x;
    await page.keyboard.press("ArrowRight");
    expect(((await scene(page)).items[0]!.x - x0) * m.scale).toBeCloseTo(1, 1);
    await page.keyboard.press("Shift+ArrowUp");
    expect((await scene(page)).items[0]!.y * m.scale).toBeCloseTo(10, 0);
    const r0 = (await scene(page)).items[0]!.r;
    await page.keyboard.press("]");
    expect((await scene(page)).items[0]!.r).toBeGreaterThan(r0);
    await page.keyboard.press("End");
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["mars", "jupiter", "earth"]);
    await page.keyboard.press("Home");
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["earth", "mars", "jupiter"]);
    await page.keyboard.press("PageUp");
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["mars", "earth", "jupiter"]);
    await page.keyboard.press("Delete");
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["mars", "jupiter"]);
    await page.keyboard.press("Control+z");
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["mars", "earth", "jupiter"]);
  });

  test("in Auto-fit, dragging a body past another changes the order and the bodies stay clear of each other", async ({ page }) => {
    await open(page, "look:painted~labels:0~orbits:0~moons:manual~earth_0_0_0.3_0~mars_0_0_0.3_0~jupiter_0_0_0.3_0");
    const first = await centreOf(page, 0);
    const third = await centreOf(page, 2);
    await drag(page, first, third.x - first.x + 20, 0);
    expect((await scene(page)).items.map((i) => i.body)).toEqual(["mars", "jupiter", "earth"]);
    expect((await scene(page)).layout).toBe("auto");
  });

  test("the turn tool and the arrow keys turn the surface under your finger: right goes right, up goes up", async ({ page }) => {
    await open(page, "layout:manual~look:painted~labels:0~orbits:0~shadows:0~mars_0_0_0.8_0~light:300,60");
    await page.waitForTimeout(3000);
    await page.locator('#tools [data-tool="turn"]').click();
    const wrap = page.locator("#wrap");
    const MIN = 8;
    const moved = async (act: () => Promise<void>): Promise<{ x: number; y: number }> => {
      const before = await wrap.screenshot();
      await act();
      await page.waitForTimeout(900);
      const s = await groundShift(page, before, await wrap.screenshot(), 60, 0.05);
      return { x: s.x, y: s.y };
    };
    const right = await moved(() => dragBy(page, wrap, 24, 0));
    expect(right.x, `a drag right moves the surface right (${right.x},${right.y})`).toBeGreaterThan(MIN);
    await dragBy(page, wrap, -24, 0);
    const up = await moved(() => dragBy(page, wrap, 0, -24));
    expect(up.y, `a drag up moves the surface up (${up.x},${up.y})`).toBeLessThan(-MIN);
    await dragBy(page, wrap, 0, 24);
    await wrap.focus();
    const arrowRight = await moved(() => page.keyboard.press("ArrowRight"));
    expect(arrowRight.x, `the right arrow moves the surface right (${arrowRight.x},${arrowRight.y})`).toBeGreaterThan(MIN);
    await page.keyboard.press("ArrowLeft");
    const arrowUp = await moved(() => page.keyboard.press("ArrowUp"));
    expect(arrowUp.y, `the up arrow moves the surface up (${arrowUp.x},${arrowUp.y})`).toBeLessThan(-MIN);
  });

  test("Shift and a drag turns a body in the Move tool too, and a body can turn by itself", async ({ page }) => {
    await open(page, `${MANUAL}~mars_0_0_0.5_0`);
    const at = await centreOf(page, 0);
    const spin0 = (await scene(page)).items[0]!.spin;
    await drag(page, at, 40, 0, "Shift");
    expect((await scene(page)).items[0]!.spin).toBeLessThan(spin0 - 5);
    await page.locator("#o-front").click().catch(() => undefined);
    await page.locator('#turns [data-turn="30"]').click();
    expect((await scene(page)).items[0]!.turn).toBe(30);
  });

  test("the picture is saved as a PNG and as an SVG, and the code is for exactly this scene", async ({ page }) => {
    await open(page, `${MANUAL}~jupiter_-0.4_0_0.3_0~io_0.3_0_0.1_0`);
    await page.waitForTimeout(3000);
    const png = await page.evaluate(async () => {
      const blob = await (document.querySelector("#view") as unknown as { toPng(scale: number): Promise<Blob> }).toPng(1);
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const scale = bitmap.height / 2;
      const d = ctx.getImageData(Math.round(bitmap.width / 2 - 0.4 * scale), Math.round(bitmap.height / 2), 1, 1).data;
      return { type: blob.type, size: blob.size, width: bitmap.width, height: bitmap.height, lit: d[0]! + d[1]! + d[2]! };
    });
    expect(png.type).toBe("image/png");
    expect(png.size).toBeGreaterThan(8000);
    expect(png.width / png.height).toBeCloseTo(16 / 9, 1);
    expect(png.lit, "Jupiter is in the picture, not just the sky").toBeGreaterThan(60);
    const svg = await page.evaluate(() => (document.querySelector("#view") as unknown as { toSvg(): Promise<string> }).toSvg());
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<image");
    await page.locator("#tab-share").click();
    const download = page.waitForEvent("download");
    await page.locator("#png").click();
    expect((await download).suggestedFilename()).toBe("wakusei-portrait.png");
    const code = page.locator('#embed-panel [part="code"]');
    await expect(code).toContainText("<wakusei-portrait");
    await expect(code).toContainText("jupiter_");
    await page.locator('#embed-panel button[data-kind="iframe"]').click();
    await expect(code).toContainText("embed.html?scene=");
    await expect(page.locator('#embed-panel [part="open"]')).toHaveAttribute("href", /embed\.html\?scene=/);
  });

  test("the embed page draws a scene from its address", async ({ page }) => {
    await page.goto(`/wakusei-planets/embed.html?scene=${encodeURIComponent("look:painted~jupiter_0_0_0.3_0~io_0_0_0.1_0")}`);
    await expect(page.locator("wakusei-portrait")).toHaveAttribute("data-state", /live|still/, { timeout: 90_000 });
    expect(await page.locator("wakusei-portrait").evaluate((el) => (el as unknown as { stats: { bodies: number } }).stats.bodies)).toBe(2);
  });
});

test("nothing the Share tab had before the shared panel is gone: seven tabs, the code, Copy, Save PNG, Save SVG, Copy link, the embed page and the credit, and a docs link besides", async ({ page }) => {
  await open(page, "look:line~jupiter_0_0_0.3_0~io_0_0_0.1_0");
  await page.locator("#tab-share").click();
  const panel = page.locator("#embed-panel");
  await expect(panel.locator('[role="tab"]')).toHaveText(["HTML", "ES module", "React", "Vue", "Angular", "Svelte", "iframe"]);
  await expect(panel.locator('[part="code"]')).toContainText("<wakusei-portrait");
  await expect(panel.locator('[part="copy"]')).toHaveText("Copy code");
  await expect(page.locator("#png")).toHaveText("Save PNG");
  await expect(page.locator("#svg")).toHaveText("Save SVG");
  await expect(page.locator("#link")).toHaveText("Copy link");
  await expect(panel.locator('[part="open"]')).toHaveText("Open the embed page");
  await expect(panel.locator('[part="docs"]')).toHaveAttribute("href", "docs/");
  await expect(panel.locator('[part="credits"]')).toContainText("Wakusei Planets by John Morris (MIT)");
  await expect(panel.locator('[part="preview"]')).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.locator('#embed-panel button[data-kind="vue"]').click();
  await expect(panel.locator('[part="code"]')).toContainText("<script setup");
  await expect(page).toHaveURL(/embed=vue/);
});

test("the line look is one SVG, with the bodies, names and orbit rings, and needs no WebGL", async ({ page }) => {
  await open(page, "look:line~earth_0_0_0.3_0~moon_0_0_0.1_0");
  await expect(page.locator("#view")).toHaveAttribute("data-state", "line");
  const parts = await page.locator("#view").evaluate((el) => ({ bodies: el.shadowRoot!.querySelectorAll("#stage svg svg").length, names: el.shadowRoot!.querySelector("#over")!.textContent, rings: el.shadowRoot!.querySelectorAll("#over circle").length, canvases: document.querySelectorAll("canvas").length }));
  expect(parts.bodies).toBe(2);
  expect(parts.names).toContain("Earth");
  expect(parts.rings).toBeGreaterThanOrEqual(1);
  expect(parts.canvases).toBe(0);
  const svg = await page.evaluate(() => (document.querySelector("#view") as unknown as { toSvg(): Promise<string> }).toSvg());
  expect(svg).toContain("Earth");
  expect(svg).not.toContain("<image");
});

test("the page has every control in the page's own style, in both languages, and nothing scrolls sideways", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(error.message));
  await open(page, "look:line~jupiter_0_0_0.3_0~io_0_0_0.1_0");
  for (const tab of ["bodies", "arrange", "look", "share"]) {
    await page.locator(`#tab-${tab}`).click();
    await expect(page.locator(`#panel-${tab}`)).toBeVisible();
    const small = await page.locator(`#panel-${tab} button:visible`).evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 40).map((el) => el.textContent));
    expect(small, `${tab}: every button is a finger wide`).toEqual([]);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.locator("kazoku-language-picker button", { hasText: "日本語" }).first().click().catch(() => undefined);
  expect(await page.locator("#sel-name").textContent()).toBeTruthy();
  expect(problems).toEqual([]);
});

test("the demo's several bodies at once open in the portrait builder at true orbit distance, with their orbits drawn", async ({ page }) => {
  await page.goto("/wakusei-planets/?body=mars&look=line&with=phobos,deimos");
  const link = page.locator('[data-testid="orbit-link"]');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator("#view")).toHaveAttribute("data-state", "line");
  await page.locator("#tab-arrange").click();
  await expect(page.locator('#arranges [data-arrange="orbit"]')).toHaveAttribute("aria-pressed", "true");
  const scene = await page.evaluate(() => (globalThis as unknown as { wakuseiPortraitDebug: { scene(): { arrange: string; items: { body: string }[] } } }).wakuseiPortraitDebug.scene());
  expect(scene.arrange).toBe("orbit");
  expect(scene.items.map((i) => i.body)).toEqual(["mars", "phobos", "deimos"]);
  expect(await page.locator("#view").evaluate((el) => el.shadowRoot!.querySelectorAll("#over circle").length)).toBe(2);
  const radii = await page.locator("#view").evaluate((el) => {
    const m = (el as unknown as { metrics: { placed: { body: string; x: number; y: number }[] } }).metrics;
    const at = (id: string) => m.placed.find((q) => q.body === id)!;
    return { phobos: Math.hypot(at("phobos").x - at("mars").x, at("phobos").y - at("mars").y), deimos: Math.hypot(at("deimos").x - at("mars").x, at("deimos").y - at("mars").y) };
  });
  expect(radii.deimos / radii.phobos).toBeCloseTo(23457 / 9375, 1);
});
