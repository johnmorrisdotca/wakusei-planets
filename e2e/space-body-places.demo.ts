// The places on the Moon and the other bodies in the space view (`body-places`, `bodyPlaces`, `bodyPlacesShown`), drawn as the Earth's are (`earth-places`): on the ground of the body the camera looks at, hidden on the far side and when the body is small, written both
// ways between the attribute and the property, the look attribute shared with the Earth's, and the press: a still tap on a drawn name or a foot ring is `wakusei-body-place` (the Earth's places too), and the body under the tap is not pressed as well. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, goTo, openSpace, quiet, SPACE, settle } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Marks = { marks: { body: string; id: string; kind: string; x: number; y: number; named: boolean }[]; omitted: number };
const shown = (page: Page): Promise<Marks> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyPlacesShown") as Marks);
/** The view over the Moon, close: the Moon's own radius on the screen is what says the move is done. */
async function onMoon(page: Page): Promise<void> {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=moon");
  await callOn(page, "goTo", "moon");
  await expect.poll(() => page.locator(SPACE).evaluate((el) => (el as unknown as { placeOf(id: string): { r: number } | null }).placeOf("moon")?.r ?? 0), { timeout: 60_000 }).toBeGreaterThan(80);
  await quiet(page);
}
// places all round the Moon's equator and two parallels, so some are on the side the camera sees whichever way it looks
const ring = Array.from({ length: 24 }, (_, i) => ({ body: "moon", id: `moon/p${i}`, lon: i * 15 - 180, lat: (i % 3) * 20 - 20, label: `Place ${i}`, kind: i === 0 ? "here" : "favourite" }));
const listen = (page: Page): Promise<void> =>
  page.locator(SPACE).evaluate((el) => {
    const heard: unknown[] = [];
    (window as unknown as { beams: unknown[] }).beams = heard;
    el.addEventListener("wakusei-body-place", (event) => heard.push((event as CustomEvent).detail));
  });
const beams = (page: Page): Promise<{ body: string; id: string; kind: string; x: number; y: number }[]> => page.evaluate(() => (window as unknown as { beams: { body: string; id: string; kind: string; x: number; y: number }[] }).beams);
/** The middle of each drawn name, in page coordinates. */
const nameSpots = (page: Page): Promise<{ text: string; x: number; y: number }[]> =>
  page.locator(SPACE).evaluate((el) =>
    [...el.shadowRoot!.querySelectorAll<HTMLElement>(".wk-eplace-name:not([hidden])")].filter((n) => n.textContent !== "").map((n) => {
      const r = n.getBoundingClientRect();
      return { text: n.textContent ?? "", x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
    }),
  );

test("the attribute draws the places on the Moon the camera looks at: the near side stands, the far side does not, every mark says its body", async ({ page }) => {
  await onMoon(page);
  await callOn(page, "setAttribute", "body-places", JSON.stringify(ring));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(0);
  await settle(page);
  const marks = (await shown(page)).marks;
  expect(marks.length).toBeLessThan(ring.length);
  expect(marks.every((m) => m.body === "moon" && m.id.startsWith("moon/p"))).toBe(true);
  expect(marks.some((m) => m.named)).toBe(true);
  const box = (await page.locator(SPACE).boundingBox())!;
  expect(marks.every((m) => m.x > 0 && m.x < box.width && m.y > 0 && m.y < box.height)).toBe(true);
  // the Earth's own layer is not used: a place for the Earth in this list is not drawn
  await callOn(page, "setAttribute", "body-places", JSON.stringify([{ body: "earth", id: "e", lon: 0, lat: 0 }, ...ring]));
  await settle(page);
  expect((await shown(page)).marks.some((m) => m.id === "e")).toBe(false);
  // the whole solar system: the Moon is a speck and carries none
  await goTo(page, "Whole solar system");
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 30_000 }).toBe(0);
});

test("the property and the attribute are the same list, a place of another body waits until that body is looked at, and an empty list takes the layer away", async ({ page }) => {
  await onMoon(page);
  const mixed = [...ring.slice(0, 12), { body: "mars", id: "mars/olympus-mons", lon: -133.8, lat: 18.7, label: "Olympus Mons" }, { body: "moon", id: "bad", lon: 500, lat: 0 }];
  await page.locator(SPACE).evaluate((el, list) => Reflect.set(el, "bodyPlaces", list), mixed);
  const read = await page.locator(SPACE).evaluate((el) => Reflect.get(el, "bodyPlaces") as { body: string; id: string }[]);
  expect(read.some((p) => p.id === "bad")).toBe(false);
  expect(read.some((p) => p.body === "mars")).toBe(true);
  expect(JSON.parse((await page.locator(SPACE).getAttribute("body-places"))!)).toEqual(mixed);
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(0);
  expect((await shown(page)).marks.every((m) => m.body === "moon")).toBe(true);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "bodyPlaces", []));
  await expect(page.locator(SPACE)).not.toHaveAttribute("body-places", /.*/);
  await expect.poll(async () => (await shown(page)).marks.length).toBe(0);
});

test("the look attribute of the Earth's places is the look of these too", async ({ page }) => {
  await onMoon(page);
  await callOn(page, "setAttribute", "body-places", JSON.stringify(ring));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(0);
  const sticks = (): Promise<boolean> => page.locator(SPACE).evaluate((el) => [...el.shadowRoot!.querySelectorAll<SVGGElement>(".wk-eplace")].filter((g) => g.style.display !== "none").some((g) => (g.querySelector("line") as SVGElement).style.display !== "none"));
  expect(await sticks()).toBe(true);
  await callOn(page, "setAttribute", "earth-places-look", "ring");
  await expect.poll(sticks).toBe(false);
  await callOn(page, "setAttribute", "earth-places-look", "beam");
  await expect.poll(sticks).toBe(true);
});

test("more places in sight than there are markers: the first 32 stand up and the rest are counted", async ({ page }) => {
  await onMoon(page);
  // all round the Moon, so about half of them are on the side the camera sees
  const many = Array.from({ length: 140 }, (_, i) => ({ body: "moon", id: `moon/n${i}`, lon: (i % 20) * 18 - 180, lat: Math.floor(i / 20) * 20 - 60, kind: "favourite" }));
  await callOn(page, "setAttribute", "body-places", JSON.stringify(many));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(32);
  expect((await shown(page)).omitted).toBeGreaterThan(0);
});

test("a still tap on a drawn name is wakusei-body-place with the body, id, kind and foot; a tap on bare ground is not, and the Earth's places press the same", async ({ page }) => {
  await onMoon(page);
  await listen(page);
  await callOn(page, "setAttribute", "body-places", JSON.stringify(ring));
  await expect.poll(async () => (await nameSpots(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
  await settle(page);
  const spot = (await nameSpots(page))[0]!;
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(async () => (await beams(page)).length, { timeout: 10_000 }).toBe(1);
  const [one] = await beams(page);
  expect(one).toMatchObject({ body: "moon" });
  expect(one!.id).toMatch(/^moon\/p\d+$/);
  expect(["here", "favourite"]).toContain(one!.kind);
  const mark = (await shown(page)).marks.find((m) => m.id === one!.id)!;
  expect([one!.x, one!.y]).toEqual([mark.x, mark.y]);
  // a drag that starts on a name is not a press
  await page.mouse.move(spot.x, spot.y);
  await page.mouse.down();
  await page.mouse.move(spot.x + 40, spot.y + 10, { steps: 4 });
  await page.mouse.up();
  await settle(page, 300);
  expect((await beams(page)).length).toBe(1);

  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await listen(page);
  await callOn(page, "setAttribute", "center", "10,20");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([{ id: "me", lon: 10, lat: 20, label: "You are here", kind: "here" }]));
  await expect.poll(async () => (await nameSpots(page)).length, { timeout: 60_000 }).toBeGreaterThan(0);
  await settle(page);
  const here = (await nameSpots(page))[0]!;
  await page.mouse.click(here.x, here.y);
  await expect.poll(async () => (await beams(page)).length, { timeout: 10_000 }).toBe(1);
  expect((await beams(page))[0]).toMatchObject({ body: "earth", id: "me", kind: "here" });
});
