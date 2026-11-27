import "./load.ts";
import { expect, test, type Page } from "@playwright/test";
import type { BodyFramingOptions, BodyFramingResult, BodyFraming, WakuseiSpace } from "../src/space/element.ts";
import type { BodyId } from "../src/facts.ts";
import { callOn, drawn, NOV2, openSpace, quiet, SPACE, statsOf } from "./space-ui.ts";

const frame = (page: Page, id: string, kind: BodyFraming, options?: BodyFramingOptions): Promise<BodyFramingResult | null> =>
  page.locator(SPACE).evaluate((el, request) => (el as WakuseiSpace).framingFor(request.id, request.kind, request.options), { id, kind, options });

const applyZoom = (page: Page, zoom: number) => drawn(page, () => page.locator(SPACE).evaluate((el, asked) => {
  const space = el as WakuseiSpace;
  space.setView({ ...space.controller!.state, zoom: asked, panX: 0, panY: 0 }, true, "jump");
}, zoom));

async function expectProjection(page: Page, id: BodyId, predicted: BodyFramingResult["body"]): Promise<void> {
  const actual = await page.locator(SPACE).evaluate((el, body) => (el as WakuseiSpace).placeOf(body), id);
  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(predicted.x, 1);
  expect(actual!.y).toBeCloseTo(predicted.y, 1);
  expect(actual!.r).toBeCloseTo(predicted.r, 1);
}

async function settledDraws(page: Page): Promise<number> {
  // A moon that left the view is held briefly and then schedules a draw to release it.
  await expect.poll(() => page.locator(SPACE).evaluate((el) => {
    const { held, moons } = (el as WakuseiSpace).stats.bodies;
    return held - moons;
  }), { timeout: 30_000 }).toBe(0);
  await quiet(page);
  return (await statsOf(page)).draws;
}

test("whole and close frame the globe and Saturn's rings without drawing a frame", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "space WebGL uses Chromium's software renderer");
  await openSpace(page, `t=${NOV2}&play=off`);
  if (info.project.use.hasTouch) {
    await drawn(page, () => page.addStyleTag({ content: "#sky { width: 285px; height: 470px; max-height: none }" }));
  }
  const arrival = (await frame(page, "saturn", "whole"))!;
  expect(arrival.share).toBeCloseTo(2 / 3, 4);
  // A trip can use the requested framing before its destination is in focus.
  await drawn(page, () => callOn(page, "goTo", "saturn", { smooth: false, zoom: arrival.zoom }));
  await expectProjection(page, "saturn", arrival.body);
  const before = await settledDraws(page);
  const { canvas } = await statsOf(page);
  const whole = (await frame(page, "saturn", "whole"))!;
  const close = (await frame(page, "saturn", "close", { share: 1.1 }))!;
  expect(whole.share).toBeCloseTo(2 / 3, 4);
  expect(close.share).toBeCloseTo(1.1, 4);
  expect(whole.zoom).toBeLessThan(close.zoom);
  expect(whole.body.r).toBeLessThan(whole.share * Math.min(canvas.width, canvas.height) / 2);
  expect(await frame(page, "unknown body", "whole")).toBeNull();
  await quiet(page);
  expect((await statsOf(page)).draws).toBe(before);
  await applyZoom(page, close.zoom);
  await expectProjection(page, "saturn", close.body);
});

test("the beside query predicts the Moon and Io with their planets in both scales", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "space WebGL uses Chromium's software renderer");
  await openSpace(page, `t=${NOV2}&play=off`);
  for (const [body, host, scale, zoom] of [["moon", "earth", "true", 1.35], ["io", "jupiter", "compressed", 1.5]] as const) {
    await drawn(page, () => page.locator(SPACE).evaluate((el, mode) => { (el as WakuseiSpace).scale = mode; }, scale).then(() => callOn(page, "ride", body, { view: "beside", smooth: false })));
    const before = await settledDraws(page);
    const exact = (await frame(page, body, "whole", { zoom }))!;
    const close = (await frame(page, body, "close"))!;
    expect(exact.zoom).toBe(zoom);
    expect(exact.companion).not.toBeNull();
    expect(close).not.toBeNull();
    await quiet(page);
    expect((await statsOf(page)).draws).toBe(before);
    await applyZoom(page, exact.zoom);
    await expectProjection(page, body, exact.body);
    await expectProjection(page, host, exact.companion!);
  }
});
