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
