// Every live view zooms and pans by itself: a drag, a pinch, Ctrl and the wheel, and the keys, with no controls on the page; the plain wheel at Fit scrolls the page; each element stops at its own zoom range.
// The bare element is tried on the demo's page (it registers them all), the demo and the space view with the family's bar over them, the embed page with its + and - buttons and its address, and the code builder.
// A wheel with Ctrl is sent as an event, so every browser sees the same one; the plain wheel is the browser's own, and so is a touch pinch (Chromium's input, on a phone).
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { routeNoTiles } from "./tiles-fixture.ts";

type View = { yaw?: number; tilt?: number; zoom: number; panX?: number; panY?: number };

const DEMO = "/wakusei-planets/";
const desk = (testInfo: TestInfo): void => test.skip(!/desk/.test(testInfo.project.name), "a desk's wheel and keys");
const phone = (testInfo: TestInfo, browserName: string): void => test.skip(browserName !== "chromium" || !/phone/.test(testInfo.project.name), "a phone's touch, sent through Chromium's input");
const software = (testInfo: TestInfo): void => test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");

/** Put a bare element on the page, fixed in the corner so the page below it still scrolls, and keep the last `wakusei-view` it sends. */
async function bare(page: Page, attributes: Record<string, string>): Promise<void> {
  await page.goto(DEMO);
  await page.waitForFunction(() => customElements.get("wakusei-body") !== undefined);
  await page.evaluate((attrs) => {
    const element = document.createElement("wakusei-body");
    element.id = "bare";
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    element.style.cssText = "position:fixed;left:8px;top:8px;width:300px;height:300px;z-index:50;background:#06080d";
    document.body.append(element);
    element.addEventListener("wakusei-view", (event) => ((window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail));
  }, attributes);
  await page.waitForTimeout(500);
}

const last = (page: Page): Promise<View | undefined> => page.evaluate(() => (window as unknown as { __view?: View }).__view);
const centre = async (page: Page, selector: string): Promise<{ x: number; y: number }> => {
  const box = (await page.locator(selector).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Ctrl and the wheel, as an event the page's own hands see: negative `deltaY` is up, which zooms in. */
const ctrlWheel = (page: Page, selector: string, deltaY: number, times = 1): Promise<void> =>
  page.locator(selector).evaluate(
    (el, [dy, n]) => {
      const box = el.getBoundingClientRect();
      for (let i = 0; i < (n as number); i += 1) el.dispatchEvent(new WheelEvent("wheel", { deltaY: dy as number, ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true, composed: true }));
    },
    [deltaY, times],
  );

/** Two fingers that start `gap` pixels apart about a point and end `gap + spread` apart. */
async function pinch(page: Page, at: { x: number; y: number }, gap: number, spread: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const points = (d: number) => [{ x: at.x - d / 2, y: at.y, id: 0 }, { x: at.x + d / 2, y: at.y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(gap) });
  for (let i = 1; i <= 10; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(gap + (spread * i) / 10) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(500);
}

async function drag(page: Page, from: { x: number; y: number }, dx: number, dy = 0): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(from.x + (dx * i) / 8, from.y + (dy * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test("a bare line body turns when it is dragged, and puts the view back at Fit with 0", async ({ page }) => {
  await bare(page, { body: "saturn", look: "line" });
  await drag(page, await centre(page, "#bare"), 80);
  const turned = await last(page);
  expect(turned?.yaw, "a drag right turns the body").not.toBe(0);
  expect(turned?.zoom, "and does not zoom it").toBe(1);
  await page.locator("#bare").focus();
  await page.keyboard.press("0");
  expect((await last(page))?.yaw, "0 is Fit").toBe(0);
});

test("a bare body: Ctrl and the wheel zoom about the pointer, the plain wheel scrolls the page, and + and - zoom from the keys", async ({ page }, testInfo) => {
  desk(testInfo);
  await bare(page, { body: "saturn", look: "line" });
  const at = await centre(page, "#bare");
  await page.mouse.move(at.x, at.y);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY), "the plain wheel at Fit scrolls the page").toBeGreaterThan(before);
  expect(await last(page), "and does not touch the view").toBeUndefined();

  await ctrlWheel(page, "#bare", -120);
  expect((await last(page))!.zoom, "Ctrl and the wheel up zooms in").toBeGreaterThan(1);
  await ctrlWheel(page, "#bare", 600);
  expect((await last(page))!.zoom, "and down zooms out").toBeLessThan(1);

  await page.locator("#bare").focus();
  await page.keyboard.press("0");
  await page.keyboard.press("+");
  const closer = (await last(page))!.zoom;
  expect(closer, "+ zooms in").toBeGreaterThan(1);
  await page.keyboard.press("-");
  expect((await last(page))!.zoom, "- zooms out").toBeLessThan(closer);
});

test("a bare body stops at its zoom range: a line drawing from 0.1x to 50x, a shaded one from 0.1x to 8x, and zoom-min and zoom-max move it", async ({ page }, testInfo) => {
  software(testInfo);
  await routeNoTiles(page);
  await bare(page, { body: "mars", look: "line" });
  await ctrlWheel(page, "#bare", -2000, 30);
  expect((await last(page))!.zoom, "a line drawing zooms in to 50").toBeCloseTo(50, 0);
  await ctrlWheel(page, "#bare", 2000, 60);
  expect((await last(page))!.zoom, "and out to a tenth").toBeCloseTo(0.1, 2);

  await page.locator("#bare").evaluate((el) => {
    el.setAttribute("look", "realistic");
    el.setAttribute("live", "hover");
    el.setAttribute("texture-base", "textures/");
  });
  await page.waitForTimeout(800);
  await ctrlWheel(page, "#bare", -2000, 30);
  expect((await last(page))!.zoom, "a shaded body with no tiles zooms in to 8: its 2048 picture's reach, and never less").toBeCloseTo(8, 0);
  await ctrlWheel(page, "#bare", 2000, 60);
  expect((await last(page))!.zoom, "and out to a tenth").toBeCloseTo(0.1, 2);

  await page.locator("#bare").evaluate((el) => {
    el.setAttribute("zoom-max", "3");
    el.setAttribute("zoom-min", "0.5");
  });
  await page.waitForTimeout(300);
  await ctrlWheel(page, "#bare", -2000, 30);
  expect((await last(page))!.zoom, "zoom-max sets the top").toBeCloseTo(3, 0);
  await ctrlWheel(page, "#bare", 2000, 60);
  expect((await last(page))!.zoom, "and zoom-min the bottom").toBeCloseTo(0.5, 2);
});

test("controls=none takes the hands off, and a body with live=off starts without them", async ({ page }) => {
  await bare(page, { body: "saturn", look: "line", controls: "none" });
  await drag(page, await centre(page, "#bare"), 80);
  await ctrlWheel(page, "#bare", -300);
  expect(await last(page), "nothing moves it").toBeUndefined();
  expect(await page.locator("#bare").getAttribute("tabindex"), "and it is not a tab stop").toBeNull();

  await page.locator("#bare").evaluate((el) => el.setAttribute("controls", ""));
  await page.waitForTimeout(200);
  await ctrlWheel(page, "#bare", -300);
  expect((await last(page))?.zoom, "controls with no value brings them back").toBeGreaterThan(1);

  await bare(page, { body: "saturn", look: "line", live: "off" });
  await ctrlWheel(page, "#bare", -300);
  expect(await last(page), "a still has none").toBeUndefined();
});

test("two fingers pinch a bare body in and out", async ({ page, browserName }, testInfo) => {
  phone(testInfo, browserName);
  await bare(page, { body: "saturn", look: "line" });
  const at = await centre(page, "#bare");
  await pinch(page, at, 60, 120);
  const closer = (await last(page))!;
  expect(closer.zoom, "fingers apart zoom in").toBeGreaterThan(1.3);
  expect(closer.yaw, "and do not turn it").toBe(0);
  await pinch(page, at, 180, -120);
  expect((await last(page))!.zoom, "fingers together zoom out").toBeLessThan(closer.zoom * 0.8);
});

test("a finger can still scroll the page from a bare body at Fit, and a drag with a mouse turns it on a phone's width too", async ({ page }, testInfo) => {
  test.skip(!/phone/.test(testInfo.project.name), "a phone's width");
  await bare(page, { body: "saturn", look: "line" });
  expect(await page.locator("#bare").evaluate((el) => (el as HTMLElement).style.touchAction), "touch-action lets the page scroll at Fit").toBe("pan-y");
  await drag(page, await centre(page, "#bare"), 60);
  expect((await last(page))?.yaw).not.toBe(0);
});

test("the demo with its bar: Ctrl and the wheel zoom the body, the plain wheel scrolls the page, and the bar takes the element's range", async ({ page }, testInfo) => {
  desk(testInfo);
  await routeNoTiles(page);
  await page.goto(`${DEMO}?body=mars&look=line`);
  await page.waitForFunction(() => customElements.get("wakusei-body") && document.querySelector("kazoku-view-controls"));
  await page.locator("#main").evaluate((el) => el.addEventListener("wakusei-view", (event) => ((window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail)));
  await page.waitForTimeout(800);
  const limits = () => page.locator("#controls").evaluate((el) => ({ ...(Reflect.get(el, "controller") as { limits: object }).limits }));
  expect(await limits(), "a line drawing is 0.1x to 50x").toMatchObject({ zoomMin: 0.1, zoomMax: 50 });
  const at = await centre(page, "#main");
  await page.mouse.move(at.x, at.y);
  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.scrollY), "the plain wheel at Fit scrolls the page").toBeGreaterThan(before);
  await page.evaluate(() => window.scrollTo(0, 0));
  await ctrlWheel(page, "#main", -240);
  expect((await last(page))!.zoom, "Ctrl and the wheel zoom the body").toBeGreaterThan(1);
  await page.locator('#looks [data-look="realistic"]').click();
  await expect(page.locator("#main")).toHaveAttribute("look", "realistic");
  await page.waitForTimeout(500);
  expect(await limits(), "a shaded body with no tiles is 0.1x to 8x: its 2048 picture's reach, and never less").toMatchObject({ zoomMin: 0.1, zoomMax: 8 });
});

test("the demo's pinch zooms the body with the bar over it", async ({ page, browserName }, testInfo) => {
  phone(testInfo, browserName);
  await page.goto(`${DEMO}?body=mars&look=line`);
  await page.waitForFunction(() => customElements.get("wakusei-body") && document.querySelector("kazoku-view-controls"));
  await page.locator("#main").evaluate((el) => el.addEventListener("wakusei-view", (event) => ((window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail)));
  await page.waitForTimeout(800);
  await pinch(page, await centre(page, "#main"), 60, 120);
  expect((await last(page))!.zoom, "fingers apart zoom in").toBeGreaterThan(1.3);
});

test("the space view carries the controls: a millionth to 3.6x, Ctrl and the wheel, the keys", async ({ page }, testInfo) => {
  software(testInfo);
  await page.goto("/wakusei-planets/space.html");
  await page.locator("wakusei-space[data-state=live]").waitFor({ timeout: 90_000 });
  await page.locator("#space").evaluate((el) => el.addEventListener("wakusei-view", (event) => ((window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail)));
  expect(await page.locator("#controls").evaluate((el) => ({ ...(Reflect.get(el, "controller") as { limits: object }).limits })), "the bar reads the element's range").toMatchObject({ zoomMin: 1e-6, zoomMax: 3.6 });
  await ctrlWheel(page, "#space", 600);
  expect((await last(page))!.zoom, "Ctrl and the wheel down zooms out").toBeLessThan(1);
  await page.locator("#space").focus();
  await page.keyboard.press("0");
  await page.keyboard.press("+");
  expect((await last(page))!.zoom, "+ zooms in").toBeGreaterThan(1);
  await ctrlWheel(page, "#space", -3000, 30);
  expect((await last(page))!.zoom, "the camera stops at the surface").toBeLessThanOrEqual(3.6);
  await ctrlWheel(page, "#space", 3000, 80);
  expect((await last(page))!.zoom, "and out at a millionth").toBeCloseTo(1e-6, 7);
  await page.locator("#space").evaluate((el) => el.setAttribute("controls", "none"));
});

test("the embed page zooms with Ctrl and the wheel, the keys and the + and - buttons, and writes the zoom into its address", async ({ page }, testInfo) => {
  desk(testInfo);
  await page.goto("/wakusei-planets/embed.html?body=saturn&look=line");
  await page.locator("wakusei-body svg").waitFor();
  await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
  const zoomOf = (): Promise<number> => page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "state") as { zoom: number }).zoom);
  const addressZoom = (): Promise<number | null> => page.evaluate(() => (new URLSearchParams(location.search).has("zoom") ? Number(new URLSearchParams(location.search).get("zoom")) : null));
  expect(await zoomOf()).toBe(1);
  expect(await addressZoom(), "Fit is not in the address").toBeNull();
  await ctrlWheel(page, "wakusei-body", -240);
  await expect.poll(zoomOf).toBeGreaterThan(1);
  await expect.poll(addressZoom, "the address keeps the zoom").toBeGreaterThan(1);
  const wheeled = await zoomOf();
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(zoomOf, "the + button zooms in").toBeGreaterThan(wheeled);
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(zoomOf, "the - button zooms out").toBeLessThan(wheeled);
  await page.locator("wakusei-body").focus();
  await page.keyboard.press("0");
  await expect.poll(zoomOf, "0 is Fit").toBe(1);
  await expect.poll(addressZoom, "and Fit leaves the address").toBeNull();
  const at = await centre(page, "wakusei-body");
  await drag(page, at, 70);
  expect(await page.locator("wakusei-body").evaluate((el) => el.shadowRoot?.innerHTML.length ?? 0)).toBeGreaterThan(0);
  await page.goto("/wakusei-planets/embed.html?body=saturn&look=line&zoom=3");
  await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
  await expect.poll(zoomOf, "an address with a zoom opens there").toBe(3);
});

test("the embed page is wide: 0.1x to 50x for a line drawing", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?body=mars&look=line");
  await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
  const zoomOf = (): Promise<number> => page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "state") as { zoom: number }).zoom);
  await ctrlWheel(page, "wakusei-body", -2000, 30);
  await expect.poll(zoomOf).toBeCloseTo(50, 0);
  await ctrlWheel(page, "wakusei-body", 2000, 60);
  await expect.poll(zoomOf).toBeCloseTo(0.1, 2);
});

test("on a phone the embed page's pinch zooms and its buttons are there", async ({ page, browserName }, testInfo) => {
  phone(testInfo, browserName);
  await page.goto("/wakusei-planets/embed.html?body=saturn&look=line");
  await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();
  await pinch(page, await centre(page, "wakusei-body"), 60, 120);
  expect(await page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "state") as { zoom: number }).zoom), "fingers apart zoom in").toBeGreaterThan(1.3);
  await expect.poll(() => page.evaluate(() => new URLSearchParams(location.search).has("zoom")), "and the address has it").toBe(true);
});

test("the embed page for a portrait zooms too", async ({ page }) => {
  await page.goto("/wakusei-planets/embed.html?scene=look:line~earth_0_0_0.3_0~moon_0.5_0_0.1_0");
  await page.locator("wakusei-portrait").waitFor();
  await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
  await page.locator("wakusei-portrait").evaluate((el) => el.addEventListener("wakusei-view", (event) => ((window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail)));
  await ctrlWheel(page, "wakusei-portrait", -240);
  expect((await last(page))!.zoom, "Ctrl and the wheel zoom the scene").toBeGreaterThan(1);
});

test("the code builder: the picture zooms, and the iframe code and the embed link carry the zoom", async ({ page }) => {
  await page.goto("/wakusei-planets/builder.html");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "true");
  const code = page.locator('#embed-panel [part="code"]');
  await page.locator('#embed-panel button[data-kind="iframe"]').click();
  await expect(code).toContainText("embed.html?");
  await expect(code).not.toContainText("zoom=");
  await page.locator('#embed-panel button[data-kind="html"]').click();
  const preview = '#embed-panel [part="preview"] wakusei-body';
  await page.locator(preview).waitFor();
  await ctrlWheel(page, preview, -240);
  await page.locator('#embed-panel button[data-kind="iframe"]').click();
  await expect(code, "the iframe code starts where the picture was left").toContainText(/zoom=\d/);
  await expect(page.locator('#embed-panel [part="open"]')).toHaveAttribute("href", /zoom=\d/);
  await page.locator('[data-testid="body-mars"]').click();
  await expect(code, "a new body starts at Fit").not.toContainText("zoom=");
});
