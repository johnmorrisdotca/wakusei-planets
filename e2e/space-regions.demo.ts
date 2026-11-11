// Backing out from the Sun by stages: from the Sun, five steps out land on the inner planets, the asteroid belt, the outer planets, the Kuiper belt and the whole system in order, each with its farthest
// bodies on the screen and its name shown in the corner; a step in comes back; a zoom-out gesture at a stage steps out; and the names are Japanese for a Japanese page. Both scales. Chromium, drawing in
// software; every wait is on what the page reports.
import { expect, test, type Page } from "@playwright/test";
import { callOn, openSpace, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

const STAGES = [
  { id: "inner-planets", en: "Inner planets", ja: "内太陽系", edge: ["mars", "mercury"] },
  { id: "asteroid-belt", en: "Asteroid belt", ja: "小惑星帯", edge: ["pallas", "ceres", "vesta"] },
  { id: "outer-planets", en: "Outer planets", ja: "外太陽系", edge: ["neptune", "uranus"] },
  { id: "kuiper-belt", en: "Kuiper belt", ja: "カイパーベルト", edge: ["eris", "pluto"] },
  { id: "whole-system", en: "Whole solar system", ja: "太陽系全体", edge: ["sedna", "neptune"] },
] as const;

interface Report {
  ride: { gliding: boolean };
  region: { id: string; name: string; reach: number; distance: number } | null;
}
const report = async (page: Page): Promise<Report> => (await statsOf(page)) as unknown as Report;
const caption = (page: Page): Promise<string> => page.locator(SPACE).evaluate((el) => (el.shadowRoot!.getElementById("region")!.hidden ? "" : el.shadowRoot!.getElementById("region")!.textContent ?? ""));
/** Whether a body's place is inside the box (its marker at least). */
const inBox = (page: Page, id: string): Promise<boolean> =>
  page.locator(SPACE).evaluate((el, body) => {
    const place = (el as unknown as { placeOf(id: string): { x: number; y: number; r: number } | null }).placeOf(body);
    return place !== null && place.x >= 0 && place.y >= 0 && place.x <= el.clientWidth && place.y <= el.clientHeight;
  }, id);
/** Wait for a move to end and the view to be at the stage asked. */
async function settled(page: Page, id: string | null): Promise<Report> {
  await expect.poll(async () => (await report(page)).ride.gliding, { timeout: 60_000 }).toBe(false);
  await expect.poll(async () => (await report(page)).region?.id ?? null, { timeout: 30_000 }).toBe(id);
  return report(page);
}

for (const scale of ["true", "compressed"] as const) {
  test(`${scale} scale: from the Sun, five steps out land on the five stages in order, each framing its region with its name shown; a sixth has nowhere to go; a step in comes back`, async ({ page }) => {
    test.setTimeout(300_000);
    await openSpace(page, `t=2026-11-02T14:00Z&play=off&scale=${scale}`);
    await callOn(page, "goTo", "sun", { smooth: false });
    expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "region"))).toBeNull();
    expect(await caption(page)).toBe("");
    let reach = 0;
    for (const stage of STAGES) {
      expect(await callOn(page, "stepOut"), `step out to ${stage.id}`).toBe(stage.id);
      const now = await settled(page, stage.id);
      expect(now.region!.name).toBe(stage.en);
      expect(await caption(page), `${stage.id}: the name is shown in the corner`).toBe(stage.en);
      expect(now.region!.reach, `${stage.id} reaches further than the stage before`).toBeGreaterThan(reach);
      expect(now.region!.distance, `${stage.id}: the camera stands back past the reach`).toBeGreaterThan(now.region!.reach);
      reach = now.region!.reach;
      for (const id of stage.edge) expect(await inBox(page, id), `${stage.id}: ${id} is on the screen`).toBe(true);
      expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("sun");
    }
    expect(await callOn(page, "stepOut"), "fully out: no stage beyond").toBeNull();
    expect(await callOn(page, "stepIn")).toBe("kuiper-belt");
    await settled(page, "kuiper-belt");
    expect(await caption(page)).toBe("Kuiper belt");
  });
}

test("a step in from the first stage is the Sun itself, the stage id works as a goTo target, and a move to a body clears the stage", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  expect(await callOn(page, "goTo", "asteroid-belt")).toBe(true);
  await settled(page, "asteroid-belt");
  expect(await callOn(page, "stepIn")).toBe("inner-planets");
  await settled(page, "inner-planets");
  expect(await callOn(page, "stepIn")).toBe("sun");
  await settled(page, null);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("sun");
  expect(await caption(page)).toBe("");
  expect(await callOn(page, "stepIn"), "at a body there is no stage to step in from").toBeNull();
  await callOn(page, "goTo", "outer-planets");
  await settled(page, "outer-planets");
  await callOn(page, "goTo", "mars");
  await settled(page, null);
  expect(await page.locator(SPACE).evaluate((el) => Reflect.get(el, "body"))).toBe("mars");
});

test("at a stage a zoom-out gesture steps out and a zoom-in gesture steps in, one step a gesture", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  await callOn(page, "goTo", "inner-planets", { smooth: false });
  await settled(page, "inner-planets");
  const box = (await page.locator(SPACE).boundingBox())!;
  // a pinch of the wheel (Ctrl and the wheel) is the family's zoom in any mode
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, 240);
  await page.keyboard.up("Control");
  await settled(page, "asteroid-belt");
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -240);
  await page.keyboard.up("Control");
  await settled(page, "inner-planets");
});

test("a Japanese page shows the stage's Japanese name", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&lang=ja");
  await page.locator(SPACE).evaluate((el) => el.setAttribute("lang", "ja"));
  await callOn(page, "goTo", "kuiper-belt", { smooth: false });
  await settled(page, "kuiper-belt");
  expect(await caption(page)).toBe("カイパーベルト");
});
