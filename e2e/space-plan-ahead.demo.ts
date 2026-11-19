// A move planned ahead of the click: while a press is down on the body that is selected, the path of the move is worked out, so the click's first draw finds it made. Nothing shows before the press counts as a click: no draw,
// no move of the camera, no event, no change of the body looked at, and a press that turns out to be a drag, or is let go away from the body, drops the plan. Chromium, drawing in software, the clock held.
import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import { callOn, NOV2, openSpace, quiet, SPACE, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Travelling {
  kind: string;
  progress: number;
  ahead: boolean;
  planMs: number;
}
type Place = { x: number; y: number; r: number };

/** The whole system in view from the Sun (or Jupiter), held at one moment, drawn and still: every body to press is on the screen. */
async function from(page: Page, id: string): Promise<void> {
  await callOn(page, "goTo", id, { smooth: false });
  await quiet(page);
  await page.locator("kazoku-view-controls").evaluate((el) => (Reflect.get(el, "controller") as { set(v: unknown, f: boolean, r: string): void }).set({ yaw: 0, tilt: 40, zoom: 0.05 }, true, "jump"));
  await quiet(page);
}

const pointOf = async (page: Page, id: string): Promise<{ x: number; y: number }> => {
  const place = await page.locator(SPACE).evaluate((el, body) => (el as unknown as { placeOf(id: string): Place | null }).placeOf(body), id);
  const box = (await page.locator(SPACE).boundingBox())!;
  expect(place, `${id} is on the screen`).not.toBeNull();
  return { x: box.x + place!.x, y: box.y + place!.y };
};

const listen = (page: Page) =>
  page.locator(SPACE).evaluate((el) => {
    const heard: Record<string, number> = {};
    Reflect.set(window, "__heard", heard);
    for (const name of ["wakusei-body-click", "wakusei-body-select", "wakusei-view", "wakusei-hop", "wakusei-body-focus"]) el.addEventListener(name, () => (heard[name] = (heard[name] ?? 0) + 1));
  });

/** Everything a page could see of the view: the draws, the camera, the body looked at, whether a move is going, the events heard. */
const seen = (page: Page) =>
  page.locator(SPACE).evaluate((el) => {
    const stats = Reflect.get(el, "stats") as { draws: number; camera: unknown; travelling: unknown; ride: { gliding: boolean }; ahead: string | null };
    return { draws: stats.draws, camera: JSON.stringify(stats.camera), body: Reflect.get(el, "body") as string, travelling: stats.travelling, gliding: stats.ride.gliding, heard: JSON.stringify(Reflect.get(window, "__heard")), ahead: stats.ahead };
  });

const travelOf = (page: Page): Promise<Travelling | null> => page.locator(SPACE).evaluate((el) => Reflect.get(el, "stats").travelling as Travelling | null);

const aheadOf = (page: Page): Promise<string | null> => page.locator(SPACE).evaluate((el) => (Reflect.get(el, "stats") as { ahead: string | null }).ahead);

/** Select a body with its first press: the card opens, and the camera stays. */
async function select(page: Page, id: string): Promise<void> {
  const at = await pointOf(page, id);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await page.evaluate(() => Reflect.get(window, "__heard") as Record<string, number>))["wakusei-body-select"] ?? 0).toBeGreaterThan(0);
  await quiet(page);
}

/** Records the moment a move first draws, on the page at every frame, from the moment given (`up`: the next release of a press; `now`: now). */
const watch = (page: Page, from: "up" | "now") =>
  page.locator(SPACE).evaluate((el, start) => {
    const note: { t0: number | null; first: number | null } = { t0: start === "now" ? performance.now() : null, first: null };
    Reflect.set(window, "__watch", note);
    if (start === "up") window.addEventListener("pointerup", () => (note.t0 = performance.now()), { capture: true, once: true });
    const step = (): void => {
      if ((Reflect.get(el, "stats") as { travelling: unknown }).travelling !== null && note.t0 !== null) {
        note.first = performance.now();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, from);
const gained = async (page: Page): Promise<number> => {
  await expect.poll(() => page.evaluate(() => (Reflect.get(window, "__watch") as { first: number | null }).first), { timeout: 30_000 }).not.toBeNull();
  return page.evaluate(() => {
    const note = Reflect.get(window, "__watch") as { t0: number; first: number };
    return note.first - note.t0;
  });
};

test("nothing shows before the press counts as a click: no draw, no move, no event, the same body", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, `t=${NOV2}&scale=compressed`);
  await from(page, "sun");
  await listen(page);
  // click 1 selects: the card opens (the event), the camera stays and nothing is planned
  await select(page, "saturn");
  const selected = await seen(page);
  expect(selected.body).toBe("sun");
  expect(selected.travelling).toBeNull();
  expect(selected.ahead).toBeNull();
  expect(JSON.parse(selected.heard)["wakusei-body-select"]).toBe(1);

  // the press that would be click 2: the plan is made while it is down, and nothing else happens
  const at = await pointOf(page, "saturn");
  await page.mouse.move(at.x, at.y);
  const before = await seen(page);
  await page.mouse.down();
  await expect.poll(() => aheadOf(page), { timeout: 30_000, message: "the move is planned while the press is down" }).toBe("saturn");
  await page.waitForTimeout(500);
  const held = await seen(page);
  expect(held.draws, "no draw").toBe(before.draws);
  expect(held.camera, "the camera has not moved").toBe(before.camera);
  expect(held.body, "the body looked at is the same").toBe("sun");
  expect(held.travelling).toBeNull();
  expect(held.gliding).toBe(false);
  expect(held.heard, "no event: not a click, a selection, a view change or a hop").toBe(before.heard);

  // let go away from the body: no click, so no move, and the plan is dropped
  await page.mouse.move(at.x + 200, at.y + 150);
  await page.mouse.up();
  await expect.poll(() => aheadOf(page)).toBeNull();
  await quiet(page);
  const away = await seen(page);
  expect(away.body).toBe("sun");
  expect(away.travelling).toBeNull();
  expect(away.gliding).toBe(false);
  expect(JSON.parse(away.heard)["wakusei-body-click"] ?? 0, "no click was heard").toBe(1);

  // at rest after that nothing runs: the draws hold and no plan is kept
  await page.waitForTimeout(1500);
  await quiet(page);
  const rest = (await statsOf(page)).draws;
  await page.waitForTimeout(1500);
  expect((await statsOf(page)).draws, "no draw at rest").toBe(rest);
  expect(await aheadOf(page)).toBeNull();
});

test("a press that turns the view is no click: the plan is dropped and the body stays", async ({ page }) => {
  await openSpace(page, `t=${NOV2}&scale=compressed`);
  await from(page, "sun");
  await listen(page);
  await select(page, "jupiter");
  const at = await pointOf(page, "jupiter");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await expect.poll(() => aheadOf(page), { timeout: 30_000 }).toBe("jupiter");
  await page.mouse.move(at.x + 60, at.y + 20, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => aheadOf(page)).toBeNull();
  await quiet(page);
  const after = await seen(page);
  expect(after.body).toBe("sun");
  expect(after.travelling).toBeNull();
});

test("a press on a body that is not selected, or with Ctrl held, plans nothing", async ({ page }) => {
  await openSpace(page, `t=${NOV2}&scale=compressed`);
  await from(page, "sun");
  await listen(page);
  const mars = await pointOf(page, "mars");
  await page.mouse.move(mars.x, mars.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  expect(await aheadOf(page), "the first press only selects").toBeNull();
  await page.mouse.up();
  await expect.poll(async () => JSON.parse((await seen(page)).heard)["wakusei-body-select"] ?? 0).toBe(1);
  await quiet(page);
  await page.keyboard.down("Control");
  const again = await pointOf(page, "mars");
  await page.mouse.move(again.x, again.y);
  await page.mouse.down();
  await page.waitForTimeout(300);
  expect(await aheadOf(page), "a Ctrl press is a cut: there is no path to plan").toBeNull();
  await page.mouse.up();
  await page.keyboard.up("Control");
});

test("the move starts sooner: the click's first draw finds the path made, where a move asked for from nothing works it out then", async ({ page }) => {
  test.setTimeout(420_000);
  await openSpace(page, `t=${NOV2}&scale=compressed`);
  const pairs: [string, string][] = [["sun", "saturn"], ["sun", "jupiter"], ["sun", "neptune"], ["sun", "mars"], ["jupiter", "callisto"]];
  let cold = 0;
  let early = 0;
  let coldWall = 0;
  let earlyWall = 0;
  const lines: string[] = [];
  for (const [start, to] of pairs) {
    // with nothing planned: the move is asked for by a call, and its first draw works the path out
    await from(page, start);
    await watch(page, "now");
    await callOn(page, "goTo", to);
    const slow = await gained(page);
    const coldMove = (await travelOf(page))!;
    expect(coldMove.ahead, `${start} to ${to} asked for with nothing planned`).toBe(false);

    // planned while the press is down: the press that selects, then the press that goes
    await from(page, start);
    await listen(page);
    await select(page, to);
    const at = await pointOf(page, to);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await expect.poll(() => aheadOf(page), { timeout: 30_000 }).toBe(to);
    await watch(page, "up");
    await page.mouse.up();
    const fast = await gained(page);
    const aheadMove = (await travelOf(page))!;
    expect(aheadMove.ahead, `${start} to ${to} pressed twice`).toBe(true);
    expect(await aheadOf(page), "the plan is used up").toBeNull();
    lines.push(`${start} to ${to}: path worked out in ${coldMove.planMs.toFixed(1)} ms at the first draw, ${aheadMove.planMs.toFixed(1)} ms with the plan ahead; release to first moved frame ${slow.toFixed(0)} ms from nothing, ${fast.toFixed(0)} ms planned`);
    cold += coldMove.planMs;
    early += aheadMove.planMs;
    coldWall += slow;
    earlyWall += fast;
    expect(aheadMove.planMs, `${start} to ${to}`).toBeLessThan(coldMove.planMs + 0.5);
  }
  test.info().annotations.push({ type: "gain", description: `${lines.join("; ")}. Total path time at the first draw ${cold.toFixed(1)} ms against ${early.toFixed(1)} ms; to the first moved frame ${coldWall.toFixed(0)} ms against ${earlyWall.toFixed(0)} ms` });
  console.log(lines.join("\n"), `\ntotal planMs ${cold.toFixed(1)} -> ${early.toFixed(1)}; wall ${coldWall.toFixed(0)} -> ${earlyWall.toFixed(0)}`);
  expect(early, "the first draws spend less on the path when it is planned ahead").toBeLessThan(cold);
});

test("a move planned ahead is the move that would have been made: it ends where the other ends", async ({ page }) => {
  test.setTimeout(240_000);
  await openSpace(page, `t=${NOV2}&scale=compressed`);
  const finish = async (planned: boolean): Promise<{ camera: string; ahead: boolean }> => {
    await from(page, "sun");
    if (planned) {
      await listen(page);
      await select(page, "saturn");
      const at = await pointOf(page, "saturn");
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      await expect.poll(() => aheadOf(page), { timeout: 30_000 }).toBe("saturn");
      await page.mouse.up();
    } else await callOn(page, "goTo", "saturn");
    await expect.poll(async () => (await travelOf(page)) !== null, { timeout: 30_000 }).toBe(true);
    const ahead = (await travelOf(page))!.ahead;
    await expect.poll(() => travelOf(page), { timeout: 60_000 }).toBeNull();
    await quiet(page);
    const camera = (await statsOf(page)).camera as { position: number[] };
    return { camera: camera.position.map((n) => n.toFixed(2)).join(","), ahead };
  };
  const asked = await finish(false);
  const pressed = await finish(true);
  expect(asked.ahead).toBe(false);
  expect(pressed.ahead).toBe(true);
  expect(pressed.camera, "the camera arrives in the same place").toBe(asked.camera);
});
