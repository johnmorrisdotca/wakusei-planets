// Hovering an orbiter's mark or name, or focusing its name, is told to the page as a spacecraft and throws nothing: an orbiter's id was once sent down the planet path, to `bodyInfo`, which has no such body and threw a TypeError. Chromium, drawing in software.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { callOn, drawnAtRest, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Told = { type: string; id: string; kind: string };
const told = (page: Page): Promise<Told[]> => page.evaluate(() => Reflect.get(window, "__told") as Told[]);

test("hovering an orbiter's mark and focusing its name say spacecraft and the orbiter's id, and throw nothing", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSpace(page, "t=2026-11-02T14:00Z&play=off");
  await drawnAtRest(page, () => callOn(page, "goTo", "moon", { smooth: false }));
  await page.locator("#orbiters").dispatchEvent("click");
  await expect.poll(async () => ((await statsOf(page)) as unknown as { orbiters: { count: number; status: Record<string, string> } }).orbiters.count, { timeout: 60_000 }).toBeGreaterThan(0);
  const id = Object.keys(((await statsOf(page)) as unknown as { orbiters: { status: Record<string, string> } }).orbiters.status)[0]!;
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__told", []);
    for (const type of ["wakusei-body-hover", "wakusei-body-focus"]) {
      el.addEventListener(type, (e) => (Reflect.get(window, "__told") as Told[]).push({ type, id: (e as CustomEvent<{ id: string; kind: string }>).detail.id, kind: (e as CustomEvent<{ id: string; kind: string }>).detail.kind }));
    }
  });
  // the mark: the pointer moves onto the dot of the orbiter
  const at = (await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): { x: number; y: number } | null }).placeOf(body), id))!;
  expect(at, `${id} is on the picture`).not.toBeNull();
  const box = (await page.locator(SPACE).boundingBox())!;
  await page.mouse.move(box.x + 3, box.y + box.height - 3);
  await page.mouse.move(box.x + at.x, box.y + at.y, { steps: 4 });
  expect(await told(page), "hovering the mark").toContainEqual({ type: "wakusei-body-hover", id, kind: "spacecraft" });
  await page.mouse.move(box.x + 3, box.y + box.height - 3, { steps: 4 });
  // the name: focus on it goes through the same hover
  await page.evaluate(() => Reflect.set(window, "__told", []));
  await page.locator(SPACE).evaluate((el, body) => {
    const label = el.shadowRoot!.querySelector<HTMLElement>(`.sp-label[data-body="${body}"]`)!;
    label.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true }));
  }, id);
  const after = await told(page);
  expect(after, "focusing the name").toContainEqual({ type: "wakusei-body-focus", id, kind: "spacecraft" });
  expect(after, "and its hover").toContainEqual({ type: "wakusei-body-hover", id, kind: "spacecraft" });
  expect(errors, "no page error").toEqual([]);
});
