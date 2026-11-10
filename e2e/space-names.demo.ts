// The names of the space view never overlap (MODULES-855): at the inner and the solar-system zoom, in both scales, no two visible names have boxes that cross, and a moon gives way to its planet and a planet to the Sun.
// Chromium, drawing in software.
import { expect, test } from "@playwright/test";
import { callOn, crossing, goTo, nameBoxes, openSpace, settle } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

for (const scale of ["true", "compressed"] as const) {
  for (const [preset, button] of [["inner", "Inner planets"], ["solar-system", "Whole solar system"]] as const) {
    test(`no two names overlap at the ${preset} zoom, ${scale} scale, however the Moon sits`, async ({ page }) => {
      await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}`);
      await goTo(page, button);
      const names = await nameBoxes(page);
      expect(names.length, "the names are shown").toBeGreaterThanOrEqual(4);
      expect(crossing(names)).toEqual([]);
      // a day at a time for a few days, so the Moon and the planets are in different places each time
      for (const day of [3, 9, 14]) {
        await callOn(page, "setAttribute", "time", new Date(Date.UTC(2026, 10, 2 + day, 14)).toISOString());
        await settle(page, 700);
        expect(crossing(await nameBoxes(page)), `${day} days on`).toEqual([]);
      }
    });
  }
}

test("a moon gives way to its planet and a planet to the Sun: at the inner zoom in the true scale, the Earth is named and the Moon is not", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z&scale=true");
  await goTo(page, "Inner planets");
  const shown = (await nameBoxes(page)).map((b) => b.id);
  expect(shown).toContain("earth");
  expect(shown).not.toContain("moon");
  expect(shown).toContain("sun");
});
