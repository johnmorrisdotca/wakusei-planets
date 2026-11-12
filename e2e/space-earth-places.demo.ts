// The reader's place and favourite places on the space view's Earth (`earth-places`, `earthPlaces`, `earth-places-look`): drawn where the Earth's own ground is (the place the camera looks down on is in the middle),
// hidden on the far side and when the Earth is small, never over a body's name, written both ways between the attribute and the property, and the three looks. Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, crossing, goTo, nameBoxes, openSpace, SPACE, settle } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Marks = { marks: { id: string; kind: string; x: number; y: number; named: boolean }[]; omitted: number };
const shown = (page: Page): Promise<Marks> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlacesShown") as Marks);
const ids = async (page: Page): Promise<string[]> => (await shown(page)).marks.map((m) => m.id).sort();
const HERE = { id: "me", lon: 10, lat: 20, label: "You are here", kind: "here" };
const TOKYO = { id: "tokyo", lon: 139.69, lat: 35.69, label: "Tokyo" };
const LIMA = { id: "lima", lon: -77.04, lat: -12.05, label: "Lima", kind: "favourite" };
const centreOn = (page: Page, centre: string): Promise<unknown> => callOn(page, "setAttribute", "center", centre);
/** The drawn parts of a marker, as the page's CSS shows them: the stick, the head and the ring. */
const parts = (page: Page, index = 0): Promise<{ stick: boolean; head: boolean; ring: boolean; name: string; opacity: number }> =>
  page.locator(SPACE).evaluate((el, i) => {
    const g = el.shadowRoot!.querySelectorAll<SVGGElement>(".wk-eplace")[i]!;
    const visible = (node: Element): boolean => (node as SVGElement).style.display !== "none";
    const name = el.shadowRoot!.querySelectorAll<HTMLElement>(".wk-eplace-name:not([hidden])")[0];
    return { stick: visible(g.querySelector("line")!), head: visible(g.querySelector("circle")!), ring: visible(g.querySelector("ellipse")!), name: name?.textContent ?? "", opacity: Number(g.getAttribute("opacity")) };
  }, index);

test("the attribute draws the places where the Earth's ground is: the place under the camera is in the middle, the far side is left out", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([HERE, TOKYO, LIMA]));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(0);
  await settle(page);
  const box = (await page.locator(SPACE).boundingBox())!;
  const marks = (await shown(page)).marks;
  const me = marks.find((m) => m.id === "me")!;
  expect(me, "the place under the camera is drawn").toBeDefined();
  expect(me.kind).toBe("here");
  expect(Math.hypot(me.x - box.width / 2, me.y - box.height / 2)).toBeLessThan(4);
  expect(me.named).toBe(true);
  // Tokyo is 130 degrees of longitude away from the middle: the far side, and not drawn
  expect(marks.some((m) => m.id === "tokyo")).toBe(false);

  // turn the camera over Tokyo: it comes to the middle and Lima, now on the far side, goes
  await centreOn(page, "139.69,35.69");
  await expect.poll(async () => (await ids(page)).includes("tokyo"), { timeout: 60_000 }).toBe(true);
  await settle(page);
  const next = (await shown(page)).marks;
  const tokyo = next.find((m) => m.id === "tokyo")!;
  expect(Math.hypot(tokyo.x - box.width / 2, tokyo.y - box.height / 2)).toBeLessThan(4);
  expect(next.some((m) => m.id === "lima")).toBe(false);
  expect(next.some((m) => m.id === "me")).toBe(false);
});

test("the property and the attribute are the same list, an empty list takes the attribute away, and the places go with it", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  await page.locator(SPACE).evaluate((el, list) => Reflect.set(el, "earthPlaces", list), [HERE, LIMA]);
  expect(JSON.parse((await page.locator(SPACE).getAttribute("earth-places"))!)).toEqual([HERE, LIMA]);
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(0);
  const read = await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlaces") as { id: string; kind: string }[]);
  expect(read.map((p) => `${p.id}:${p.kind}`)).toEqual(["me:here", "lima:favourite"]);
  // a place out of range or without a longitude is left out, the same list chikyu-earth reads
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([HERE, { id: "bad", lon: 500, lat: 0 }, { id: "worse", lat: 3 }]));
  expect((await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlaces") as { id: string }[])).map((p) => p.id)).toEqual(["me"]);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "earthPlaces", []));
  await expect(page.locator(SPACE)).not.toHaveAttribute("earth-places", /.*/);
  await expect.poll(async () => (await shown(page)).marks.length).toBe(0);
  expect(await page.locator(SPACE).evaluate((el) => el.shadowRoot!.querySelector(".wk-eplaces"))).toBeNull();
});

test("the looks: a beam and a pin stand out of the ground, a ring lies on it, and anything else is a beam", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([HERE, { id: "side", lon: 50, lat: 20, label: "Side" }]));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(2);
  // the default
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlacesLook"))).toBe("beam");
  expect(await parts(page)).toMatchObject({ stick: true, head: false, ring: true });
  await callOn(page, "setAttribute", "earth-places-look", "pin");
  await expect.poll(async () => (await parts(page)).head).toBe(true);
  expect(await parts(page)).toMatchObject({ stick: true, head: true, ring: true });
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "earthPlacesLook", "ring"));
  await expect(page.locator(SPACE)).toHaveAttribute("earth-places-look", "ring");
  await expect.poll(async () => (await parts(page)).stick).toBe(false);
  expect(await parts(page)).toMatchObject({ stick: false, head: false, ring: true });
  // names go beside the ring when there is no stick: the same two places, both named
  expect((await shown(page)).marks.every((m) => m.named)).toBe(true);
  await callOn(page, "setAttribute", "earth-places-look", "star");
  await expect.poll(async () => (await parts(page)).stick).toBe(true);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlacesLook"))).toBe("beam");
  // a place nearer the edge is dimmer than the one in the middle
  const first = (await parts(page, 0)).opacity;
  const second = (await parts(page, 1)).opacity;
  expect(first).toBeGreaterThan(0.9);
  expect(second).toBeGreaterThan(0.1);
});

test("a place's name never crosses a body's name, and nothing is laid on an Earth too small to carry a marker", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([HERE, { id: "a", lon: 20, lat: 25, label: "Alpha place" }, { id: "b", lon: 15, lat: 10, label: "Bravo place" }, { id: "c", lon: 0, lat: 30, label: "Charlie place" }]));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBeGreaterThan(2);
  await settle(page);
  const names = async () =>
    page.locator(SPACE).evaluate((el) =>
      [...el.shadowRoot!.querySelectorAll<HTMLElement>(".wk-eplace-name:not([hidden])")].filter((n) => n.textContent !== "").map((n) => {
        const r = n.getBoundingClientRect();
        return { id: `place ${n.textContent}`, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      }),
    );
  const placeNames = await names();
  expect(placeNames.length).toBeGreaterThan(1);
  expect(crossing([...placeNames, ...(await nameBoxes(page))])).toEqual([]);

  // the whole solar system: the Earth is a speck, and no marker is laid on it
  await goTo(page, "Whole solar system");
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 30_000 }).toBe(0);
  await goTo(page, "Earth");
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 30_000 }).toBeGreaterThan(0);
});

test("more places in sight than the Earth carries markers for: the first 32 stand up and the rest are counted, never lost silently", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `p${i}`, lon: (i % 10) * 4 - 18, lat: Math.floor(i / 10) * 4 - 10, kind: "favourite" }));
  await centreOn(page, "0,0");
  await callOn(page, "setAttribute", "earth-places", JSON.stringify(many));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(32);
  expect((await shown(page)).omitted).toBe(28);
});
