// Names of the great features are written on the body looked at: Mare Imbrium and Tycho at fit, more craters closer in, none of those on the far side, and a press sends the place event.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&speed=0&play=off";

test("the Moon shows Mare Imbrium and Tycho, closer in a smaller crater, the far side shows neither, and a press sends the place event", async ({ page }) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const names = () => space.evaluate((el) => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((node) => (node as HTMLElement).textContent ?? ""));
  await space.evaluate((el) => (el as unknown as { goTo(id: string, options: { smooth: boolean }): void }).goTo("moon", { smooth: false }));
  await expect.poll(async () => (await names()).length, { timeout: 60_000 }).toBeGreaterThan(2);
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Sinus Medii", { smooth: false, zoom: 1 }));
  await expect.poll(names, { timeout: 30_000 }).toEqual(expect.arrayContaining(["Mare Imbrium", "Tycho"]));
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Sinus Medii", { smooth: false, zoom: 0.4 }));
  await expect.poll(async () => (await names()).includes("Mare Imbrium"), { timeout: 30_000 }).toBe(true);
  const pulled = await names();
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Sinus Medii", { smooth: false, zoom: 1.4 }));
  await expect.poll(async () => (await names()).filter((name) => !pulled.includes(name)).length, { timeout: 30_000 }).toBeGreaterThan(0);
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean }): Promise<unknown> }).goToPlace("Poincaré", { smooth: false }));
  await expect.poll(names, { timeout: 30_000 }).not.toEqual(expect.arrayContaining(["Mare Imbrium"]));
  await expect.poll(names, { timeout: 30_000 }).not.toEqual(expect.arrayContaining(["Tycho"]));
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Tycho", { smooth: false, zoom: 2 }));
  await expect.poll(names, { timeout: 30_000 }).toEqual(expect.arrayContaining(["Tycho"]));
  await space.evaluate((el) => {
    const host = el as unknown as { _picked?: string };
    host._picked = "";
    el.addEventListener("wakusei-place", (event) => {
      host._picked = (event as CustomEvent<{ place: { id: string } }>).detail.place.id;
    });
    const button = [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].find((node) => node.textContent === "Tycho") as HTMLButtonElement | undefined;
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
  });
  await expect.poll(() => space.evaluate((el) => (el as unknown as { _picked?: string })._picked ?? "")).toBe("moon/tycho");
});

test("a name never covers a landing dot or another name, and a press at the centre of the Apollo 11 dot reaches the dot", async ({ page }) => {
  await page.goto(`${PAGE}&places=landing,crash,planned`);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await space.evaluate((el) => (el as unknown as { goTo(id: string, options: { smooth: boolean }): void }).goTo("moon", { smooth: false }));
  const boxes = () =>
    space.evaluate((el) => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, text: node.textContent ?? "", id: (node as HTMLElement).dataset["place"] ?? "" };
      };
      const all = [...(el.shadowRoot?.querySelectorAll(".wk-place") ?? [])];
      return { names: all.filter((n) => n.hasAttribute("data-name")).map(rect), dots: all.filter((n) => !n.hasAttribute("data-name")).map(rect), labels: [...(el.shadowRoot?.querySelectorAll(".sp-label:not([hidden])") ?? [])].map(rect) };
    });
  const overlap = (a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  // at fit and closer in, where more dots and more names are written
  for (const zoom of [1, 2, 3]) {
    await space.evaluate((el, z) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Apollo 11 lunar module", { smooth: false, zoom: z }), zoom);
    await expect.poll(async () => ((await boxes()).names.length > 0 && (await boxes()).dots.some((d) => d.id === "moon/apollo-11-lunar-module")), { timeout: 60_000 }).toBe(true);
    const { names, dots, labels } = await boxes();
    for (const name of names) {
      for (const dot of dots) expect(overlap(name, dot), `zoom ${zoom}: the name ${name.text} is over a dot (${dot.id})`).toBe(false);
      for (const label of labels) expect(overlap(name, label), `zoom ${zoom}: the name ${name.text} is over the label ${label.text}`).toBe(false);
      for (const other of names) if (other !== name) expect(overlap(name, other), `zoom ${zoom}: the name ${name.text} is over the name ${other.text}`).toBe(false);
    }
  }
  const { dots } = await boxes();
  // a real press at the middle of the dot goes to the dot, not to a name written over it
  const eagle = dots.find((dot) => dot.id === "moon/apollo-11-lunar-module")!;
  await space.evaluate((el) => {
    const host = el as unknown as { _picked?: string };
    host._picked = "";
    el.addEventListener("wakusei-place", (event) => {
      host._picked = (event as CustomEvent<{ place: { id: string } }>).detail.place.id;
    });
  });
  await page.mouse.click((eagle.left + eagle.right) / 2, (eagle.top + eagle.bottom) / 2);
  await expect.poll(() => space.evaluate((el) => (el as unknown as { _picked?: string })._picked ?? "")).toBe("moon/apollo-11-lunar-module");
});

test("a drag that starts on a name turns the body, and a tap on a name picks the place", async ({ page }) => {
  await page.goto("/wakusei-planets/?body=mars&look=painted");
  const main = page.locator("#main");
  await main.hover();
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await page.locator("#controls").evaluate((el) => (el as unknown as { pause(): void }).pause());
  const names = () => main.evaluate((el) => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((node) => {
    const r = node.getBoundingClientRect();
    return { text: node.textContent ?? "", x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, opacity: Number((node as HTMLElement).style.opacity || "1") };
  }));
  await expect.poll(async () => (await names()).length, { timeout: 60_000 }).toBeGreaterThan(1);
  await page.waitForTimeout(1500);
  const box = (await main.boundingBox())!;
  // the name nearest the middle of the picture, where a drag starts
  const before = await names();
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const start = [...before].sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))[0]!;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 40, start.y, { steps: 5 });
  await page.mouse.move(start.x + 90, start.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await names();
  const shifts = before.flatMap((one) => after.filter((other) => other.text === one.text).map((other) => other.x - one.x));
  expect(shifts.length, "names stay in the picture after the turn").toBeGreaterThan(0);
  expect(Math.max(...shifts.map(Math.abs)), `a drag of 90 px that began on ${start.text} turned the body (names moved ${shifts.map((x) => x.toFixed(0)).join(", ")})`).toBeGreaterThan(8);
  // a tap on a name, no movement, picks its place
  await main.evaluate((el) => {
    const host = el as unknown as { _picked?: string };
    host._picked = "";
    el.addEventListener("wakusei-place", (event) => {
      host._picked = (event as CustomEvent<{ place: { id: string } }>).detail.place.id;
    });
  });
  // a name that can be read: one near the limb fades out, and a press on one that has faded away picks nothing
  const tapAt = async (touch: boolean) => {
    const readable = (await names()).filter((one) => one.opacity >= 0.5);
    const tap = readable[0]!;
    await main.evaluate((el) => ((el as unknown as { _picked?: string })._picked = ""));
    if (touch) await page.touchscreen.tap(tap.x, tap.y);
    else {
      await page.mouse.move(tap.x, tap.y);
      await page.mouse.down();
      await page.mouse.up();
    }
    await expect.poll(() => main.evaluate((el) => (el as unknown as { _picked?: string })._picked ?? ""), { message: `a ${touch ? "touch" : "mouse"} tap on ${tap.text}` }).toMatch(/^mars\//);
  };
  await tapAt(false);
  if (test.info().project.name.endsWith("phone")) await tapAt(true);
});

// With the names on (the default), the turns still work on a body that has names: measured by the view's own state, not by pixels.
test.describe("Venus painted with its names on", () => {
  const open = async (page: import("@playwright/test").Page) => {
    await page.goto("/wakusei-planets/?body=venus&look=painted");
    const main = page.locator("#main");
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 120_000 });
    await page.locator("#controls").evaluate((el) => (el as unknown as { pause(): void }).pause());
    expect(await main.getAttribute("surface-names"), "the names are on by default").toBeNull();
    const names = () => main.evaluate((el) => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((node) => {
      const r = node.getBoundingClientRect();
      return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    }));
    await expect.poll(async () => (await names()).length, { timeout: 60_000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    const yaw = () => page.locator("#controls").evaluate((el) => Number((Reflect.get(el, "state") as { yaw: number }).yaw));
    return { main, names, yaw };
  };

  test("a drag that starts on a name turns the view", async ({ page }) => {
    const { main, names, yaw } = await open(page);
    const box = (await main.boundingBox())!;
    const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const start = [...(await names())].sort((a, b) => Math.hypot(a.x - mid.x, a.y - mid.y) - Math.hypot(b.x - mid.x, b.y - mid.y))[0]!;
    const before = await yaw();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 40, start.y, { steps: 5 });
    await page.mouse.move(start.x + 90, start.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(Math.abs((await yaw()) - before), "the view's yaw turned by the drag").toBeGreaterThan(1);
  });

  test("the arrow keys turn the view", async ({ page }) => {
    const { yaw } = await open(page);
    // a click on the view's corner gives it the keys (focus() alone does not reach it until the page has been touched)
    const box = (await page.locator("#view").boundingBox())!;
    await page.mouse.click(box.x + 6, box.y + 6);
    await page.locator("#view").focus();
    const before = await yaw();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await expect.poll(async () => Math.abs((await yaw()) - before), { timeout: 10_000, message: "the view's yaw turned by the arrow key" }).toBeGreaterThan(1);
  });
});
