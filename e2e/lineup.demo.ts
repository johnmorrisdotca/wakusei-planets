// The size line-up page in a real browser (Chromium, drawing in software): the choices in rows of clicks kept in the address, the zoom, a card for the body in frame with its papers, a hand that turns a star, the picture saved
// as a PNG and an SVG, the poster printed on A4 and US Letter, the code for every way of putting it in a page, the embed page, and Japanese. The freeze rules are in `lineup-freeze.demo.ts`.
import { expect, test, type Page } from "@playwright/test";

type Lineup = HTMLElement & { focused: string; zoom: number; metrics: { width: number; height: number; view: { x: number; y: number; h: number }; dots: { id: string; cx: number; cy: number; r: number }[] }; bodies: { id: string }[]; zoomTo(target: string | number, options?: { smooth?: boolean }): Promise<void> };

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "chromium", "3D in software, Chromium only");
});

const lineup = (page: Page) => page.locator("wakusei-lineup#lineup");
const live = (page: Page) => expect(lineup(page)).toHaveAttribute("data-state", "live", { timeout: 90_000 });
const open = async (page: Page, query = "", waitLive = true): Promise<string[]> => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    // the print dialog: what the poster is, at the moment it would open
    Reflect.set(window, "__printed", []);
    window.print = () => {
      const sheet = document.querySelector(".kazoku-sheet");
      (Reflect.get(window, "__printed") as unknown[]).push({
        page: sheet?.getAttribute("data-page"),
        orientation: sheet?.getAttribute("data-orientation"),
        title: sheet?.querySelector(".kazoku-title")?.textContent,
        brand: sheet?.querySelector(".kazoku-brand")?.textContent,
        qr: sheet?.querySelector(".kazoku-qr svg") !== null,
        svg: sheet?.querySelector("svg[role=img]") !== null,
        image: sheet?.querySelector("svg image")?.getAttribute("href")?.slice(0, 22),
        labels: [...(sheet?.querySelectorAll("svg [data-label]") ?? [])].map((el) => el.getAttribute("data-label")),
        info: [...(sheet?.querySelectorAll(".kazoku-info") ?? [])].map((el) => el.textContent),
      });
    };
  });
  await page.goto(`/wakusei-planets/lineup.html${query}`);
  await expect(lineup(page)).toBeVisible();
  if (waitLive) await live(page);
  return errors;
};
const focused = (page: Page) => lineup(page).evaluate((el) => (el as Lineup).focused);
const settled = (page: Page) => page.waitForTimeout(400);

test("the page has its choices in rows of clicks, no fold-open sections, a button for each body, and nothing scrolls sideways", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("#stars [data-stars]")).toHaveCount(3);
  await expect(page.locator("#planets [data-planets]")).toHaveCount(2);
  await expect(page.locator("#layouts [data-layout]")).toHaveCount(2);
  await expect(page.locator("#turns [data-turn]")).toHaveCount(2);
  await expect(page.locator("#go [data-go]")).toHaveCount(12);
  expect(await page.locator("main details").count(), "no fold-open sections").toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await expect(page.locator("#card-h")).toHaveText("Sun");
  await expect(page.locator("#card-lead")).toHaveText("1 Sun · 695,700 km");
  expect(await focused(page)).toBe("sun");
  const small = await page.locator("#stars button, #planets button, #layouts button, #turns button, #go button, #saves button, #papers button, #print").evaluateAll((els) => els.filter((el) => el.getBoundingClientRect().height < 36).map((el) => el.textContent));
  expect(small, "every button is a finger tall").toEqual([]);
  expect(errors).toEqual([]);
});

test("the camera is on the Sun to start, the sizes are true, and a button glides to a star and shows its radius, error, method and papers", async ({ page }) => {
  await open(page, "?planets=1&turn=off");
  expect(await lineup(page).evaluate((el) => (el as Lineup).bodies.map((body) => body.id))).toEqual(["earth", "jupiter", "sun", "sirius-a", "vega", "arcturus", "aldebaran", "rigel", "antares", "betelgeuse", "vy-canis-majoris", "woh-g64", "uy-scuti", "stephenson-2-18"]);
  const dots = await lineup(page).evaluate((el) => (el as Lineup).metrics.dots);
  const dot = (id: string) => dots.find((one) => one.id === id)!;
  expect(dot("sun").r / dot("earth").r).toBeGreaterThan(108);
  expect(dot("sun").r / dot("earth").r).toBeLessThan(110.5);
  expect(dot("sun").r / dot("jupiter").r).toBeGreaterThan(9);
  expect(dot("sirius-a").r / dot("sun").r).toBeCloseTo(1.7144, 3);
  await page.locator('#go [data-go="betelgeuse"]').click();
  await expect(page.locator("#card-h")).toHaveText("Betelgeuse", { timeout: 15_000 });
  await expect(page.locator("#card-lead")).toHaveText("1,057 Suns (+228 −162) · 735 million km");
  const facts = await page.locator("#card-facts").textContent();
  expect(facts).toContain("Haubois et al. 2009; Harper et al. 2017");
  expect(facts).toContain("44.28 mas");
  expect(await page.locator('#card-facts a[href*="adsabs.harvard.edu/abs/2009A%26A...508..923H"]').count()).toBe(1);
  expect(await page.locator("#card-facts a").count()).toBe(3);
  await expect(page.locator("#card-note")).toContainText("Joyce et al. 2020");
  await expect(page.locator("#card-others li")).toHaveCount(2);
  await expect(page.locator('#go [data-go="betelgeuse"]')).toHaveAttribute("aria-pressed", "true");
  expect(await focused(page)).toBe("betelgeuse");
  await expect(page).toHaveURL(/zoom=0\.\d+/);
  // each star's own card: a star known only from its brightness says its size is estimated
  await page.locator('#go [data-go="stephenson-2-18"]').click();
  await expect(page.locator("#card-h")).toHaveText("Stephenson 2-18", { timeout: 15_000 });
  await expect(page.locator('#card-facts [data-basis="luminosity"]')).toHaveText("estimated");
  await expect(page.locator("#card-lead")).toHaveText("2,150 Suns (+710 −290) · 1.5 billion km");
  await page.locator('#go [data-go="uy-scuti"]').click();
  await expect(page.locator("#card-h")).toHaveText("UY Scuti", { timeout: 15_000 });
  await expect(page.locator("#card-note")).toContainText("909");
  await page.locator('#go [data-go="earth"]').click();
  await expect(page.locator("#card-h")).toHaveText("Earth", { timeout: 15_000 });
  await expect(page.locator("#card-facts")).toContainText("IAU and NASA");
});

test("the choices are kept in the address and come back: stars, planets, layout, turning, paper, zoom", async ({ page }) => {
  await open(page, "?stars=bright&planets=1&layout=stack&turn=off&paper=letter&zoom=0.5");
  await expect(page.locator("#go [data-go]")).toHaveCount(10);
  for (const [selector, value] of [['#stars [data-stars="bright"]', "true"], ['#planets [data-planets="1"]', "true"], ['#layouts [data-layout="stack"]', "true"], ['#turns [data-turn="off"]', "true"], ['#papers [data-paper="letter"]', "true"]] as const) {
    await expect(page.locator(selector)).toHaveAttribute("aria-pressed", value);
  }
  expect(await lineup(page).evaluate((el) => (el as Lineup).zoom)).toBeCloseTo(0.5, 3);
  const attrs = await lineup(page).evaluate((el) => ["stars", "planets", "layout", "turn"].map((name) => el.getAttribute(name)));
  expect(attrs).toEqual(["bright", "", "stack", "off"]);
  // a stack's camera moves down the column
  const view = await lineup(page).evaluate((el) => (el as Lineup).metrics.view);
  expect(view.x).toBe(0);
  expect(view.y).toBeLessThan(0);
  await page.locator('#stars [data-stars="largest"]').click();
  await expect(page.locator("#go [data-go]")).toHaveCount(8);
  await expect(page).toHaveURL(/stars=largest/);
  await page.locator('#planets [data-planets="0"]').click();
  await expect(page.locator("#go [data-go]")).toHaveCount(6);
  await expect(page).not.toHaveURL(/planets=1/);
  await page.locator('#layouts [data-layout="row"]').click();
  await expect(page).not.toHaveURL(/layout=/);
});

test("the slider zooms smoothly from the smallest body to the largest, and the card follows the body in frame", async ({ page }) => {
  await open(page, "?stars=bright&turn=off");
  const slider = lineup(page).locator("input[type=range]");
  await expect(slider).toHaveCount(1);
  await slider.evaluate((input) => {
    (input as HTMLInputElement).value = "1000";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(page.locator("#card-h")).toHaveText("Betelgeuse");
  expect(await lineup(page).evaluate((el) => (el as Lineup).zoom)).toBe(1);
  // in between, the camera is somewhere on the way, and the picture is never empty
  const seen = new Set<string>();
  for (const value of [0, 150, 300, 450, 600, 750, 900, 1000]) {
    await slider.evaluate((input, v) => {
      (input as HTMLInputElement).value = String(v);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await settled(page);
    seen.add(await focused(page));
    const drawn = await lineup(page).evaluate((el) => (el as unknown as { stats: { drawn: string[] } }).stats.drawn);
    expect(drawn.length, `something is drawn at ${value}`).toBeGreaterThan(0);
  }
  expect(seen.size).toBeGreaterThanOrEqual(5);
  // the keys: arrows go to the next body, Home to the first
  await lineup(page).focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#card-h")).toHaveText("Sun", { timeout: 15_000 });
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#card-h")).toHaveText("Sirius A", { timeout: 15_000 });
  await page.keyboard.press("End");
  await expect(page.locator("#card-h")).toHaveText("Betelgeuse", { timeout: 15_000 });
});

test("the labels give each body's name, and the big ones their radius, kilometres and source; a body too small to see has a ring", async ({ page }) => {
  await open(page, "?planets=1&turn=off");
  const over = (name: string) => lineup(page).evaluate((el, selector) => [...el.shadowRoot!.querySelectorAll(selector)].map((node) => node.textContent), name);
  const labels = await over("#over [data-label]");
  expect(labels.some((text) => /^Sun1 Sun695,700 km/.test(text ?? ""))).toBe(true);
  // the Earth is a ring just inside the edge of a wide picture (a tall one does not reach it from the Sun)
  const wide = (page.viewportSize()?.width ?? 0) >= 800;
  if (wide) expect(await lineup(page).evaluate((el) => el.shadowRoot!.querySelectorAll("#over circle").length), "the Earth is a ring beside the Sun").toBeGreaterThanOrEqual(1);
  await page.locator('#go [data-go="rigel"]').click();
  await expect(page.locator("#card-h")).toHaveText("Rigel", { timeout: 15_000 });
  await settled(page);
  const rigel = (await over("#over [data-label]")).find((text) => text?.startsWith("Rigel"));
  expect(rigel).toContain("78.9 Suns (±7.4)");
  expect(rigel).toContain("Moravveji et al. 2012");
});

test("a drag on a star turns it by hand and nothing else moves; a double click puts it back", async ({ page }) => {
  await open(page, "?turn=off");
  // the cheap star has a still surface: the full one boils with the clock, so two draws of the same turn differ a little
  await lineup(page).evaluate((el) => el.setAttribute("quality", "low"));
  await live(page);
  await page.waitForTimeout(800);
  const box = (await lineup(page).boundingBox())!;
  const sun = (await lineup(page).evaluate((el) => (el as Lineup).metrics.dots)).find((dot) => dot.id === "sun")!;
  const at = { x: box.x + sun.cx, y: box.y + sun.cy };
  const before = await lineup(page).screenshot();
  await page.waitForTimeout(400);
  expect((await lineup(page).screenshot()).equals(before), "a star at rest does not change").toBe(true);
  await page.mouse.move(at.x, at.y);
  await expect(lineup(page)).toHaveAttribute("data-hand", "");
  await page.mouse.down();
  await expect(lineup(page)).toHaveAttribute("data-held", "");
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(at.x + i * 14, at.y + i * 3);
  await page.mouse.up();
  await expect(lineup(page)).not.toHaveAttribute("data-held", "");
  await page.waitForTimeout(500);
  const turned = await lineup(page).screenshot();
  expect(turned.equals(before), "the star's surface turned").toBe(false);
  // the zoom did not move, and a press where there is no star turns nothing
  expect(await focused(page)).toBe("sun");
  const dots = await lineup(page).evaluate((el) => (el as Lineup).metrics.dots);
  let empty: { x: number; y: number } | undefined;
  for (let y = 12; y < box.height - 12 && empty === undefined; y += 16) for (let x = 12; x < box.width - 140 && empty === undefined; x += 16) if (dots.every((dot) => Math.hypot(x - dot.cx, y - dot.cy) > dot.r + 20 && Math.hypot(x + 120 - dot.cx, y - dot.cy) > dot.r + 20)) empty = { x: box.x + x, y: box.y + y };
  if (empty !== undefined) {
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x + 120, empty.y);
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect((await lineup(page).screenshot()).equals(turned), "a press on the empty sky turns nothing").toBe(true);
  }
  await page.mouse.dblclick(at.x, at.y);
  await page.waitForTimeout(500);
  expect((await lineup(page).screenshot()).equals(before), "a double click puts the star back").toBe(true);
});

test("the bodies turn by themselves unless turning is off", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.goto("/wakusei-planets/lineup.html");
  await live(page);
  const a = await lineup(page).screenshot();
  await page.waitForTimeout(1200);
  const b = await lineup(page).screenshot();
  expect(a.equals(b), "the Sun turns").toBe(false);
  await page.locator('#turns [data-turn="off"]').click();
  await page.waitForTimeout(600);
  const c = await lineup(page).screenshot();
  await page.waitForTimeout(1000);
  expect((await lineup(page).screenshot()).equals(c), "turning off stops it").toBe(true);
  await context.close();
});

test("save as an image: a PNG and an SVG of the picture on the screen, labels and all", async ({ page }) => {
  await open(page, "?turn=off");
  await page.locator('#go [data-go="rigel"]').click();
  await expect(page.locator("#card-h")).toHaveText("Rigel", { timeout: 15_000 });
  await settled(page);
  const png = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator('#saves [data-save="png"]').click();
  const pngFile = await png;
  expect(pngFile.suggestedFilename()).toBe("size-lineup-rigel.png");
  const path = await pngFile.path();
  const bytes = (await import("node:fs")).readFileSync(path);
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  expect(width).toBeGreaterThan(1000);
  expect(width / height).toBeCloseTo(16 / 9, 1);
  const svg = page.waitForEvent("download", { timeout: 60_000 });
  await page.locator('#saves [data-save="svg"]').click();
  const svgFile = await svg;
  expect(svgFile.suggestedFilename()).toBe("size-lineup-rigel.svg");
  const text = (await import("node:fs")).readFileSync((await svgFile.path())!, "utf8");
  expect(text).toContain("<svg");
  expect(text).toContain("data:image/png;base64,");
  expect(text).toContain("78.9 Suns (±7.4)");
  expect(text).toContain("Moravveji et al. 2012");
  await expect(page.locator("#status")).toHaveText("");
});

test("print as a poster: a landscape sheet on A4 or US Letter with the picture, the labels, the star in frame and a QR code", async ({ page }) => {
  await open(page, "?turn=off");
  await page.locator('#go [data-go="antares"]').click();
  await expect(page.locator("#card-h")).toHaveText("Antares", { timeout: 15_000 });
  await settled(page);
  await page.locator("#print").click();
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, "__printed") as unknown[]).length), { timeout: 60_000 }).toBe(1);
  const a4 = await page.evaluate(() => (Reflect.get(window, "__printed") as Record<string, unknown>[])[0]);
  expect(a4).toMatchObject({ page: "a4", orientation: "landscape", title: "Size line-up: Antares", brand: "Space Program X", qr: true, svg: true });
  expect(String(a4["image"])).toContain("data:image/png");
  expect(a4["labels"] as string[]).toContain("antares");
  expect((a4["info"] as string[]).join(" ")).toContain("680 Suns");
  await page.locator('#papers [data-paper="letter"]').click();
  await page.locator("#print").click();
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, "__printed") as unknown[]).length), { timeout: 60_000 }).toBe(2);
  expect(await page.evaluate(() => (Reflect.get(window, "__printed") as { page: string }[])[1]!.page)).toBe("letter");
});

test("print really makes a one-page PDF on A4 and on US Letter", async ({ page }) => {
  await open(page, "?turn=off&paper=a4");
  for (const [paper, width, height] of [["a4", 297, 210], ["letter", 279.4, 215.9]] as const) {
    await page.locator(`#papers [data-paper="${paper}"]`).click();
    // the dialog is a stub that leaves the print-only copy of the sheet in the page, so Chromium can print it to a PDF
    await page.locator("#print").click();
    await expect(page.locator(`.kazoku-print-root .kazoku-sheet[data-page="${paper}"]`)).toBeAttached({ timeout: 60_000 });
    const pdf = await page.pdf({ preferCSSPageSize: true });
    const text = pdf.toString("latin1");
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text)!;
    expect(Math.abs(Number(box[1]) / (72 / 25.4) - width), `${paper} width`).toBeLessThan(1.5);
    expect(Math.abs(Number(box[2]) / (72 / 25.4) - height), `${paper} height`).toBeLessThan(1.5);
    expect((text.match(/\/Type\s*\/Page[^s]/g) ?? []).length, `${paper}: one page`).toBe(1);
  }
});

test("'Put it in your page' writes the code for what is on the screen, for every way, and the iframe opens the embed page", async ({ page }) => {
  await open(page, "?stars=bright&planets=1&turn=off");
  await page.locator('#go [data-go="betelgeuse"]').click();
  await expect(page.locator("#card-h")).toHaveText("Betelgeuse", { timeout: 15_000 });
  await settled(page);
  const panel = page.locator("kazoku-embed-panel");
  await expect(panel).toBeVisible();
  const code = () => panel.evaluate((el) => el.shadowRoot?.querySelector("pre, code, textarea")?.textContent ?? "");
  await expect.poll(code, { timeout: 15_000 }).toContain('<wakusei-lineup stars="bright" planets at="betelgeuse" turn="off"');
  expect(await code()).toContain("lineup/+esm");
  const kinds = await panel.evaluate((el) => (el as unknown as { kinds: string[] }).kinds);
  expect(kinds).toEqual(["html", "module", "react", "vue", "angular", "svelte", "iframe"]);
  for (const kind of kinds) {
    await panel.evaluate((el, k) => ((el as unknown as { kind: string }).kind = k), kind);
    await expect.poll(code, { timeout: 15_000, message: kind }).toContain("lineup");
  }
  await panel.evaluate((el) => ((el as unknown as { kind: string }).kind = "iframe"));
  await expect.poll(code, { timeout: 15_000 }).toContain("embed.html?lineup=1&amp;stars=bright&amp;planets=1&amp;at=betelgeuse&amp;turn=off");
});

test("the embed page shows the line-up with its own zoom slider, from the address", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/wakusei-planets/embed.html?lineup=1&stars=bright&planets=1&at=betelgeuse&turn=off");
  const element = page.locator("wakusei-lineup");
  await expect(element).toHaveAttribute("data-state", "live", { timeout: 90_000 });
  expect(await element.evaluate((el) => (el as Lineup).focused)).toBe("betelgeuse");
  expect(await element.evaluate((el) => el.shadowRoot!.querySelectorAll("input[type=range]").length)).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = (await element.boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
  expect(errors).toEqual([]);
});

test("in Japanese: the page, the card, the labels and the slider", async ({ page }) => {
  await open(page, "?lang=ja&turn=off");
  await expect(page.locator("#card-h")).toHaveText("太陽");
  await expect(page.locator("#card-lead")).toHaveText("太陽の1倍 · 695,700 km");
  await page.locator('#go [data-go="betelgeuse"]').click();
  await expect(page.locator("#card-h")).toHaveText("ベテルギウス", { timeout: 15_000 });
  await expect(page.locator("#card-lead")).toHaveText("太陽の1,057倍 (+228 −162) · 7.35億 km");
  await expect(page.locator("#card-note")).toContainText("Joyce");
  expect(await lineup(page).getAttribute("lang")).toBe("ja");
  await settled(page);
  const labels = await lineup(page).evaluate((el) => [...el.shadowRoot!.querySelectorAll("#over [data-label]")].map((node) => node.textContent));
  expect(labels.some((text) => text?.startsWith("ベテルギウス"))).toBe(true);
  expect(await lineup(page).evaluate((el) => el.shadowRoot!.querySelector("input")!.getAttribute("aria-label"))).toBe("ズーム: 太陽からステファンソン2-18まで");
  expect(await page.locator("#go [data-go='vy-canis-majoris']").textContent()).toBe("おおいぬ座VY星");
});

test("on a phone nothing scrolls sideways and the picture fits the screen", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto("/wakusei-planets/lineup.html?turn=off");
  await live(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const box = (await lineup(page).boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(390);
  expect(box.width).toBeGreaterThan(300);
  await context.close();
});
