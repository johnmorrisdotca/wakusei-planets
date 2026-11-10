// Any body at the middle of the space view, a press that selects and a second press that goes there, and the hopper (MODULES-858). Chromium, drawing in software.
import { expect, test, type Page } from "@playwright/test";
import { callOn, goTo, openSpace, setOn, settle, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Place {
  x: number;
  y: number;
  r: number;
}
const placeOf = (page: Page, id: string): Promise<Place | null> => page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
const bodyOf = (page: Page): Promise<string> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "body") as string);
const selectedOf = (page: Page): Promise<string | null> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "selected") as string | null);
const listOf = (page: Page): Promise<{ id: string; name: string; kind: string; host?: string }[]> => page.locator(SPACE).evaluate((el) => (el as unknown as { bodyList(): { id: string; name: string; kind: string; host?: string }[] }).bodyList());
const size = async (page: Page): Promise<{ width: number; height: number }> => {
  const box = (await page.locator(SPACE).boundingBox())!;
  return { width: box.width, height: box.height };
};

/** Wait until the body is drawn at the middle of the view, to within `pixels`. */
async function centred(page: Page, id: string, pixels = 3): Promise<Place> {
  const { width, height } = await size(page);
  await expect
    .poll(async () => {
      const at = await placeOf(page, id);
      return at === null ? Infinity : Math.max(Math.abs(at.x - width / 2), Math.abs(at.y - height / 2));
    }, { message: `${id} is at the middle`, timeout: 30_000 })
    .toBeLessThanOrEqual(pixels);
  return (await placeOf(page, id))!;
}

test("setting `body` to a planet's name in any case puts that planet at the middle", async ({ page }) => {
  await openSpace(page);
  for (const name of ["saturn", "Saturn", "SATURN", "土星"]) {
    await setOn(page, "body", "earth");
    await centred(page, "earth");
    await setOn(page, "body", name);
    expect(await bodyOf(page), name).toBe("saturn");
    const at = await centred(page, "saturn");
    expect(at.r, "Saturn fills the view at zoom 1").toBeGreaterThan(100);
  }
  await setOn(page, "body", "nowhere");
  expect(await bodyOf(page), "a name that is no body changes nothing").toBe("saturn");
});

test("the hopper goes through every body in order, each at the middle within three pixels, and back again", async ({ page }) => {
  test.setTimeout(600_000);
  await openSpace(page);
  const bodies = await listOf(page);
  const ids = bodies.map((b) => b.id);
  expect(ids.slice(0, 8), "the order").toEqual(["sun", "mercury", "venus", "earth", "moon", "mars", "phobos", "deimos"]);
  expect(ids, "the moons of the planets are there").toEqual(expect.arrayContaining(["io", "titan", "triton", "charon"]));
  expect(bodies.find((b) => b.id === "titan")).toMatchObject({ kind: "moon", host: "saturn" });
  await callOn(page, "goTo", "sun", { smooth: false });
  await centred(page, "sun");
  let told = 0;
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__hops", []);
    el.addEventListener("wakusei-hop", (event) => (Reflect.get(window, "__hops") as unknown[]).push((event as CustomEvent).detail));
  });
  // forwards, one at a time: where the hopper says it leads is where it goes
  for (const expected of ids.slice(1)) {
    const lead = await page.locator(SPACE).evaluate((el) => (Reflect.get(el, "hopper") as { next: { id: string } }).next.id);
    expect(lead, `the next arrow leads to ${expected}`).toBe(expected);
    await callOn(page, "next", { smooth: false });
    expect(await bodyOf(page)).toBe(expected);
    await centred(page, expected);
    told += 1;
  }
  // after the last it goes round to the Sun
  await callOn(page, "next", { smooth: false });
  expect(await bodyOf(page)).toBe("sun");
  await centred(page, "sun");
  // and backwards
  for (const expected of [...ids].reverse().slice(0, -1)) {
    await callOn(page, "previous", { smooth: false });
    expect(await bodyOf(page)).toBe(expected);
    await centred(page, expected);
  }
  const events = (await page.evaluate(() => Reflect.get(window, "__hops"))) as { current: { id: string }; previous: { id: string; name: string }; next: { id: string; name: string } }[];
  expect(events.length, "one event for each hop").toBe(ids.length * 2 - 1);
  expect(events[0]!.current.id).toBe("mercury");
  expect(events[0]!.next.id).toBe("venus");
  expect(events[0]!.previous.name).toBe("Sun");
  expect(told).toBe(ids.length - 1);
});

test("a press on Saturn selects it and the view stays; a second press goes there; a press on nothing changes nothing, and nothing sends the view back to the Earth", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, `t=2026-11-02T14:00Z&scale=compressed`);
  await goTo(page, "Whole solar system");
  await page.locator(SPACE).evaluate((el) => {
    Reflect.set(window, "__events", []);
    for (const name of ["wakusei-body-click", "wakusei-body-select", "wakusei-hop"]) el.addEventListener(name, (event) => (Reflect.get(window, "__events") as string[]).push(`${name}:${(event as CustomEvent).detail.id ?? ""}`));
  });
  const box = (await page.locator(SPACE).boundingBox())!;
  const at = (await placeOf(page, "saturn"))!;
  expect(at, "Saturn is on the screen at the solar-system zoom").not.toBeNull();
  const click = async (x: number, y: number): Promise<void> => {
    await page.mouse.move(box.x + x, box.y + y);
    await page.mouse.down();
    await page.mouse.up();
    await settle(page, 500);
  };
  await click(at.x, at.y);
  expect(await selectedOf(page)).toBe("saturn");
  expect(await bodyOf(page), "the first press does not move the view").toBe("earth");
  await click(at.x, at.y);
  expect(await bodyOf(page), "the second press goes there").toBe("saturn");
  const there = await centred(page, "saturn");
  expect(there.r, "Saturn is big on the screen").toBeGreaterThan(60);
  // a press on empty sky selects nothing new and does not move the view
  const { width, height } = await size(page);
  await click(width - 8, height - 8);
  expect(await bodyOf(page)).toBe("saturn");
  // a press on the body already at the middle does not send the view anywhere else
  await click(there.x, there.y);
  await click(there.x, there.y);
  expect(await bodyOf(page)).toBe("saturn");
  const log = (await page.evaluate(() => Reflect.get(window, "__events"))) as string[];
  expect(log).toEqual(expect.arrayContaining(["wakusei-body-click:saturn", "wakusei-body-select:saturn", "wakusei-hop:saturn"]));
  expect(log.some((line) => line === "wakusei-hop:earth")).toBe(false);
});

test("going to a body glides, ends at its middle with it whole in view, and the demo's arrows name where they lead", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page);
  await callOn(page, "goTo", "jupiter");
  await centred(page, "jupiter");
  await expect(page.locator("#hop-prev-name")).toHaveText("Deimos");
  await expect(page.locator("#hop-next-name")).toHaveText("Io");
  await page.locator("#hop-next").dispatchEvent("click");
  await centred(page, "io");
  await expect(page.locator("#hop-now")).toContainText("Io");
});
