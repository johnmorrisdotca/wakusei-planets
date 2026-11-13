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
