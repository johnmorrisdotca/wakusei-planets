// The standing view in a real browser (Chromium, drawn in software) over a made-up site (surface-fixture.ts): the tiles are asked for once, the view draws when something changes and not at rest,
// a drag turns it, the keys walk it over the ground and zoom it, the picture says its detail is made, and the sky is the real one. The pictures are drawn small and with the shadows off, since software drawing
// takes seconds a picture; the page's own draw is the same code. Nothing is downloaded from anywhere. Written to the rules of the test-rules page: what is counted is counted in the page.
import { expect, test, type Page } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // a slow machine: the page runs at a quarter of the speed, so a test that only passes on a quiet one fails here (the rules of the test-rules page)
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
});

type Surface = HTMLElement & {
  state: string;
  look: { azimuth: number; pitch: number; fov: number };
  position: { east: number; north: number; up: number };
  sky: { sun: { altitude: number }; earth: { altitude: number } };
  stats: { state: string; draws: number; quality: string; scale: number; scaled: number; tiles?: { done: number; total: number; first: number }; renderer?: { draws: number; contexts: number; canvas: { width: number; height: number; pixels: number } } };
  time: number;
  objects: readonly { id: string; east: number; north: number }[];
  choose(id: string | undefined): boolean;
  vehicle?: { east: number; north: number; heading: number; speed: number; y: number; airborne: boolean; distance: number };
  driveCamera: "chase" | "seat";
  driveDrag: "head" | "orbit";
  landing?: { t: number; playing: boolean; camera: string; altitude: number; speed: number };
  landingTime: number;
  pauseLanding(): void;
  playLanding(): void;
  driveFor(seconds: number, input?: { throttle: number; steer: number }): boolean;
};

const open = async (page: Page, attributes = "shadows=off detail=off", routed = false): Promise<void> => {
  if (!routed) await routeSurface(page);
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  // the demo page's own element is replaced by one with the attributes this test wants, so the test does not depend on the page's choices
  await page.evaluate((text) => {
    document.querySelector("#surface")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("site", "apollo-17");
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    for (const pair of text.split(" ")) {
      const [k, v] = pair.split("=");
      if (k) el.setAttribute(k, v ?? "");
    }
    el.style.cssText = "width: 320px";
    document.querySelector("main")!.prepend(el);
  }, attributes);
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  // at rest: the draws have stopped (the first, at the quality of motion, and the one a moment after it at the quality of rest, which a machine that is slow steps down), the same on three reads
  let held = "";
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await read(page, (el) => `${el.stats.quality}:${el.stats.renderer?.draws ?? 0}`);
        same = now === held && !now.endsWith(":0") ? same + 1 : 0;
        held = now;
        return same;
      },
      { timeout: 180_000, intervals: [400] },
    )
    .toBeGreaterThanOrEqual(3);
};
const view = (page: Page) => page.locator("#test-surface");
const read = <T>(page: Page, fn: (el: Surface) => T): Promise<T> => view(page).evaluate(fn as never) as Promise<T>;
/** The live view's draws so far, as the renderer counts them. */
const draws = (page: Page): Promise<number> => read(page, (el) => el.stats.renderer?.draws ?? 0);
/** Waits until the draws have reached `n` or more. */
const drawnTo = (page: Page, n: number) => expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(n);

test("the tiles are asked for once, the view goes live, draws, and draws nothing at rest", async ({ page }) => {
  await open(page);
  const first = await draws(page);
  expect(first).toBeGreaterThanOrEqual(1);
  // nothing happens for a while: a wait to say that nothing happens, not to wait for something
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(first);
  expect(await read(page, (el) => el.stats.renderer!.contexts)).toBe(1);
  const canvas = await read(page, (el) => el.stats.renderer!.canvas);
  expect(canvas.pixels).toBeLessThanOrEqual(6_000_000);
  expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(4096);
});

test("a drag turns the view and draws; a plus zooms (the field of view narrows); the sky is the real one for the moment", async ({ page }) => {
  await open(page);
  const before = await read(page, (el) => ({ ...el.look, draws: el.stats.renderer!.draws }));
  const box = (await view(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  const after = await read(page, (el) => ({ ...el.look }));
  expect(after.azimuth).not.toBeCloseTo(before.azimuth, 0);
  expect(((before.azimuth - after.azimuth + 540) % 360) - 180, "dragging to the right turns the view to the left of the ground, as a hand does").toBeGreaterThan(0);
  await drawnTo(page, before.draws + 1);
  await view(page).focus();
  await page.keyboard.press("+");
  expect(await read(page, (el) => el.look.fov)).toBeLessThan(after.fov);
  // the landing's sky: the Sun low in the east, the Earth high in the south-west
  const sky = await read(page, (el) => ({ sun: el.sky.sun.altitude, earth: el.sky.earth.altitude }));
  expect(sky.sun).toBeGreaterThan(12);
  expect(sky.sun).toBeLessThan(15);
  expect(sky.earth).toBeGreaterThan(40);
});

test("a held key walks over the ground at a walking pace, and the eyes follow the ground: forward is where the view looks", async ({ page }) => {
  await open(page, "shadows=off detail=off heading=0");
  await view(page).focus();
  const start = await read(page, (el) => ({ ...el.position }));
  await page.keyboard.down("w");
  await expect.poll(() => read(page, (el) => el.position.north), { timeout: 30_000 }).toBeGreaterThan(start.north + 0.5);
  await page.keyboard.up("w");
  const end = await read(page, (el) => ({ ...el.position }));
  expect(Math.abs(end.east - start.east), "north is straight on").toBeLessThan(0.05);
  expect(end.north - start.north).toBeLessThan(10); // a walk of a few seconds, not a bound
  // the key is up: no more steps and no more draws
  await page.waitForTimeout(800); // that nothing happens after the key is up
  const rest = await draws(page);
  await page.waitForTimeout(800);
  expect(await draws(page)).toBe(rest);
});

test("the picture says its detail is made; with detail off it does not, and no rocks are made", async ({ page }) => {
  await open(page, "shadows=off");
  await expect.poll(() => read(page, (el) => (el.shadowRoot!.getElementById("note")!.textContent ?? "").includes("made, not measured"))).toBe(true);
  expect(await read(page, (el) => (el.stats as unknown as { mesh?: { rings: number } }).mesh?.rings ?? 0)).toBeGreaterThan(100);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  await open(page, "shadows=off detail=off");
  const note = await read(page, (el) => el.shadowRoot!.getElementById("note")!.textContent ?? "");
  expect(note).toContain("Heights measured");
  expect(note).not.toContain("made, not measured");
});

test("a site with no heights says so and draws nothing", async ({ page }) => {
  await page.route("**/tiles/moon/apollo-17/**", (route) => route.fulfill({ status: 404, body: "no" }));
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate(() => {
    document.querySelector("#surface")?.remove();
    const el = document.createElement("wakusei-surface");
    el.id = "test-surface";
    el.setAttribute("tiles", "/wakusei-planets/tiles/");
    document.querySelector("main")!.prepend(el);
  });
  await expect(page.locator("#test-surface")).toHaveAttribute("data-state", "unavailable", { timeout: 60_000 });
});

test("the first view is enough to stand on: the view is live while the far level is still on its way, and the rest comes in place", async ({ page }) => {
  test.setTimeout(240_000);
  // the far level's tiles are held until the test lets them go
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  // (the later route is asked first; it lets the request through to the made-up site's own when released)
  await routeSurface(page);
  await page.route("**/tiles/moon/apollo-17/terrain/far/**", async (route) => {
    await held;
    await route.fallback();
  });
  await open(page, "shadows=off detail=off", true);
  expect(await view(page).getAttribute("data-loading"), "the far level is not in").toBe("more");
  // the view at rest first (its draws have stopped), so a draw after this is the far level's
  let held4 = "";
  let same = 0;
  await expect
    .poll(async () => {
      const now = String(await draws(page));
      same = now === held4 ? same + 1 : 0;
      held4 = now;
      return same;
    }, { intervals: [400], timeout: 120_000 })
    .toBeGreaterThanOrEqual(3);
  const before = await read(page, (el) => ({ ...el.stats.tiles!, draws: el.stats.renderer!.draws }));
  expect(before.done).toBeLessThan(before.total);
  expect(before.done).toBeGreaterThanOrEqual(before.first);
  release();
  await expect.poll(() => view(page).getAttribute("data-loading"), { timeout: 120_000 }).toBe("done");
  const after = await read(page, (el) => ({ ...el.stats.tiles!, draws: el.stats.renderer!.draws }));
  expect(after.done).toBe(after.total);
  // what came in was drawn: the view drew again after the far tiles landed
  await drawnTo(page, before.draws + 1);
});

test("the walking stick walks and does not look: a press on it pushes the eyes forward, the view does not turn, and letting go stops the walk", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "shadows=off detail=off heading=0 stick=on");
  const stick = (await page.locator("#test-surface").evaluate((el) => {
    const box = el.shadowRoot!.getElementById("stick")!.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, r: box.width / 2 };
  }));
  const start = await read(page, (el) => ({ ...el.position, azimuth: el.look.azimuth }));
  await page.mouse.move(stick.x, stick.y);
  await page.mouse.down();
  await page.mouse.move(stick.x, stick.y - stick.r * 0.8, { steps: 3 }); // up on the stick is forward
  await expect.poll(() => read(page, (el) => el.position.north), { timeout: 60_000 }).toBeGreaterThan(start.north + 0.3);
  await page.mouse.up();
  const end = await read(page, (el) => ({ ...el.position, azimuth: el.look.azimuth }));
  expect(end.azimuth, "the finger on the stick does not look").toBe(start.azimuth);
  expect(Math.abs(end.east - start.east), "straight ahead").toBeLessThan(0.05);
  // the stick is up: no more steps (that nothing happens after it is let go)
  await page.waitForTimeout(800);
  const rest = await read(page, (el) => el.position.north);
  await page.waitForTimeout(800);
  expect(await read(page, (el) => el.position.north)).toBe(rest);
});

test("a machine that is slow draws the ground smaller while it moves and at full size at rest; a scale asked for is kept", async ({ page }) => {
  test.setTimeout(240_000);
  await open(page, "shadows=off detail=off scale=0.5");
  expect(await read(page, (el) => el.stats.scale), "a scale asked for is every draw's").toBe(0.5);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  await open(page, "shadows=off detail=off");
  // moved a few times, then at rest: the moving draws are timed, software drawing is slow, so the moving size is a half and the size at rest stays whole
  for (let i = 0; i < 4; i += 1) {
    const before = await draws(page);
    await view(page).evaluate((el) => void ((el as Surface).look = { ...(el as Surface).look, azimuth: (el as Surface).look.azimuth + 15 }));
    await drawnTo(page, before + 1);
  }
  expect(await read(page, (el) => el.stats.scaled), "some of the moving draws were at a half").toBeGreaterThanOrEqual(1);
  await expect.poll(() => read(page, (el) => el.stats.scale), { timeout: 120_000, intervals: [400] }).toBe(1);
});

test("the things at the site have a button each: a press goes to it, says what it is and that it was placed by this package, and a second press puts the line away; objects=off shows none", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off");
  // the events are recorded in the page from here on
  await page.evaluate(() => {
    const log: string[] = [];
    Reflect.set(window, "__objects", log);
    document.querySelector("#test-surface")!.addEventListener("wakusei-surface-object", (event) => log.push((event as CustomEvent).detail.id));
  });
  const ids = await read(page, (el) => el.objects.map((o) => o.id).sort());
  expect(ids).toEqual(["alsep", "flag", "lm", "rover", "sep"]);
  const button = view(page).getByRole("button", { name: "Lunar module" });
  await expect(button).toBeVisible({ timeout: 120_000 }); // the first look is toward the south-west, where it stands
  await button.click();
  const after = await read(page, (el) => {
    const lm = el.objects.find((o) => o.id === "lm")!;
    return { gap: Math.hypot(el.position.east - lm.east, el.position.north - lm.north), about: el.shadowRoot!.getElementById("about")!.textContent ?? "", shown: !el.shadowRoot!.getElementById("about")!.hidden, events: [...(Reflect.get(window, "__objects") as string[])] };
  });
  expect(after.gap, "the eyes stand a few metres off it").toBeGreaterThan(13);
  expect(after.gap).toBeLessThan(15);
  expect(after.shown).toBe(true);
  expect(after.about).toContain("Lunar module");
  expect(after.about).toContain("Placed by this package");
  expect(after.events).toEqual(["lm"]);
  await button.click();
  expect(await read(page, (el) => el.shadowRoot!.getElementById("about")!.hidden), "pressed again: put away").toBe(true);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  await open(page, "shadows=off detail=off objects=off");
  expect(await read(page, (el) => el.objects.length)).toBe(0);
  expect(await view(page).evaluate((el) => el.shadowRoot!.querySelectorAll(".label").length)).toBe(0);
});

test("drive=on puts the eyes behind the rover at its place: W drives it west along its heading, the view follows, and at rest nothing is drawn", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off drive=on");
  const start = await read(page, (el) => ({ ...el.vehicle!, eyeEast: el.position.east, camera: el.driveCamera }));
  expect(start.heading, "it points the way its last traverse ended").toBeGreaterThan(200);
  expect(start.heading).toBeLessThan(300);
  expect(start.speed).toBe(0);
  expect(start.camera).toBe("chase");
  expect(Math.hypot(start.east - 76.9, start.north - 11.1), "at its published place").toBeLessThan(0.5);
  await view(page).focus();
  await page.keyboard.down("w");
  await expect.poll(() => read(page, (el) => el.vehicle!.distance), { timeout: 120_000 }).toBeGreaterThan(1);
  await page.keyboard.up("w");
  const moving = await read(page, (el) => ({ ...el.vehicle!, eyeEast: el.position.east }));
  expect(moving.east, "west is where it points").toBeLessThan(start.east - 0.8);
  expect(moving.eyeEast, "and the eyes went with it").toBeLessThan(start.eyeEast - 0.8);
  // it rolls to a stop and settles; then nothing is drawn (that nothing happens: a wait to say so)
  await expect.poll(() => read(page, (el) => Math.abs(el.vehicle!.speed)), { timeout: 120_000, intervals: [400] }).toBe(0);
  let held = -1;
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await draws(page);
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { timeout: 120_000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(3);
  const rest = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(rest);
  // the camera: C turns to the seat, the eyes at the seat's height over the rover
  await page.keyboard.press("c");
  const seat = await read(page, (el) => ({ camera: el.driveCamera, eyeUp: el.position.up, y: el.vehicle!.y }));
  expect(seat.camera).toBe("seat");
  // position.up is the height the view is drawn from over the ground under it, not a person's 1.7 m: the seat's eyes are low on the rover, the chase camera is 2.8 m above it
  expect(seat.eyeUp).toBeGreaterThan(1.2);
  expect(seat.eyeUp).toBeLessThan(1.65);
  await page.keyboard.press("c");
  const chase = await read(page, (el) => ({ camera: el.driveCamera, eyeUp: el.position.up }));
  expect(chase.camera).toBe("chase");
  expect(chase.eyeUp).toBeGreaterThan(1.9);
});

test("a drag in the chase view: in head (the default) the eyes keep their place and only the look turns, so the rover leaves the picture and comes back; in orbit the eyes go round the rover and it holds its place", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off drive=on");
  expect(await read(page, (el) => el.driveDrag), "head is the default").toBe("head");
  const box = (await view(page).boundingBox())!;
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  const drag = async (dx: number): Promise<void> => {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy, { steps: 6 });
    await page.mouse.up();
  };
  // where the rover is against the middle of the picture, in degrees (0 is in the middle), and the eyes' distance from it
  const state = (): Promise<{ east: number; north: number; off: number; away: number }> =>
    read(page, (el) => {
      const v = el.vehicle!;
      const bearing = (Math.atan2(v.east - el.position.east, v.north - el.position.north) * 180) / Math.PI;
      return { east: el.position.east, north: el.position.north, off: ((el.look.azimuth - bearing + 540) % 360) - 180, away: Math.hypot(v.east - el.position.east, v.north - el.position.north) };
    });
  const at = await state();
  expect(at.away).toBeCloseTo(6.5, 1);
  expect(Math.abs(at.off)).toBeLessThan(0.5);
  await drag(150);
  const head = await state();
  expect(head.east, "head: the eyes did not move").toBeCloseTo(at.east, 6);
  expect(head.north).toBeCloseTo(at.north, 6);
  expect(Math.abs(head.off), "and the view turned: the rover is out of the middle").toBeGreaterThan(20);
  await drag(-150);
  const back = await state();
  expect(Math.abs(back.off), "turned back, the rover is in the middle again").toBeLessThan(0.5);
  expect(back.east).toBeCloseTo(at.east, 6);
  await page.evaluate(() => document.querySelector("#test-surface")!.setAttribute("drive-drag", "orbit"));
  expect(await read(page, (el) => el.driveDrag)).toBe("orbit");
  await drag(150);
  const orbit = await state();
  expect(Math.abs(orbit.off), "orbit: the rover holds its place").toBeLessThan(0.5);
  expect(orbit.away).toBeCloseTo(6.5, 1);
  expect(Math.hypot(orbit.east - at.east, orbit.north - at.north), "and the eyes went round it").toBeGreaterThan(1);
});

test("driveFor drives by a set time: two seconds at full throttle is about two metres and a quarter a second, and steering turns it", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off drive=on");
  const result = await read(page, (el) => {
    const a = { ...el.vehicle! };
    el.driveFor(2, { throttle: 1, steer: 0 });
    const b = { ...el.vehicle! };
    el.driveFor(2, { throttle: 1, steer: 1 });
    const c = { ...el.vehicle! };
    return { speed: b.speed, run: b.distance - a.distance, turned: ((c.heading - b.heading + 540) % 360) - 180 };
  });
  // 1.1 m/s2 for two seconds is 2.2 m/s; the made-up ground's swell (slopes to 0.08) adds or takes up to 0.13 m/s2 of the Moon's gravity along the way, so 2.2 plus or minus 0.4
  expect(result.speed).toBeGreaterThan(1.8);
  expect(result.speed).toBeLessThan(2.6);
  expect(result.run).toBeGreaterThan(1.8);
  expect(result.run).toBeLessThan(3.1);
  expect(result.turned, "full right turns the heading to the right").toBeGreaterThan(20);
});

test("watching the landing: the clock starts at T+4:00 and runs, the report's moments are shown as they pass with the made curve said, and a seek goes to the touchdown where it stops and nothing is drawn", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off");
  await page.evaluate(() => {
    const log: string[] = [];
    Reflect.set(window, "__clock", log);
    document.querySelector("#test-surface")!.addEventListener("wakusei-landing-clock", (event) => {
      const c = (event as CustomEvent).detail.callout;
      if (c !== undefined) log.push(c.id);
    });
    document.querySelector("#test-surface")!.setAttribute("watch", "landing");
  });
  const start = await read(page, (el) => ({ ...el.landing!, text: el.shadowRoot!.getElementById("clock")!.textContent ?? "" }));
  expect(start.t).toBeGreaterThanOrEqual(240);
  expect(start.t, "it began at T+4:00").toBeLessThan(260);
  expect(start.playing).toBe(true);
  expect(start.camera).toBe("lander");
  // read the clock and pause in one call, then go to the high gate
  const high = await read(page, (el) => {
    el.pauseLanding();
    el.landingTime = 562;
    return { ...el.landing!, text: el.shadowRoot!.getElementById("clock")!.textContent ?? "", curve: el.shadowRoot!.getElementById("curve")!.textContent ?? "", callouts: [...el.shadowRoot!.querySelectorAll("#callouts li")].map((li) => li.textContent ?? "") };
  });
  expect(high.playing).toBe(false);
  expect(Math.abs(high.altitude - 2286)).toBeLessThan(1);
  expect(high.text).toContain("T+09:22");
  expect(high.text).toContain("110:19:15");
  expect(high.curve, "the made curve is said on the picture").toBe("Altitude and speed between the reported moments are a smooth curve of ours.");
  expect(high.callouts.at(-1)).toContain("High gate");
  // the touchdown: the dust call-out comes before it, and the clock stops
  const down = await read(page, (el) => {
    el.landingTime = 725;
    return { ...el.landing!, log: [...(Reflect.get(window, "__clock") as string[])] };
  });
  expect(down.altitude).toBe(0);
  expect(down.playing).toBe(false);
  expect(down.log.at(-1)).toBe("touchdown");
  expect(down.log).toContain("high-gate");
  // at the end nothing is drawn (that nothing happens: a wait to say so)
  let held = -1;
  let same = 0;
  await expect
    .poll(
      async () => {
        const now = await draws(page);
        same = now === held ? same + 1 : 0;
        held = now;
        return same;
      },
      { timeout: 120_000, intervals: [500] },
    )
    .toBeGreaterThanOrEqual(3);
  const rest = await draws(page);
  await page.waitForTimeout(1500);
  expect(await draws(page)).toBe(rest);
});

test("the descent says when it ends and what state it is in: wakusei-landing-state on play, pause, rate and camera, wakusei-landing-ended once at the touchdown", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off");
  await page.evaluate(() => {
    const log: string[] = [];
    Reflect.set(window, "__events", log);
    const el = document.querySelector("#test-surface")!;
    el.addEventListener("wakusei-landing-state", (event) => {
      const d = (event as CustomEvent).detail;
      log.push(`state:${d.playing ? "play" : "pause"}:${d.rate}:${d.camera}:${d.ended}`);
    });
    el.addEventListener("wakusei-landing-ended", (event) => log.push(`ended:${(event as CustomEvent).detail.t}`));
    el.setAttribute("watch", "landing");
  });
  const events = (): Promise<string[]> => page.evaluate(() => [...(Reflect.get(window, "__events") as string[])]);
  expect(await events(), "starting the watch is not a change of state").toEqual([]);
  // a change says so once; setting what it already is says nothing
  await read(page, (el) => {
    el.pauseLanding();
    el.pauseLanding();
    (el as unknown as { landingRate: number }).landingRate = 4;
    (el as unknown as { landingRate: number }).landingRate = 4;
    el.playLanding();
    el.playLanding();
    el.setAttribute("watch-camera", "ground");
  });
  expect(await events()).toEqual(["state:pause:1:lander:false", "state:pause:4:lander:false", "state:play:4:lander:false", "state:play:4:ground:false"]);
  // running into the touchdown: stopped, said once, and the end said once
  await read(page, (el) => {
    el.landingTime = 722;
    (el as unknown as { landingRate: number }).landingRate = 16;
  });
  await expect.poll(async () => (await events()).filter((e) => e.startsWith("ended")).length, { timeout: 120_000 }).toBe(1);
  const run = await events();
  expect(run.slice(-2)).toEqual(["state:pause:16:ground:true", "ended:725"]);
  expect(await read(page, (el) => el.landing!.playing)).toBe(false);
  // going to the touchdown again while it is there says nothing more; leaving it and arriving again ends it again
  await read(page, (el) => {
    el.landingTime = 725;
  });
  expect((await events()).filter((e) => e.startsWith("ended"))).toHaveLength(1);
  await read(page, (el) => {
    el.landingTime = 700;
    el.landingTime = 725;
  });
  expect((await events()).filter((e) => e.startsWith("ended"))).toHaveLength(2);
});

const MODEL = "/wakusei-planets/models/perseverance.glb";

test("drive-model draws NASA's Perseverance in place of the shapes: its wheels roll and its corner pivots steer with the drive, its eye is the seat view, and the drive takes its size", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, `shadows=off detail=off drive=on drive-model=${MODEL}`);
  await expect.poll(() => read(page, (el) => (el as unknown as { driveModel?: unknown }).driveModel !== undefined), { timeout: 120_000 }).toBe(true);
  const rolled = await read(page, (el) => {
    const e = el as unknown as { driveModel: { nodes: string[]; angles: Record<string, number>; rig: { track: number; wheelbase: number; wheelRadius: number; seat: number[] } }; driveFor(s: number, i: { throttle: number; steer: number }): boolean; vehicle: { spin: number[]; steer: number; y: number } };
    e.driveFor(1.5, { throttle: 1, steer: 0.6 });
    const model = e.driveModel;
    return { nodes: model.nodes, angles: model.angles, rig: model.rig, spin: e.vehicle.spin, steer: e.vehicle.steer };
  });
  for (const name of ["wheel-fl", "wheel-fr", "wheel-ml", "wheel-mr", "wheel-rl", "wheel-rr", "steer-fl", "steer-fr", "steer-rl", "steer-rr", "eye"]) expect(rolled.nodes, name).toContain(name);
  expect(rolled.rig.track, "the track is the model's (about 2.3 m between the wheels' middles), not the lunar rover's 1.9").toBeGreaterThan(2.1);
  expect(rolled.rig.track).toBeLessThan(2.7);
  expect(rolled.rig.wheelRadius, "a Mars wheel is about 0.26 m in radius").toBeGreaterThan(0.2);
  expect(rolled.rig.wheelRadius).toBeLessThan(0.35);
  expect(rolled.steer, "the steering has turned").toBeGreaterThan(0.1);
  expect(rolled.angles["wheel-fl"]).toBeCloseTo(rolled.spin[0]!, 9);
  expect(rolled.angles["wheel-rr"]).toBeCloseTo(rolled.spin[3]!, 9);
  expect(rolled.angles["wheel-ml"]).toBeCloseTo((rolled.spin[0]! + rolled.spin[2]!) / 2, 9);
  expect(rolled.angles["steer-fl"], "right is the model's -Y: the front pivots turn one way").toBeCloseTo(-rolled.steer, 9);
  expect(rolled.angles["steer-rr"], "the rear the other").toBeCloseTo(rolled.steer, 9);
  // the seat view takes the model's eye (the numbers are tested in test/rig.test.ts; here it is asked for with the model loaded)
  const seat = await read(page, (el) => {
    const e = el as unknown as { driveCamera: string; driveModel: { rig: { seat: number[] } } };
    e.driveCamera = "seat";
    return { camera: e.driveCamera, eye: e.driveModel.rig.seat };
  });
  expect(seat.camera).toBe("seat");
  expect(seat.eye[1], "Perseverance's eye is 1.95 m up").toBeCloseTo(1.95, 1);
  // it draws, and a drive after it still draws and says nothing wrong
  const before = await draws(page);
  const renders = await read(page, (el) => (el as unknown as { driveModel: { renders: number } }).driveModel.renders);
  await read(page, (el) => (el as unknown as { driveFor(s: number, i: { throttle: number; steer: number }): boolean }).driveFor(0.5, { throttle: 1, steer: 0 }));
  await drawnTo(page, before + 1);
  await expect.poll(() => read(page, (el) => (el as unknown as { driveModel: { renders: number } }).driveModel.renders), { message: "the model is drawn by the scene" }).toBeGreaterThan(renders);
  expect(errors).toEqual([]);
});

type Driven = { stats: { vehicleDrawn: boolean }; driveFor(seconds: number, input: { throttle: number; steer: number }): boolean; driveModel?: { nodes: string[]; angles: Record<string, number>; rig: { track: number; wheelbase: number; wheelRadius: number; seat: number[] }; renders: number } };

test("the vehicle is drawn at a site with nothing on the ground: Yutu's flat ground has its own shapes, and Perseverance's has its model", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // the Chang'e 3 site has no objects table: its rover used to be driven but never drawn
  await open(page, "shadows=off detail=off drive=on site=chang-e-3");
  expect(await read(page, (el) => (el as unknown as { objects: unknown[] }).objects.length), "the site has no things on the ground").toBe(0);
  await read(page, (el) => (el as unknown as Driven).driveFor(0.5, { throttle: 1, steer: 0 }));
  await expect.poll(() => read(page, (el) => (el as unknown as Driven).stats.vehicleDrawn), { timeout: 60_000 }).toBe(true);
  await page.evaluate(() => document.querySelector("#test-surface")!.remove());
  // the same with Perseverance's model: it is drawn by the scene, so its render count rises
  await open(page, `shadows=off detail=off drive=on site=perseverance drive-model=${MODEL}`);
  await expect.poll(() => read(page, (el) => (el as unknown as Driven).driveModel !== undefined), { timeout: 120_000 }).toBe(true);
  await read(page, (el) => (el as unknown as Driven).driveFor(0.5, { throttle: 1, steer: 0.3 }));
  await expect.poll(() => read(page, (el) => (el as unknown as Driven).driveModel!.renders), { timeout: 60_000 }).toBeGreaterThan(0);
  expect(await read(page, (el) => (el as unknown as Driven).stats.vehicleDrawn)).toBe(true);
  expect(errors).toEqual([]);
});

const LRV = "/wakusei-planets/models/apollo-lrv.glb";

test("drive-model draws the Apollo lunar rover from the museum's model: four wheels in steering pivots that roll and steer with the drive, its seat eye is the seat view, and the drive takes its size", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page, `shadows=off detail=off drive=on drive-model=${LRV}`);
  await expect.poll(() => read(page, (el) => (el as unknown as Driven).driveModel !== undefined), { timeout: 120_000 }).toBe(true);
  const rolled = await read(page, (el) => {
    const e = el as unknown as Driven & { vehicle: { steer: number; spin: number[] } };
    e.driveFor(1.5, { throttle: 1, steer: 0.6 });
    const model = e.driveModel!;
    return { nodes: model.nodes, angles: model.angles, rig: model.rig, spin: e.vehicle.spin, steer: e.vehicle.steer };
  });
  for (const name of ["wheel-fl", "wheel-fr", "wheel-rl", "wheel-rr", "steer-fl", "steer-fr", "steer-rl", "steer-rr", "seat-commander"]) expect(rolled.nodes, name).toContain(name);
  expect(rolled.nodes, "four wheels: no middle ones").not.toContain("wheel-ml");
  expect(rolled.rig.wheelRadius, "the rover's wheels are about 0.37 m in radius (0.81 m across)").toBeGreaterThan(0.3);
  expect(rolled.rig.wheelRadius).toBeLessThan(0.45);
  expect(rolled.rig.wheelbase, "the wheelbase is the model's, about 1.9 m").toBeGreaterThan(1.6);
  expect(rolled.rig.wheelbase).toBeLessThan(2.4);
  expect(rolled.steer, "the steering has turned").toBeGreaterThan(0.1);
  expect(rolled.angles["wheel-fl"]).toBeCloseTo(rolled.spin[0]!, 9);
  expect(rolled.angles["wheel-rr"]).toBeCloseTo(rolled.spin[3]!, 9);
  expect(rolled.angles["steer-fl"], "right is the model's -Y: the front pivots turn one way").toBeCloseTo(-rolled.steer, 9);
  expect(rolled.angles["steer-rr"], "the rear the other").toBeCloseTo(rolled.steer, 9);
  expect(rolled.rig.seat[1], "the commander's eye is 1.4 m up").toBeCloseTo(1.4, 1);
  const renders = await read(page, (el) => (el as unknown as Driven).driveModel!.renders);
  await read(page, (el) => (el as unknown as Driven).driveFor(0.5, { throttle: 1, steer: 0 }));
  await expect.poll(() => read(page, (el) => (el as unknown as Driven).driveModel!.renders), { message: "the model is drawn by the scene" }).toBeGreaterThan(renders);
  expect(errors).toEqual([]);
});

test("drive-model that cannot be loaded says so and the shapes are drawn: the drive goes on with the lunar rover's measures", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off drive=on");
  const said = await read(page, (el) => {
    const log: string[] = [];
    Reflect.set(window, "__model", log);
    el.addEventListener("wakusei-model", () => log.push("model"));
    el.addEventListener("wakusei-model-error", (event) => log.push(`error:${(event as CustomEvent).detail.url}`));
    el.setAttribute("drive-model", "/wakusei-planets/models/none.glb");
    return log.length;
  });
  expect(said).toBe(0);
  await expect.poll(() => page.evaluate(() => [...(Reflect.get(window, "__model") as string[])]), { timeout: 60_000 }).toEqual(["error:/wakusei-planets/models/none.glb"]);
  const after = await read(page, (el) => ({ model: (el as unknown as { driveModel?: unknown }).driveModel, driving: el.vehicle !== undefined }));
  expect(after).toEqual({ model: undefined, driving: true });
});

test("the ground camera stands 150 m north of the touchdown point, looking south at the lander, and watch-from moves it", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page, "shadows=off detail=off");
  const near = await read(page, (el) => {
    el.setAttribute("watch-camera", "ground");
    el.setAttribute("watch", "landing");
    el.pauseLanding();
    el.landingTime = 725;
    const lm = el.objects.find((o) => o.id === "lm")!;
    return { gap: Math.hypot(el.position.east - lm.east, el.position.north - lm.north), north: el.position.north - lm.north, azimuth: el.look.azimuth, fov: el.look.fov, camera: el.landing!.camera };
  });
  expect(near.camera).toBe("ground");
  expect(near.gap).toBeGreaterThan(149);
  expect(near.gap).toBeLessThan(151);
  expect(near.north, "north of it").toBeGreaterThan(149);
  expect(Math.abs(near.azimuth - 180), "looking south at it").toBeLessThan(5);
  expect(near.fov, "narrowed so that the stage is about a tenth of the picture").toBeLessThan(30);
  const east = await read(page, (el) => {
    el.setAttribute("watch-from", "300 90");
    const lm = el.objects.find((o) => o.id === "lm")!;
    return { gap: Math.hypot(el.position.east - lm.east, el.position.north - lm.north), east: el.position.east - lm.east };
  });
  expect(east.gap).toBeGreaterThan(299);
  expect(east.gap).toBeLessThan(301);
  expect(east.east, "bearing 90 is east").toBeGreaterThan(299);
});
