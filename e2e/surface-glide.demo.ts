// The camera does not jump when the watched descent ends or the rover starts (MODULES-1561): the pose of each draw (`camera`) is sampled while the move goes on, and no step between two samples is most of the way, the first is near where the watch left it, and the last is where the standing view puts the eyes.
// `glide=off` is the cut it replaces, and a reader who prefers reduced motion gets it. Chromium, drawn in software, over the made-up site of surface-fixture.ts.
import { expect, test, type Page } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
});

type Pose = { east: number; north: number; up: number; look: { azimuth: number; pitch: number; fov: number } };
type Surface = HTMLElement & { objects: readonly { id: string; east: number; north: number }[]; camera?: Pose; stats: { gliding: boolean; renderer?: { draws: number } }; landingTime: number; pauseLanding(): void };

const view = (page: Page) => page.locator("#test-surface");
const read = <T>(page: Page, fn: (el: Surface) => T): Promise<T> => view(page).evaluate(fn as never) as Promise<T>;
const draws = (page: Page): Promise<number> => read(page, (el) => el.stats.renderer?.draws ?? 0);
/** The touchdown point: where the lunar module stands. */
const touchdown = (page: Page): Promise<{ east: number; north: number }> => read(page, (el) => ({ ...el.objects.find((o) => o.id === "lm")! }));
const gap = (a: Pose, b: Pose): number => Math.hypot(a.east - b.east, a.north - b.north, a.up - b.up);

/** The page with its own view at Apollo 17, watching the descent from the ground camera (150 m north of the touchdown point) with the clock held at T+9:00, the move set to `glide`. */
async function watching(page: Page, glide: string): Promise<Pose> {
  await routeSurface(page);
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate((glide) => {
    document.querySelector("#surface")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("site", "apollo-17");
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    el.setAttribute("shadows", "off");
    el.setAttribute("detail", "off");
    el.setAttribute("watch-camera", "ground");
    el.setAttribute("glide", glide);
    el.style.cssText = "width: 320px";
    document.querySelector("main")!.prepend(el);
  }, glide);
  await expect(view(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await read(page, (el) => el.setAttribute("watch", "landing"));
  await read(page, (el) => el.pauseLanding());
  await read(page, (el) => {
    el.landingTime = 650;
  });
  await expect.poll(async () => (await read(page, (el) => el.camera)) !== undefined, { timeout: 120_000 }).toBe(true);
  const before = await draws(page);
  await expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThan(before - 1);
  return (await read(page, (el) => el.camera))!;
}

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("when the watch ends the camera glides from the ground camera to the standing view: no jump, and it arrives", async ({ page }) => {
    test.setTimeout(300_000);
    const start = await watching(page, "6000");
    const td = await touchdown(page);
    expect(start.north - td.north, "the ground camera stands 150 m north of the touchdown point").toBeGreaterThan(100);
    await read(page, (el) => el.removeAttribute("watch"));
    expect(await read(page, (el) => el.stats.gliding), "a move has begun").toBe(true);
    const samples: Pose[] = [];
    let lastDraws = -1;
    await expect
      .poll(
        async () => {
          const now = await draws(page);
          if (now !== lastDraws) {
            lastDraws = now;
            const pose = await read(page, (el) => el.camera);
            if (pose !== undefined) samples.push(pose);
          }
          return read(page, (el) => el.stats.gliding);
        },
        { timeout: 240_000, intervals: [150] },
      )
      .toBe(false);
    await expect.poll(async () => draws(page), { timeout: 60_000 }).toBeGreaterThan(lastDraws - 1);
    const end = (await read(page, (el) => el.camera))!;
    const total = gap(start, end);
    expect(total, "the standing view is a long way from the ground camera").toBeGreaterThan(100);
    expect(samples.length, "frames were drawn on the way").toBeGreaterThanOrEqual(4);
    expect(gap(start, samples[0]!), "the first frame is near where the watch left the camera").toBeLessThan(total * 0.5);
    let biggest = gap(start, samples[0]!);
    for (let i = 1; i < samples.length; i += 1) biggest = Math.max(biggest, gap(samples[i - 1]!, samples[i]!));
    expect(biggest, `no step is most of the way (the biggest is ${biggest.toFixed(0)} of ${total.toFixed(0)} m)`).toBeLessThan(total * 0.6);
    expect(Math.abs(end.north - td.north), "it arrives at the touchdown point").toBeLessThan(5);
    expect(await read(page, (el) => el.stats.gliding)).toBe(false);
  });

  test("glide=off is the cut: the camera is at the standing view in the first frame, with no move", async ({ page }) => {
    test.setTimeout(300_000);
    const start = await watching(page, "off");
    await read(page, (el) => el.removeAttribute("watch"));
    expect(await read(page, (el) => el.stats.gliding)).toBe(false);
    const sent = await draws(page);
    await expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThan(sent);
    const end = (await read(page, (el) => el.camera))!;
    const td = await touchdown(page);
    expect(gap(start, end)).toBeGreaterThan(100);
    expect(Math.abs(end.north - td.north)).toBeLessThan(5);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("a reader who prefers reduced motion gets the cut, whatever glide says", async ({ page }) => {
    test.setTimeout(300_000);
    await watching(page, "6000");
    await read(page, (el) => el.removeAttribute("watch"));
    expect(await read(page, (el) => el.stats.gliding)).toBe(false);
  });
});
