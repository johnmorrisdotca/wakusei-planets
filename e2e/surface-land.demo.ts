// Coming down from the orbit view to the ground and going back up: `land` and `leave` on `<wakusei-space>` (surface/land), over the made-up site of surface-fixture.ts. Chromium, drawing in software, with the
// processor slowed to a quarter. What happens is recorded in the page (the events as they are sent) and asserted on the record, not polled for a moment that passes.
import { expect, test, type Page } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    const log: string[] = [];
    Reflect.set(window, "__landing", log);
    for (const type of ["wakusei-landing", "wakusei-landed", "wakusei-left"]) document.addEventListener(type, (event) => log.push(`${type}:${(event as CustomEvent).detail.site}`), true);
  });
});

type Orbit = HTMLElement & { land(site: string, options?: object): Promise<HTMLElement>; leave(options?: object): Promise<void>; landed: string | null; standing: HTMLElement | null; body: string };
const log = (page: Page): Promise<string[]> => page.evaluate(() => [...(Reflect.get(window, "__landing") as string[])]);
const open = async (page: Page): Promise<void> => {
  await routeSurface(page);
  await page.setViewportSize({ width: 420, height: 700 });
  await page.goto("/wakusei-planets/surface.html");
  await expect(page.locator("#orbit")).toHaveAttribute("data-state", /live|ready/, { timeout: 120_000 }).catch(() => undefined);
};

test.describe("with reduced motion the descent is a cut", () => {
  test.use({ reducedMotion: "reduce" });

  test("the Land button comes down to Apollo 17; Go back up returns; the events are sent once each, in order", async ({ page }) => {
    test.setTimeout(300_000);
    await open(page);
    expect(await page.locator("#land").isVisible()).toBe(true);
    expect(await page.locator("#looks button").first().isDisabled(), "the choices wait for the ground").toBe(true);
    await page.locator("#land").click();
    await expect.poll(() => log(page), { timeout: 240_000, intervals: [500] }).toContain("wakusei-landed:apollo-17");
    expect(await log(page)).toEqual(["wakusei-landing:apollo-17", "wakusei-landed:apollo-17"]);
    const down = await page.locator("#orbit").evaluate((el) => {
      const orbit = el as Orbit;
      return { landed: orbit.landed, body: orbit.body, visibility: orbit.standing?.style.visibility, standby: orbit.standing?.hasAttribute("standby"), veils: el.shadowRoot!.querySelectorAll("[data-landing-veil]").length, state: orbit.standing?.getAttribute("data-state") };
    });
    expect(down).toEqual({ landed: "apollo-17", body: "moon", visibility: "visible", standby: false, veils: 1, state: "live" });
    expect(await page.locator("#looks button").first().isDisabled(), "the choices are on").toBe(false);
    expect(await page.locator("#leave").isVisible()).toBe(true);
    await page.locator("#leave").click();
    await expect.poll(() => log(page), { timeout: 60_000 }).toContain("wakusei-left:apollo-17");
    expect(await log(page)).toEqual(["wakusei-landing:apollo-17", "wakusei-landed:apollo-17", "wakusei-left:apollo-17"]);
    // the orbit view is alive again: it draws when it is moved (read and moved in the same call)
    const alive = await page.locator("#orbit").evaluate(async (el) => {
      const orbit = el as Orbit & { stats: { draws: number }; controller: { set(view: object, final: boolean, reason: string): void } };
      const before = orbit.stats.draws;
      orbit.controller.set({ zoom: 1.4 }, true, "test");
      const end = performance.now() + 60_000;
      while (orbit.stats.draws === before && performance.now() < end) await new Promise((resolve) => requestAnimationFrame(resolve));
      return { drew: orbit.stats.draws > before, landed: orbit.landed, standing: orbit.standing === null, count: el.shadowRoot!.querySelectorAll("wakusei-surface").length, veils: el.shadowRoot!.querySelectorAll("[data-landing-veil]").length };
    });
    expect(alive).toEqual({ drew: true, landed: null, standing: true, count: 0, veils: 0 });
    expect(await page.locator("#land").isVisible()).toBe(true);
  });

  test("a site that does not exist is refused, and nothing is left over the orbit view", async ({ page }) => {
    await open(page);
    const result = await page.locator("#orbit").evaluate(async (el) => {
      try {
        await (el as Orbit).land("nowhere");
        return "landed";
      } catch (error) {
        return (error as Error).message;
      }
    });
    expect(result).toBe("no site called nowhere");
    expect(await page.locator("#orbit").evaluate((el) => el.shadowRoot!.querySelectorAll("wakusei-surface").length)).toBe(0);
    expect(await log(page)).toEqual([]);
  });

  test("leaving while still coming down calls the landing off: the land is refused and no standing view is left", async ({ page }) => {
    test.setTimeout(240_000);
    await routeSurface(page);
    // the ground never comes in, so the landing is still under way when it is called off
    await page.route("**/tiles/moon/apollo-17/manifest.json", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 600_000));
      await route.abort();
    });
    await page.setViewportSize({ width: 420, height: 700 });
    await page.goto("/wakusei-planets/surface.html");
    const outcome = await page.locator("#orbit").evaluate(async (el) => {
      const orbit = el as Orbit;
      const landing = orbit.land("apollo-17", { tiles: "tiles/", timeout: 120_000 }).then(
        () => "landed",
        (error: Error) => error.message,
      );
      // the same frame: the landing has started (its standing view is in) and is called off
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await orbit.leave();
      return { result: await landing, left: orbit.landed, count: el.shadowRoot!.querySelectorAll("wakusei-surface").length };
    });
    expect(outcome).toEqual({ result: "the landing was called off", left: null, count: 0 });
    expect(await log(page), "called off before it was down: no landed and no left").toEqual(["wakusei-landing:apollo-17"]);
  });
});

test.describe("with motion", () => {
test.use({ reducedMotion: "no-preference" });
test("the descent with motion: the orbit view turns over the site and comes in, then the ground fades in (the events come in order and landed is last)", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const smooth = await page.locator("#orbit").evaluate(async (el) => {
    const orbit = el as Orbit;
    const moved = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const surface = await orbit.land("apollo-17", { tiles: "tiles/" });
    return { moved, visibility: surface.style.visibility, landed: orbit.landed };
  });
  expect(smooth).toEqual({ moved: false, visibility: "visible", landed: "apollo-17" });
  expect(await log(page)).toEqual(["wakusei-landing:apollo-17", "wakusei-landed:apollo-17"]);
});
});
