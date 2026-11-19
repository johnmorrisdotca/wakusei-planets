// A press on a drawn name picks its body (MODULES-1510). The view's hover finds a body within 14 pixels of its place or else inside a name's box, and the press used to look at the 14 pixels only: a press on
// the name of Oberon, 30 pixels from its dot, did nothing. Now the press asks the hover's own hit test. Chromium, drawing in software, on a desk and on a phone (a touch).
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, quiet, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(!["chromium-desk", "chromium-phone"].includes(testInfo.project.name), "3D in software, Chromium only");
});

type Place = { x: number; y: number; r: number };
const MOONS = ["miranda", "ariel", "umbriel", "titania", "oberon"];
const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);

/** Uranus with its moons in view, held at one moment, drawn and still. */
async function uranus(page: Page): Promise<void> {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  const zoom = await page.locator(SPACE).evaluate((el) => (el as unknown as { zoomFor(p: string): number }).zoomFor("uranus-moons"));
  await callOn(page, "goTo", "uranus", { smooth: false, zoom });
  await page.locator("kazoku-view-controls").evaluate((el, z) => (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ zoom: z }, true, "jump"), zoom);
  await expect.poll(async () => (await statsOf(page)).bodies.moons, { timeout: 60_000, message: "Uranus's moons are drawn" }).toBeGreaterThanOrEqual(3);
  await quiet(page);
}

/** The moons whose names are shown, with each name's box in the element's own pixels and the nearest other place (a press there would be taken by that disc, not by the name). */
async function names(page: Page): Promise<{ id: string; left: number; right: number; top: number; bottom: number; place: Place; clear: number }[]> {
  const boxes = await page.locator(SPACE).evaluate((el) => {
    const host = el.getBoundingClientRect();
    return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label[data-body]:not([hidden])"))
      .map((label) => ({ id: label.dataset["body"]!, rect: label.getBoundingClientRect(), carried: label.hasAttribute("data-carried") }))
      // a name with something else of the page over the point to press (the demo's own controls) cannot be pressed
      .filter((one) => one.rect.width > 0 && !one.carried && document.elementFromPoint(one.rect.right - 4, (one.rect.top + one.rect.bottom) / 2) === el)
      .map((one) => ({ id: one.id, left: one.rect.left - host.left, right: one.rect.right - host.left, top: one.rect.top - host.top, bottom: one.rect.bottom - host.top }));
  });
  const out = [];
  for (const box of boxes) {
    const place = await placeOf(page, box.id);
    if (!place) continue;
    let clear = Infinity;
    for (const other of boxes) {
      if (other.id === box.id) continue;
      const at = await placeOf(page, other.id);
      if (at) clear = Math.min(clear, Math.hypot((box.right - 4) - at.x, (box.top + box.bottom) / 2 - at.y) - Math.max(at.r, 14));
    }
    out.push({ ...box, place, clear });
  }
  return out;
}

async function tap(page: Page, x: number, y: number): Promise<void> {
  const box = (await page.locator(SPACE).boundingBox())!;
  if (test.info().project.name === "chromium-phone") await page.touchscreen.tap(box.x + x, box.y + y);
  else {
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.down();
    await page.mouse.up();
  }
  await page.waitForTimeout(400);
}

const heard = (page: Page): Promise<string[]> => page.evaluate(() => Reflect.get(window, "__clicks") as string[]);
const listen = (page: Page) =>
  page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__clicks", []);
    el.addEventListener("wakusei-body-click", (event) => (Reflect.get(window, "__clicks") as string[]).push((event as CustomEvent).detail.id));
  });

test("a press on a moon's name, away from its dot, picks that moon; a press on empty sky beside it picks nothing", async ({ page }) => {
  test.setTimeout(240_000);
  await uranus(page);
  await listen(page);
  const shown = (await names(page)).filter((one) => MOONS.includes(one.id) && Math.hypot(one.right - 4 - one.place.x, (one.top + one.bottom) / 2 - one.place.y) > Math.max(one.place.r, 14) + 6 && one.clear > 4);
  expect(shown.length, `moons whose names can be pressed apart from any dot: ${shown.map((one) => one.id)}`).toBeGreaterThanOrEqual(2);
  for (const one of shown) {
    await tap(page, one.right - 4, (one.top + one.bottom) / 2);
    expect(await heard(page), `a press on the name of ${one.id}: ${JSON.stringify(one)}`).toContain(one.id);
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "selected")), `${one.id} is selected`).toBe(one.id);
  }
  // above or below a name, clear of every disc and with no orbit line within a finger's reach (proved by moving the pointer over every point of a square round it and seeing no body hovered and no line lit): the empty sky
  const first = shown[0]!;
  const sky = await page.locator(SPACE).evaluate(
    (el, [x, y]) => {
      const box = el.getBoundingClientRect();
      let hovered = 0;
      el.addEventListener("wakusei-body-hover", () => (hovered += 1));
      const bare = (cx: number, cy: number): boolean => {
        hovered = 0;
        for (let dy = -20; dy <= 20; dy += 4) {
          for (let dx = -20; dx <= 20; dx += 4) {
            el.dispatchEvent(new PointerEvent("pointermove", { clientX: box.left + cx + dx, clientY: box.top + cy + dy, pointerType: "mouse", buttons: 0, bubbles: true, composed: true }));
            if (hovered > 0 || !el.shadowRoot!.querySelector(".sp-line")!.hasAttribute("hidden")) return false;
          }
        }
        return true;
      };
      const found = [-40, -60, -80, 40, 60, 80].map((up) => ({ x: x!, y: y! + up })).find((p) => p.y > 24 && p.y < box.height - 24 && bare(p.x, p.y));
      el.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse", bubbles: false, composed: true }));
      return found ?? null;
    },
    [first.right - 4, first.top] as const,
  );
  expect(sky, "a place beside the name with no body, name or orbit line near").not.toBeNull();
  await page.locator(SPACE).evaluate(() => Reflect.set(window, "__clicks", []));
  await tap(page, sky!.x, sky!.y);
  expect(await heard(page), "a press on the sky beside a name picks nothing").toEqual([]);
});

test("a press on a body's dot still picks it, with the names off as with them on", async ({ page }) => {
  test.setTimeout(240_000);
  await uranus(page);
  await listen(page);
  const dot = (await placeOf(page, "uranus"))!;
  await tap(page, dot.x, dot.y);
  expect(await heard(page)).toContain("uranus");
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "labels", false));
  await quiet(page);
  await page.locator(SPACE).evaluate(() => Reflect.set(window, "__clicks", []));
  const again = (await placeOf(page, "uranus"))!;
  await tap(page, again.x, again.y);
  expect(await heard(page), "the names off: a press on the disc still picks it").toContain("uranus");
});
