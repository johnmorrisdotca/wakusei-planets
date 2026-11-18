// The reader's place and favourite places on the space view's Earth (`earth-places`, `earthPlaces`, `earth-places-look`): drawn where the Earth's own ground is (the place the camera looks down on is in the middle),
// hidden on the far side and when the Earth is small, never over a body's name, written both ways between the attribute and the property, and the three looks. Chromium, drawing in software.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { callOn, crossing, goTo, nameBoxes, openSpace, SPACE, settle } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

type Marks = { marks: { id: string; kind: string; x: number; y: number; named: boolean }[]; omitted: number; hidden: number };
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

const listenClicks = (page: Page): Promise<void> =>
  page.locator(SPACE).evaluate((el) => {
    const heard: unknown[] = [];
    (window as unknown as { clicks: unknown[] }).clicks = heard;
    el.addEventListener("wakusei-place-click", (event) => heard.push((event as CustomEvent).detail));
  });
const clicks = (page: Page): Promise<Record<string, unknown>[]> => page.evaluate(() => (window as unknown as { clicks: Record<string, unknown>[] }).clicks);
const nameSpot = (page: Page, text: string): Promise<{ x: number; y: number }> =>
  page.locator(SPACE).evaluate((el, t) => {
    const r = [...el.shadowRoot!.querySelectorAll<HTMLElement>(".wk-eplace-name:not([hidden])")].find((n) => n.textContent === t)!.getBoundingClientRect();
    return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
  }, text);

test("a layer that is off is not drawn, not named and not pressable; the other layers and places with no layer stay, and the property reads and writes the attribute", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await listenClicks(page);
  await centreOn(page, "10,20");
  const list = [HERE, { id: "port", lon: 12, lat: 22, label: "Port", layer: "harbours" }, { id: "field", lon: 8, lat: 18, label: "Field", layer: "airports" }];
  await callOn(page, "setAttribute", "earth-places", JSON.stringify(list));
  await expect.poll(async () => (await ids(page)).length, { timeout: 60_000 }).toBe(3);
  expect(await shown(page)).toMatchObject({ hidden: 0 });
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "earthPlaceLayers", { harbours: false }));
  expect(JSON.parse((await page.locator(SPACE).getAttribute("earth-place-layers"))!)).toEqual({ harbours: false });
  await expect.poll(() => ids(page)).toEqual(["field", "me"]);
  expect(await shown(page)).toMatchObject({ hidden: 1, omitted: 0 });
  const named = await page.locator(SPACE).evaluate((el) => [...el.shadowRoot!.querySelectorAll<HTMLElement>(".wk-eplace-name:not([hidden])")].map((n) => n.textContent).sort());
  expect(named).toEqual(["Field", "You are here"]);
  // the list is still what was handed over
  expect(await page.locator(SPACE).evaluate((el) => (Reflect.get(el, "earthPlaces") as { id: string }[]).map((p) => p.id))).toEqual(["me", "port", "field"]);
  // one switch at a time, the others kept
  await callOn(page, "setEarthPlaceLayer", "airports", false);
  await expect.poll(() => ids(page)).toEqual(["me"]);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "earthPlaceLayers"))).toEqual({ harbours: false, airports: false });
  await callOn(page, "setEarthPlaceLayer", "harbours", true);
  await expect.poll(() => ids(page)).toEqual(["me", "port"]);
  // a press on the name of a place that is back is heard; an empty object takes the attribute away and everything is shown
  await settle(page);
  const port = await nameSpot(page, "Port");
  await page.mouse.click(port.x, port.y);
  await expect.poll(async () => (await clicks(page)).length, { timeout: 10_000 }).toBe(1);
  await page.locator(SPACE).evaluate((el) => Reflect.set(el, "earthPlaceLayers", {}));
  await expect(page.locator(SPACE)).not.toHaveAttribute("earth-place-layers", /.*/);
  await expect.poll(async () => (await ids(page)).length).toBe(3);
  // a text that is not a set of switches is no switches
  await callOn(page, "setAttribute", "earth-place-layers", "[1]");
  await settle(page, 300);
  expect((await ids(page)).length).toBe(3);
});

test("a small place has a shorter stick, a place with a look of its own wins over earth-places-look, and a low name gives its marker up last", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  const own = [{ id: "a", lon: 10, lat: 20, label: "Alpha" }, { id: "b", lon: 14, lat: 20, label: "Bravo", size: "small" }, { id: "c", lon: 10, lat: 25, label: "Charlie", look: "ring" }, { id: "d", lon: 6, lat: 20, label: "Delta", look: "pin" }];
  await callOn(page, "setAttribute", "earth-places", JSON.stringify(own));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(4);
  const drawn = (): Promise<Record<string, { stick: number; head: boolean; ring: number }>> =>
    page.locator(SPACE).evaluate((el) => {
      const out: Record<string, { stick: number; head: boolean; ring: number }> = {};
      const marks = (Reflect.get(el, "earthPlacesShown") as { marks: { id: string }[] }).marks;
      el.shadowRoot!.querySelectorAll<SVGGElement>(".wk-eplace").forEach((g, i) => {
        if (g.style.display === "none") return;
        const line = g.querySelector("line")!;
        out[marks[i]!.id] = { stick: line.style.display === "none" ? 0 : Math.hypot(Number(line.getAttribute("x2")), Number(line.getAttribute("y2"))), head: g.querySelector("circle")!.style.display !== "none", ring: Number(g.querySelector("ellipse")!.getAttribute("rx")) };
      });
      return out;
    });
  const now = await drawn();
  expect(now["a"]!.stick).toBeGreaterThan(10);
  expect(now["b"]!.stick, "small is a shorter stick").toBeLessThan(now["a"]!.stick * 0.8);
  expect(now["b"]!.ring, "and a smaller ring").toBeLessThan(now["a"]!.ring);
  expect(now["c"]!.stick, "a ring has no stick").toBe(0);
  expect(now["d"]!.head, "a pin has a head, over the list's beam").toBe(true);
  expect(now["a"]!.head).toBe(false);
  // the list's look is for the places that have none of their own
  await callOn(page, "setAttribute", "earth-places-look", "ring");
  await expect.poll(async () => (await drawn())["a"]!.stick).toBe(0);
  const flat = await drawn();
  expect(flat["d"]!.head, "its own look still wins").toBe(true);
  expect(flat["d"]!.stick).toBeGreaterThan(0);
  await callOn(page, "setAttribute", "earth-places-look", "beam");
  await expect.poll(async () => (await drawn())["a"]!.stick).toBeGreaterThan(10);
  // more places in sight than markers: the places whose name is low come last, so they are the ones counted in omitted
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, lon: (i % 8) * 4 - 14, lat: Math.floor(i / 8) * 4 - 6, namePriority: i < 10 ? "low" : "high" }));
  await callOn(page, "setAttribute", "earth-places", JSON.stringify(many));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(32);
  const kept = await ids(page);
  expect(many.filter((p) => p.namePriority === "high").every((p) => kept.includes(p.id))).toBe(true);
  expect(kept.filter((id) => many.find((p) => p.id === id)!.namePriority === "low").length).toBe(2);
});

test("a still tap on a place's name is wakusei-place-click with the place and where the press was, and wakusei-body-place still comes with it", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&goto=earth");
  await centreOn(page, "10,20");
  await listenClicks(page);
  await page.locator(SPACE).evaluate((el) => {
    const heard: unknown[] = [];
    (window as unknown as { beams: unknown[] }).beams = heard;
    el.addEventListener("wakusei-body-place", (event) => heard.push((event as CustomEvent).detail));
  });
  await callOn(page, "setAttribute", "earth-places", JSON.stringify([{ ...HERE, layer: "mine" }]));
  await expect.poll(async () => (await shown(page)).marks.length, { timeout: 60_000 }).toBe(1);
  await settle(page);
  const spot = await nameSpot(page, "You are here");
  await page.mouse.click(spot.x, spot.y);
  await expect.poll(async () => (await clicks(page)).length, { timeout: 10_000 }).toBe(1);
  const box = (await page.locator(SPACE).boundingBox())!;
  const [one] = await clicks(page);
  expect(one).toMatchObject({ body: "earth", id: "me", kind: "here", layer: "mine", label: "You are here", lon: 10, lat: 20 });
  expect(Math.abs((one!["x"] as number) - (spot.x - box.x))).toBeLessThan(1);
  expect(Math.abs((one!["y"] as number) - (spot.y - box.y))).toBeLessThan(1);
  expect(await page.evaluate(() => (window as unknown as { beams: unknown[] }).beams.length)).toBe(1);
  // bare ground is not a press on a place
  await page.mouse.click(box.x + 6, box.y + 6);
  await settle(page, 300);
  expect((await clicks(page)).length).toBe(1);
});
