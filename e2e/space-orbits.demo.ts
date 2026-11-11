// The orbit lines of the space view (MODULES-852): with Orbits on, the Earth's ring round the Sun and the Moon's ring round the Earth are drawn, and every body sits on its own ring. Chromium, in software.
import { expect, test } from "@playwright/test";
import { callOn, goTo, openSpace, setOn, settle, statsOf } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });
test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
});

interface Orbits {
  drawn: string[];
  miss: Record<string, number>;
}
const orbitsOf = async (page: import("@playwright/test").Page): Promise<Orbits> => ((await statsOf(page)) as unknown as { orbits: Orbits }).orbits;
const ALL = ["earth", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "ceres", "orcus", "haumea", "quaoar", "makemake", "gonggong", "eris", "sedna", "vesta", "pallas", "chiron", "pholus", "halley", "moon"];

for (const scale of ["true", "compressed"] as const) {
  test(`with Orbits on, the Earth is on its ring and the Moon on its ring round the Earth, and so is every planet, dwarf planet and minor body (${scale} scale)`, async ({ page }) => {
    await openSpace(page, `t=2026-11-02T14:00Z&scale=${scale}`);
    const first = await orbitsOf(page);
    expect([...first.drawn].sort()).toEqual([...ALL].sort());
    for (const id of ALL) expect(first.miss[id], `${id} is on its ring`).toBeLessThan(0.01);
    // a few days and a few years on, the rings follow
    for (const iso of ["2026-11-06T09:00Z", "2026-12-20T00:00Z", "2031-03-03T03:00Z"]) {
      await callOn(page, "setAttribute", "time", iso);
      await settle(page, 700);
      const now = await orbitsOf(page);
      for (const id of ALL) expect(now.miss[id], `${id} on ${iso}`).toBeLessThan(0.01);
    }
  });
}

test("Orbits off draws no ring and on draws them all again, the Moon's among them", async ({ page }) => {
  await openSpace(page, "t=2026-11-02T14:00Z");
  await setOn(page, "orbits", false);
  await settle(page, 500);
  expect((await orbitsOf(page)).drawn).toEqual([]);
  await setOn(page, "orbits", true);
  await settle(page, 500);
  expect((await orbitsOf(page)).drawn).toContain("moon");
  // at the Moon's zoom the ring is still the Moon's own: the Moon is on it
  await goTo(page, "Moon");
  await settle(page, 500);
  expect((await orbitsOf(page)).miss["moon"]).toBeLessThan(0.01);
});
