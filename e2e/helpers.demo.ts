// The shared waits of the specs, tried on their own: a wait that cannot tell a view at rest from one that is still drawing, or a count taken apart from the change it is meant for, is a wait that passes for the wrong reason.
import { expect, test } from "@playwright/test";
import "./load.ts";
import { quietElement } from "./quiet.ts";
import { callCounted, clickCounted, drawnAfter, openSpace, quiet, setCounted, setOn, SPACE, statsOf } from "./space-ui.ts";

test.beforeEach(({ browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "chromium-desk", "3D in software, Chromium only");
});

test("quiet holds on a view at rest, and does not on one whose clock runs", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  await quiet(page, 20_000);
  await quietElement(page, SPACE, 20_000);
  // the date runs: a frame every time, so the draws never hold still, and the wait says so instead of passing
  await setOn(page, "speed", 3600);
  await expect(quiet(page, 3_000)).rejects.toThrow();
  await expect(quietElement(page, SPACE, 3_000)).rejects.toThrow();
  await setOn(page, "speed", 0);
  await quiet(page, 20_000);
});

test("a count taken with a change is the count at the change, and the wait is for a draw after it", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&play=off&scale=compressed");
  const atRest = (await statsOf(page)).draws;
  const viaSet = await setCounted(page, "time", Date.UTC(2026, 10, 3, 14));
  expect(viaSet, "the count is what it was before the change").toBe(atRest);
  await drawnAfter(page, viaSet, "the new date");
  await quiet(page);
  const rested = (await statsOf(page)).draws;
  const viaCall = await callCounted(page, "setView", { zoom: 1.2 });
  expect(viaCall).toBe(rested);
  await drawnAfter(page, viaCall, "the new view");
  await quiet(page);
  const restedAgain = (await statsOf(page)).draws;
  const viaClick = await clickCounted(page.getByRole("group", { name: "Go to" }).getByRole("button", { name: "Moon", exact: true }));
  expect(viaClick).toBe(restedAgain);
  await drawnAfter(page, viaClick, "the move to the Moon");
});
