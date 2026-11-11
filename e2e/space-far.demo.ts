// Far names and the system under the pointer. The names of bodies outside the system in the middle are drawn at the far strength; a body under the mouse, a finger or the
// keyboard's focus lights its own system and says so. None of it draws the picture again. Chromium, drawing in software; every wait
// is on what the page reports.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { drawn, NOV2, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });

interface Place {
  x: number;
  y: number;
  r: number;
}

const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
const hovered = (page: Page): Promise<string | null> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "hovered") as string | null);
/** The names drawn far, and those drawn at full strength, among the names shown now. */
const strengths = (page: Page): Promise<{ far: string[]; near: string[]; opacity: Record<string, string> }> =>
  page.locator(SPACE).evaluate((el) => {
    const shown = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".sp-label:not([hidden]):not([data-carried])")];
    return {
      far: shown.filter((n) => n.hasAttribute("data-far")).map((n) => n.dataset["body"]!),
      near: shown.filter((n) => !n.hasAttribute("data-far")).map((n) => n.dataset["body"]!),
      opacity: Object.fromEntries(shown.map((n) => [n.dataset["body"]!, getComputedStyle(n).opacity])),
    };
  });
/** Whether a body's name is marked far, shown or not (a name the no-overlap rule leaves out keeps its mark). */
const isFar = (page: Page, id: string): Promise<boolean> => page.locator(SPACE).evaluate((el, body) => el.shadowRoot!.querySelector(`.sp-label[data-body="${body}"]`)?.hasAttribute("data-far") ?? false, id);
/** A point of the page on the view and in the window, with no body within 40 pixels: empty sky. */
async function emptySky(page: Page): Promise<{ x: number; y: number }> {
  const box = (await page.locator(SPACE).boundingBox())!;
  const height = Math.min(box.height, page.viewportSize()!.height - box.y);
  const places = await page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): Place | null; bodyList(): { id: string }[] };
    return space.bodyList().map(({ id }) => space.placeOf(id)).filter((at): at is Place => at !== null);
  });
  for (let y = height - 30; y > 60; y -= 20) for (let x = 30; x < box.width - 30; x += 20) if (places.every((at) => Math.hypot(at.x - x, at.y - y) > 40 + at.r)) return { x: box.x + x, y: box.y + y };
  throw new Error("no empty sky in the view");
}
/** Every event of these names the element has sent since the page began listening, in order. */
async function listen(page: Page, names: string[]): Promise<void> {
  await page.locator(SPACE).evaluate((el, list) => {
    const heard: { type: string; detail: unknown }[] = [];
    Reflect.set(window, "__heard", heard);
    for (const name of list) el.addEventListener(name, (event) => heard.push({ type: name, detail: (event as CustomEvent).detail }));
  }, names);
}
const heard = (page: Page): Promise<{ type: string; detail: Record<string, unknown> }[]> => page.evaluate(() => Reflect.get(window, "__heard") as { type: string; detail: Record<string, unknown> }[]);
/** A point of the page over a body's place in the view. */
async function over(page: Page, id: string): Promise<{ x: number; y: number }> {
  const place = await placeOf(page, id);
  expect(place, `${id} is placed`).not.toBeNull();
  const box = (await page.locator(SPACE).boundingBox())!;
  return { x: box.x + place!.x, y: box.y + place!.y };
}
/** A planet on the picture with no other body within 24 pixels of it, so a point on it can only be it. */
async function lonePlanet(page: Page, not: string[]): Promise<string> {
  const all = await page.locator(SPACE).evaluate((el) => {
    const space = el as unknown as { placeOf(id: string): Place | null; bodyList(): { id: string; kind: string }[] };
    return space.bodyList().map(({ id, kind }) => ({ id, kind, at: space.placeOf(id) })).filter((one): one is { id: string; kind: string; at: Place } => one.at !== null);
  });
  const box = (await page.locator(SPACE).boundingBox())!;
  for (const one of all) {
    if (one.kind !== "planet" || not.includes(one.id)) continue;
    if (one.at.x < 20 || one.at.y < 60 || one.at.x > box.width - 20 || one.at.y > box.height - 40) continue;
    if (all.every((other) => other.id === one.id || Math.hypot(other.at.x - one.at.x, other.at.y - one.at.y) > 24)) return one.id;
  }
  throw new Error(`no planet stands alone in the view: ${all.map((one) => `${one.id} ${Math.round(one.at.x)},${Math.round(one.at.y)}`).join("; ")}`);
}
/** Open the space page and take the camera out to the whole solar system, where the planets are named. */
async function fromAfar(page: Page): Promise<void> {
  await openSpace(page, `t=${NOV2}`);
  await drawn(page, () => page.locator(SPACE).evaluate((el) => (el as unknown as { setView(v: unknown): void; zoomFor(p: string): number }).setView({ yaw: 0, tilt: 0, zoom: (el as unknown as { zoomFor(p: string): number }).zoomFor("solar-system") })));
}

test("far names are drawn at half strength and the system in the middle at full; the mouse and the focus light a body's own system, tell the page, and draw nothing", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only; the phone's touch has its own test");
  test.setTimeout(180_000);
  await fromAfar(page);
  // from the whole solar system the planets are named; the Earth is in the middle, so its system is lit and the rest is far
  await expect.poll(async () => (await strengths(page)).far.length, { timeout: 30_000 }).toBeGreaterThan(2);
  const at = await strengths(page);
  expect(at.far).not.toContain("earth");
  expect(at.far).not.toContain("moon");
  const farOne = at.far[0]!;
  await expect.poll(async () => (await strengths(page)).opacity[farOne], { timeout: 10_000 }).toBe("0.5");

  await listen(page, ["wakusei-body-hover", "wakusei-body-hover-end"]);
  const draws = (await readCounts(page)).draws;
  const planet = await lonePlanet(page, ["earth"]);
  const point = await over(page, planet);
  await page.mouse.move(point.x, point.y);
  await expect.poll(() => hovered(page)).toBe(planet);
  // the planet's system is lit now, and the Earth is far
  await expect.poll(() => isFar(page, planet)).toBe(false);
  expect(await isFar(page, "earth")).toBe(true);
  const hover = (await heard(page)).find((one) => one.type === "wakusei-body-hover")!;
  expect(hover.detail["id"]).toBe(planet);
  expect(hover.detail["name"]).toBeTruthy();
  expect((hover.detail["system"] as { host: string }).host).toBe(planet);

  // off every body: the hover ends and the Earth's system is lit again
  const sky = await emptySky(page);
  await page.mouse.move(sky.x, sky.y);
  await expect.poll(() => hovered(page)).toBeNull();
  await expect.poll(async () => (await heard(page)).at(-1)?.type).toBe("wakusei-body-hover-end");
  expect((await heard(page)).at(-1)?.detail["id"]).toBe(planet);
  await expect.poll(() => isFar(page, planet)).toBe(true);
  expect(await isFar(page, "earth")).toBe(false);

  // the keyboard: a name reached with Tab lights its system the same way, and leaving it ends the hover
  await page.locator(SPACE).evaluate((el, id) => el.shadowRoot!.querySelector<HTMLElement>(`.sp-label[data-body="${id}"]`)?.focus(), farOne);
  await expect.poll(() => hovered(page)).toBe(farOne);
  await expect.poll(() => isFar(page, farOne)).toBe(false);
  await page.locator(SPACE).evaluate((el) => (el.shadowRoot!.activeElement as HTMLElement | null)?.blur());
  await expect.poll(() => hovered(page)).toBeNull();

  // none of it drew the picture again
  expect((await readCounts(page)).draws).toBe(draws);

  // the strength is the page's to set
  await page.locator(SPACE).evaluate((el) => el.setAttribute("far-opacity", "1"));
  await expect.poll(async () => (await strengths(page)).opacity[farOne], { timeout: 10_000 }).toBe("1");
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "farOpacity"))).toBe(1);
  await page.locator(SPACE).evaluate((el) => el.setAttribute("far-opacity", "0.25"));
  await expect.poll(async () => (await strengths(page)).opacity[farOne], { timeout: 10_000 }).toBe("0.25");
});

test("a finger on a body lights its system and tells the page; a finger on empty sky ends it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-phone", "touch, on the phone");
  test.setTimeout(180_000);
  await fromAfar(page);
  await expect.poll(async () => (await strengths(page)).far.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await listen(page, ["wakusei-body-hover", "wakusei-body-hover-end"]);
  const planet = await lonePlanet(page, ["earth"]);
  const point = await over(page, planet);
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(() => hovered(page)).toBe(planet);
  expect((await heard(page)).find((one) => one.type === "wakusei-body-hover")?.detail["id"]).toBe(planet);
  await expect.poll(() => isFar(page, planet)).toBe(false);
  const sky = await emptySky(page);
  await page.touchscreen.tap(sky.x, sky.y);
  await expect.poll(() => hovered(page)).toBeNull();
  expect((await heard(page)).at(-1)?.type).toBe("wakusei-body-hover-end");
});

