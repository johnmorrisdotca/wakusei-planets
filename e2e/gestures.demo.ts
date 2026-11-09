// The family's view gestures on the demo, as kazoku-ui's view-controls guide writes them: the wheel moves the view, Shift and the wheel moves it sideways, Ctrl, Command or Alt with the wheel zooms,
// the middle button or Space with a drag moves it, Shift with a drag rolls it, and a plain drag turns it. The pictures are compared: whatever the controls say the view did, the picture did the same
// (a pan is in CSS pixels, and the picture moves by as many). Real wheel, pointer and key events on the line drawing, which is an SVG, so the test needs no 3D.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { groundShift } from "./ground.mjs";

const URL = "/wakusei-planets/?body=mars&look=line";

type Detail = { yaw: number; tilt: number; roll: number; zoom: number; panX: number; panY: number; reason: string };
const detail = (page: Page): Promise<Detail> => page.evaluate(() => (window as unknown as { __view: Detail }).__view);

async function open(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => customElements.get("wakusei-body") && document.querySelector("kazoku-view-controls"));
  await page.locator("#controls").evaluate((el) => {
    (el as unknown as { pause(): void }).pause();
    el.addEventListener("kazoku-viewchange", (event) => {
      (window as unknown as { __view: unknown }).__view = (event as CustomEvent).detail;
    });
  });
  await page.waitForTimeout(800);
}

const setView = (page: Page, view: Record<string, number>): Promise<void> => page.locator("#controls").evaluate((el, v) => (Reflect.get(el, "controller") as { set(v: unknown, final: boolean, reason: string): void }).set(v, true, "set"), view);

async function wheel(page: Page, modifiers: string[], deltaY: number, deltaX = 0): Promise<void> {
  const box = (await page.locator("#view").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.wheel(deltaX, deltaY);
  for (const key of modifiers) await page.keyboard.up(key);
  await page.waitForTimeout(600);
}

const shot = (page: Page): Promise<Buffer> => page.locator("#view").screenshot();

/** How far the picture moved between two pictures, in CSS pixels (a screenshot has a pixel for each device pixel, and Safari's desk has two). */
async function shiftOf(page: Page, before: Buffer, after: Buffer): Promise<{ x: number; y: number }> {
  const ratio = await page.evaluate(() => window.devicePixelRatio);
  const moved = await groundShift(page, before, after, Math.round(100 * ratio));
  return { x: moved.x / ratio, y: moved.y / ratio };
}

const desk = (testInfo: TestInfo): void => test.skip(!/desk/.test(testInfo.project.name), "a desk's wheel and keys");

test("a plain wheel and Shift with the wheel move the view, and the picture moves by as many pixels as the controls say", async ({ page }, testInfo) => {
  desk(testInfo);
  await open(page);
  await setView(page, { zoom: 2 });
  await page.waitForTimeout(500);
  for (const [label, modifiers, dy] of [["plain wheel", [], 60], ["Shift and the wheel", ["Shift"], 60]] as const) {
    const before = await shot(page);
    const was = await detail(page);
    await wheel(page, [...modifiers], dy);
    const now = await detail(page);
    const dx = now.panX - was.panX;
    const dyMoved = now.panY - was.panY;
    expect(Math.hypot(dx, dyMoved), `${label} moves the view`).toBeGreaterThan(20);
    expect(now.reason, label).toBe("wheel");
    expect(now.yaw, `${label} does not turn it`).toBe(was.yaw);
    const moved = await shiftOf(page, before, await shot(page));
    expect(Math.abs(moved.x - dx), `${label}: the picture moved ${moved.x},${moved.y}, the controls say ${dx},${dyMoved}`).toBeLessThanOrEqual(Math.max(6, Math.abs(dx) * 0.1));
    expect(Math.abs(moved.y - dyMoved), `${label}: the picture moved ${moved.x},${moved.y}, the controls say ${dx},${dyMoved}`).toBeLessThanOrEqual(Math.max(6, Math.abs(dyMoved) * 0.1));
  }
});

test("a plain wheel at Fit has nothing to move and leaves the view alone", async ({ page }, testInfo) => {
  desk(testInfo);
  await open(page);
  await wheel(page, [], 120);
  expect(await detail(page)).toBeUndefined();
});

test("Ctrl, Command and Alt with the wheel zoom, up zooms in and down zooms out", async ({ page }, testInfo) => {
  desk(testInfo);
  await open(page);
  for (const key of ["Control", "Meta", "Alt"]) {
    await setView(page, { zoom: 2, panX: 0, panY: 0 });
    await wheel(page, [key], -120);
    const closer = await detail(page);
    expect(closer.zoom, `${key} and the wheel up zooms in`).toBeGreaterThan(2);
    await setView(page, { zoom: 2, panX: 0, panY: 0 });
    await wheel(page, [key], 120);
    const further = await detail(page);
    expect(further.zoom, `${key} and the wheel down zooms out`).toBeLessThan(2);
  }
});

test("the middle button and a drag, and Space and a drag, move a zoomed view, and the picture follows", async ({ page }, testInfo) => {
  desk(testInfo);
  await open(page);
  await setView(page, { zoom: 3 });
  const box = (await page.locator("#view").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (const [label, start, finish] of [
    ["the middle button", async () => page.mouse.down({ button: "middle" }), async () => page.mouse.up({ button: "middle" })],
    ["Space", async () => { await page.keyboard.down("Space"); await page.mouse.down(); }, async () => { await page.mouse.up(); await page.keyboard.up("Space"); }],
  ] as const) {
    await setView(page, { zoom: 3, panX: 0, panY: 0 });
    await page.waitForTimeout(400);
    const before = await shot(page);
    await page.mouse.move(cx, cy);
    await start();
    for (let i = 1; i <= 8; i += 1) await page.mouse.move(cx + i * 8, cy + i * 4);
    await finish();
    await page.waitForTimeout(500);
    const now = await detail(page);
    expect(now.panX, `${label} and a drag moves the view right`).toBeGreaterThan(20);
    expect(now.yaw, `${label} and a drag does not turn it`).toBe(0);
    const moved = await shiftOf(page, before, await shot(page));
    expect(Math.abs(moved.x - now.panX), `${label}: the picture moved ${moved.x},${moved.y}, the controls say ${now.panX},${now.panY}`).toBeLessThanOrEqual(Math.max(6, Math.abs(now.panX) * 0.1));
  }
});

test("Shift and a drag rolls the picture clockwise on the screen, and a plain drag turns the body and does not roll", async ({ page }, testInfo) => {
  desk(testInfo);
  await open(page);
  const box = (await page.locator("#view").boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(cx + i * 10, cy);
  await page.mouse.up();
  const turned = await detail(page);
  expect(turned.yaw, "a plain drag right turns the body").not.toBe(0);
  expect(turned.roll, "and does not roll it").toBe(0);

  await setView(page, { yaw: 0, tilt: 0, roll: 0 });
  await page.waitForTimeout(500);
  const upright = await shot(page);
  await page.keyboard.down("Shift");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(cx + i * 15, cy);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const rolled = await detail(page);
  expect(rolled.roll, "Shift and a drag right rolls clockwise").toBeGreaterThan(20);

  // the picture at the roll the drag reached is the upright picture turned that many degrees clockwise, and not the other way
  await setView(page, { roll: 90 });
  await page.waitForTimeout(600);
  const quarter = await shot(page);
  const differences = await page.evaluate(
    async ([a, b]) => {
      const load = async (png: string): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, (side - img.width) / 2, (side - img.height) / 2);
        return ctx.getImageData(0, 0, side, side);
      };
      const turnedBy = async (png: string, quarters: number): Promise<ImageData> => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        // a wide or tall view: only the square in the middle turns into itself, so both pictures are that square
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext("2d")!;
        ctx.translate(side / 2, side / 2);
        ctx.rotate((quarters * Math.PI) / 2);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        return ctx.getImageData(0, 0, side, side);
      };
      const gap = (p: ImageData, q: ImageData): number => {
        let sum = 0;
        for (let i = 0; i < p.data.length; i += 4) sum += Math.abs(p.data[i]! - q.data[i]!);
        return sum / (p.data.length / 4);
      };
      const rolledPicture = await load(b);
      return { clockwise: gap(await turnedBy(a, 1), rolledPicture), counter: gap(await turnedBy(a, -1), rolledPicture) };
    },
    [upright.toString("base64"), quarter.toString("base64")] as const,
  );
  expect(differences.clockwise, `rolled 90 degrees it matches the upright picture turned clockwise (${differences.clockwise.toFixed(1)}) better than counter-clockwise (${differences.counter.toFixed(1)})`).toBeLessThan(differences.counter * 0.8);
});

/** Two fingers that start `gap` pixels apart about a point and end `gap + spread` apart: real touch events through the browser's own input, as a phone sends them. */
async function pinch(page: Page, at: { x: number; y: number }, gap: number, spread: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const points = (d: number) => [{ x: at.x - d / 2, y: at.y, id: 0 }, { x: at.x + d / 2, y: at.y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: points(gap) });
  for (let i = 1; i <= 10; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: points(gap + (spread * i) / 10) });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(600);
}

test("two fingers pinching apart zoom the view in, and together zoom it out", async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== "chromium" || !/phone/.test(testInfo.project.name), "a phone's touch, sent through Chromium's input");
  await open(page);
  const box = (await page.locator("#view").boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await pinch(page, centre, 60, 120);
  const closer = await detail(page);
  expect(closer.zoom, "fingers apart zoom in").toBeGreaterThan(1.3);
  expect(closer.yaw, "and do not turn the body").toBe(0);
  await pinch(page, centre, 180, -120);
  expect((await detail(page)).zoom, "fingers together zoom out").toBeLessThan(closer.zoom * 0.8);
});
