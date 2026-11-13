// Names of the great features are written on the body looked at: Mare Imbrium and Tycho at fit, more craters closer in, none of those on the far side, and a press sends the place event.
import { expect, test } from "@playwright/test";
import { underLoad } from "./under-load.ts";

test.beforeEach(async ({ page, browserName }, testInfo) => {
  await underLoad(page, browserName);
  test.skip(testInfo.project.name !== "chromium-desk" && testInfo.project.name !== "chromium-phone" && testInfo.project.name !== "webkit-desk" && testInfo.project.name !== "webkit-phone", "the four browser projects");
});

/** Waits until what the names are, and where, has been the same for four reads in a row, each two frames apart (they arrive in waves: the data, the first draw, the fade), in place of a fixed sleep. */
const steadyNames = async (main: import("@playwright/test").Locator): Promise<void> => {
  let steady = 0;
  let last = "";
  await expect.poll(async () => {
    const now = await main.evaluate(async (el) => {
      const read = () => JSON.stringify([...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((n) => { const b = n.getBoundingClientRect(); return [n.textContent, Math.round(b.left), Math.round(b.top), (n as HTMLElement).style.opacity]; }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return read();
    });
    steady = now === last && now !== "[]" ? steady + 1 : 0;
    last = now;
    return steady;
  }, { timeout: 30_000, message: "the names settled" }).toBeGreaterThanOrEqual(4);
};

const PAGE = "/wakusei-planets/space.html?t=2026-11-11T12:00:00Z&speed=0&play=off";

test("the Moon shows Mare Imbrium and Tycho, closer in a smaller crater, the far side shows neither, and a press sends the place event", async ({ page }) => {
  await page.goto(PAGE);
  const space = page.locator("wakusei-space");
  await expect(space).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const names = () => space.evaluate((el) => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((node) => (node as HTMLElement).textContent ?? ""));
  await space.evaluate((el) => (el as unknown as { goTo(id: string, options: { smooth: boolean }): void }).goTo("moon", { smooth: false }));
  await expect.poll(async () => (await names()).length, { timeout: 60_000 }).toBeGreaterThan(2);
  const radius = () => space.evaluate((el) => (el as unknown as { placeOf(id: string): { r: number } | null }).placeOf("moon")?.r ?? 0);
  const at = (zoom: number) => space.evaluate((el, z) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Sinus Medii", { smooth: false, zoom: z }), zoom);
  // at fit, on a phone too, a great sea and the best-known crater are named, within the cap of one name to 20 px of radius
  await at(1);
  await expect.poll(names, { timeout: 30_000 }).toEqual(expect.arrayContaining(["Mare Imbrium", "Tycho"]));
  expect((await names()).length, "no more names than a twentieth of the radius").toBeLessThanOrEqual(Math.floor((await radius()) / 20));
  // closer in more are named, a smaller crater among them, and Tycho
  await space.evaluate((el) => (el as unknown as { goToPlace(name: string, options: { smooth: boolean; zoom: number }): Promise<unknown> }).goToPlace("Tycho", { smooth: false, zoom: 1.6 }));
  await expect.poll(names, { timeout: 30_000 }).toEqual(expect.arrayContaining(["Tycho"]));
  expect((await names()).length, "closer in, still no more than a twentieth of the radius").toBeLessThanOrEqual(Math.floor((await radius()) / 20));
  // far out (a small Moon): none below 70 px of radius, and never more than the cap
  await at(0.3);
  await expect.poll(async () => (await radius()) < 70 ? (await names()).length : -1, { timeout: 30_000 }).toBeLessThanOrEqual(0);
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
  // a phone's Mars is small and its names are few and still fading in: come close enough for several to read
  await page.locator("#controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ zoom: 1.8 }, true, "set"));
  const names = () => main.evaluate((el) => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((node) => {
    const r = node.getBoundingClientRect();
    return { text: node.textContent ?? "", x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, opacity: Number((node as HTMLElement).style.opacity || "1") };
  }));
  await expect.poll(async () => (await names()).length, { timeout: 60_000 }).toBeGreaterThan(1);
  await steadyNames(main);
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
  await steadyNames(main);
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
    await steadyNames(main);
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
    await expect.poll(async () => Math.abs((await yaw()) - before), { message: "the view's yaw turned by the drag" }).toBeGreaterThan(1);
  });

  test("a reader with the keyboard only Tabs to the view, past no name, and the arrow keys turn it, with no click", async ({ page }) => {
    const { yaw } = await open(page);
    // from the top of the page, by real Tab presses: the view is a stop (it has a name), and it is reached before any written name
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let reached = 0;
    for (let i = 1; i <= 60 && reached === 0; i += 1) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.id === "main")) reached = i;
    }
    expect(reached, "Tab reaches the view").toBeGreaterThan(0);
    expect(await page.locator("#main").getAttribute("aria-label"), "the view has a name").not.toBeNull();
    const before = await yaw();
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("ArrowRight");
    await expect.poll(async () => Math.abs((await yaw()) - before), { timeout: 10_000, message: "the view's yaw turned by the arrow key" }).toBeGreaterThan(1);
    // the written names are not stops: the next Tab leaves the view for its controls, not for a name
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => (document.activeElement?.shadowRoot?.activeElement ?? null) !== null && document.activeElement?.id === "main"), "no name takes the next Tab").toBe(false);
  });
});

// A small Moon is not covered by its names: below 70 px of radius none are written, above it at most one to 20 px of radius, and none wider than the disc. Measured on a phone at 49 px (the names were five, laid across it) and 61 px.
for (const target of [49, 61, 90]) {
  test(`the Moon at ${target} px of radius: no name below 70 px, otherwise within the cap and the disc`, async ({ page }) => {
    await page.goto("/wakusei-planets/?body=moon&look=painted");
    const main = page.locator("#main");
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 120_000 });
    await page.locator("#controls").evaluate((el) => (el as unknown as { pause(): void }).pause());
    // the zoom that makes the disc `target` px, set and read in the same call
    const radius = await page.locator("#controls").evaluate((el, want) => {
      const host = document.getElementById("main") as unknown as { discRadius: number };
      const zoom = want / host.discRadius;
      (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ zoom }, true, "set");
      return host.discRadius * zoom;
    }, target);
    expect(radius).toBeGreaterThan(target * 0.8);
    // what is written is read in one call, and waited for until it has been the same for several reads in a row (names arrive after the data does)
    const written = () => main.evaluate(async (el) => {
      const read = () => [...(el.shadowRoot?.querySelectorAll("[data-name]") ?? [])].map((n) => { const b = n.getBoundingClientRect(); return { w: b.width, op: Number((n as HTMLElement).style.opacity || "1") }; }).filter((n) => n.op >= 0.2);
      const first = read();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const second = read();
      return { stable: first.length === second.length, names: second, r: (el as unknown as { discRadius: number }).discRadius * Number((Reflect.get(document.getElementById("controls")!, "state") as { zoom: number }).zoom) };
    });
    let steady = 0;
    await expect.poll(async () => {
      const now = await written();
      steady = now.stable ? steady + 1 : 0;
      return steady;
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(4);
    const now = await written();
    expect(now.names.length, `names at ${Math.round(now.r)} px`).toBeLessThanOrEqual(Math.floor(now.r / 20));
    if (now.r < 70) expect(now.names.length, "none below 70 px").toBe(0);
    for (const one of now.names) expect(one.w, "no name wider than the disc").toBeLessThanOrEqual(now.r * 2);
  });
}
