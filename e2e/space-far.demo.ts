// Far names and the system under the pointer, and where the bodies out of view are. The names of bodies outside the system in the middle are drawn at the far strength; a body under the mouse, a finger or the
// keyboard's focus lights its own system and says so; `sight()` and `wakusei-sight` give the edge each body out of view lies beyond. None of it draws the picture again. Chromium, drawing in software; every wait
// is on what the page reports.
import { readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test, type Page } from "@playwright/test";
import { callOn, drawn, NOV2, openSpace, SPACE } from "./space-ui.ts";

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
const isFar = (page: Page, id: string): Promise<boolean | null> => page.locator(SPACE).evaluate((el, body) => el.shadowRoot!.querySelector(`.sp-label[data-body="${body}"]`)?.hasAttribute("data-far") ?? null, id);
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
    const heard: { type: string; detail: unknown; at: number }[] = [];
    Reflect.set(window, "__heard", heard);
    for (const name of list) el.addEventListener(name, (event) => heard.push({ type: name, detail: (event as CustomEvent).detail, at: performance.now() }));
  }, names);
}
const heard = (page: Page): Promise<{ type: string; detail: Record<string, unknown>; at: number }[]> => page.evaluate(() => Reflect.get(window, "__heard") as { type: string; detail: Record<string, unknown>; at: number }[]);
/** Wait until the view stops drawing: two reads of the draws, 300 ms apart, the same. */
async function steady(page: Page): Promise<number> {
  let held = -1;
  await expect
    .poll(
      async () => {
        const now = (await readCounts(page)).draws;
        const same = now === held;
        held = now;
        return same;
      },
      { timeout: 30_000, intervals: [300] },
    )
    .toBe(true);
  return held;
}
/** One frame of the page. */
const frame = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => done())));
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

  // the Sun in the middle lights the Sun and the eight planets, not the moons or the dwarf planets; pointing at the Sun lights the Sun alone
  await drawn(page, () => callOn(page, "goTo", "sun", { smooth: false }));
  await expect.poll(() => isFar(page, "sun")).toBe(false);
  for (const id of ["mercury", "earth", "mars", "jupiter", "neptune"]) expect(await isFar(page, id), id).toBe(false);
  const others = await Promise.all(["pluto", "eris", "ceres", "moon"].map((id) => isFar(page, id)));
  expect(others).not.toContain(false);
  expect(others).toContain(true);
  const sun = await over(page, "sun");
  await page.mouse.move(sun.x, sun.y);
  await expect.poll(() => hovered(page)).toBe("sun");
  await expect.poll(() => isFar(page, "earth")).toBe(true);
  expect(await isFar(page, "sun")).toBe(false);
  expect(((await heard(page)).at(-1)?.detail["system"] as { moons: string[] }).moons).toEqual([]);
});

test("a finger on a body lights its system and tells the page while it is down; lifting it ends that", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-phone", "touch, on the phone");
  test.setTimeout(180_000);
  await fromAfar(page);
  await expect.poll(async () => (await strengths(page)).far.length, { timeout: 30_000 }).toBeGreaterThan(0);
  await listen(page, ["wakusei-body-hover", "wakusei-body-hover-end"]);
  const planet = await lonePlanet(page, ["earth"]);
  const point = await over(page, planet);
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: point.x, y: point.y }] });
  await expect.poll(() => hovered(page)).toBe(planet);
  expect((await heard(page)).find((one) => one.type === "wakusei-body-hover")?.detail["id"]).toBe(planet);
  await expect.poll(() => isFar(page, planet)).toBe(false);
  await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => hovered(page)).toBeNull();
  expect((await heard(page)).at(-1)?.type).toBe("wakusei-body-hover-end");
  await expect.poll(() => isFar(page, planet)).toBe(true);
});

// --- where the bodies out of view are --------------------------------------------------------------------------------------------------------------------------------------------------------
interface BodySight {
  id: string;
  kind: string;
  inView: boolean;
  behind: boolean;
  edge: string | null;
  x: number;
  y: number;
  along: number;
  angle: number;
}
const sight = (page: Page): Promise<BodySight[]> => callOn(page, "sight") as Promise<BodySight[]>;

test("sight: the bodies in view are in the picture, the others lie beyond the edge their way points to, behind the camera too; the page hears of a change and nothing at rest", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  test.setTimeout(180_000);
  await openSpace(page, `t=${NOV2}`);
  const box = (await page.locator(SPACE).boundingBox())!;
  const check = async (): Promise<BodySight[]> => {
    const all = await sight(page);
    expect(all.map((one) => one.id)).toEqual(expect.arrayContaining(["sun", "earth", "mars", "jupiter", "neptune"]));
    for (const one of all) {
      if (one.inView) {
        expect(one.edge, one.id).toBeNull();
        continue;
      }
      // the point is on the edge it names, and the way to it leans the same way
      const on = { top: one.y, bottom: box.height - one.y, left: one.x, right: box.width - one.x }[one.edge as "top" | "bottom" | "left" | "right"];
      expect(on, `${one.id} on its ${one.edge} edge`).toBeCloseTo(0, 3);
      const lean = { top: Math.cos((one.angle * Math.PI) / 180), bottom: -Math.cos((one.angle * Math.PI) / 180), right: Math.sin((one.angle * Math.PI) / 180), left: -Math.sin((one.angle * Math.PI) / 180) }[one.edge as "top"];
      expect(lean, `${one.id} leans ${one.edge}`).toBeGreaterThan(0);
      // a body ahead of the camera and off the picture is placed beyond that edge
      const place = await placeOf(page, one.id);
      if (!one.behind && place) {
        const beyond = { top: -place.y, bottom: place.y - box.height, left: -place.x, right: place.x - box.width }[one.edge as "top"];
        expect(beyond + place.r, `${one.id} is beyond its ${one.edge} edge`).toBeGreaterThan(0);
      }
    }
    return all;
  };
  // asked once, the view works the sight out at its next draw
  await expect.poll(async () => (await sight(page)).length, { timeout: 30_000 }).toBeGreaterThan(20);
  const first = await check();
  expect(first.find((one) => one.id === "earth")?.inView).toBe(true);

  await listen(page, ["wakusei-sight"]);
  const count = async () => (await heard(page)).length;
  // at rest: once the view has stopped drawing, a second and a half of reads hears nothing and sees no draw
  const draws = await steady(page);
  const quiet = await count();
  for (let read = 0; read < 5; read += 1) {
    await page.waitForTimeout(300);
    expect((await readCounts(page)).draws).toBe(draws);
    expect(await count()).toBe(quiet);
  }
  // turned half round, the far side of the sky is ahead and what was ahead is behind the camera
  await drawn(page, () => callOn(page, "setView", { yaw: 180, tilt: 0, zoom: 1 }));
  await expect.poll(count).toBeGreaterThan(0);
  const turned = await check();
  expect(turned.some((one) => one.behind && one.edge !== null)).toBe(true);
  const told = (await heard(page)).at(-1)!.detail["bodies"] as BodySight[];
  expect(told.map((one) => one.id).sort()).toEqual(turned.map((one) => one.id).sort());

  // a drag turns the view every frame: the page hears at most four times a second, and a last time with where things came to rest
  await steady(page);
  const before = (await heard(page)).length;
  const sky = await emptySky(page);
  await page.mouse.move(sky.x, sky.y);
  await page.mouse.down();
  const start = await page.evaluate(() => performance.now());
  for (let step = 1; step <= 40; step += 1) {
    await page.mouse.move(sky.x + step * 10, sky.y);
    await frame(page);
  }
  await page.mouse.up();
  const end = await page.evaluate(() => performance.now());
  await steady(page);
  const during = (await heard(page)).slice(before);
  expect(during.length).toBeGreaterThan(0);
  expect(during.length).toBeLessThanOrEqual(Math.ceil((end - start) / 250) + 2);
  for (let i = 1; i < during.length; i += 1) expect(during[i]!.at - during[i - 1]!.at, "time between two events").toBeGreaterThanOrEqual(245);
  const brief = (list: BodySight[]) => list.map((one) => `${one.id}:${one.inView}:${one.edge}:${one.behind}`).sort();
  await expect.poll(async () => brief((await heard(page)).at(-1)!.detail["bodies"] as BodySight[])).toEqual(brief(await sight(page)));
});
