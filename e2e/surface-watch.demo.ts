// The watched Apollo 17 descent in a real browser (Chromium, drawn in software, over the made-up site of surface-fixture.ts): a drag turns the view in both cameras, playing and paused, and the turn stays through the frames that follow
// (MODULES-1546); and a made crater's floor does not change from one frame to the next while the descent plays (MODULES-1547): the same moment (the rate is the slowest, 0.25, so the clock hardly moves) is drawn and photographed six
// times and the lower half of each picture, where the ground is, is compared block by block with the one before. The pictures are written to test-results/evidence/ and attached, and CI uploads that folder.
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { routeSurface } from "./surface-fixture.ts";

test.describe.configure({ mode: "serial" });
test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-desk", "3D in software, Chromium only");
  // a slow machine: the page runs at a quarter of the speed, as in the other standing-view tests
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
});

type Surface = HTMLElement & {
  look: { azimuth: number; pitch: number; fov: number };
  stats: { quality: string; renderer?: { draws: number } };
  landing?: { t: number; playing: boolean; camera: string };
  landingTime: number;
  landingRate: number;
  pauseLanding(): void;
  playLanding(): void;
};

const view = (page: Page) => page.locator("#test-surface");
const read = <T>(page: Page, fn: (el: Surface) => T): Promise<T> => view(page).evaluate(fn as never) as Promise<T>;
const draws = (page: Page): Promise<number> => read(page, (el) => el.stats.renderer?.draws ?? 0);

/** The page with a view of its own at Apollo 17, watching the descent from `camera`, the clock at `t` seconds, running or held. */
async function watch(page: Page, attributes: string, camera: "lander" | "ground", t: number, playing: boolean): Promise<void> {
  await routeSurface(page);
  await page.setViewportSize({ width: 360, height: 300 });
  await page.goto("/wakusei-planets/surface.html");
  await page.evaluate(
    ({ text, camera, t }) => {
      document.querySelector("#surface")?.remove();
      const el = document.createElement("wakusei-surface");
      el.id = "test-surface";
      el.setAttribute("site", "apollo-17");
      el.setAttribute("tiles", "/wakusei-planets/tiles/");
      el.setAttribute("watch-camera", camera);
      for (const pair of text.split(" ")) {
        const [k, v] = pair.split("=");
        if (k) el.setAttribute(k, v ?? "");
      }
      el.style.cssText = "width: 320px";
      document.querySelector("main")!.prepend(el);
      void t;
    },
    { text: attributes, camera, t },
  );
  await expect(view(page)).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  await read(page, (el) => {
    el.setAttribute("watch", "landing");
  });
  await read(page, (el) => el.pauseLanding());
  await read(page, (el) => {
    el.landingTime = 0;
  });
  await page.evaluate((seconds) => {
    (document.querySelector("#test-surface") as Surface).landingTime = seconds;
  }, t);
  if (playing) await read(page, (el) => el.playLanding());
  await expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(1);
}

const azimuth = (page: Page): Promise<number> => read(page, (el) => el.look.azimuth);
const pitch = (page: Page): Promise<number> => read(page, (el) => el.look.pitch);
/** The signed shortest turn from `a` to `b`, degrees. */
const turn = (a: number, b: number): number => ((b - a + 540) % 360) - 180;

/** A drag of the view: the pointer goes down in the middle, moves across by `dx` and down by `dy` pixels, and goes up. */
async function drag(page: Page, dx: number, dy: number): Promise<void> {
  const box = (await view(page).boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 3 });
  await page.mouse.move(x + dx, y + dy, { steps: 3 });
  await page.mouse.up();
}

for (const camera of ["lander", "ground"] as const) {
  for (const playing of [true, false]) {
    test(`a drag turns the view from the ${camera === "lander" ? "window" : "ground camera"} while the descent is ${playing ? "playing" : "held"}, and the turn stays through the frames after it (MODULES-1546)`, async ({ page }) => {
      test.setTimeout(300_000);
      await watch(page, "shadows=off detail=off", camera, camera === "ground" ? 700 : 400, playing);
      const box = (await view(page).boundingBox())!;
      const fov = await read(page, (el) => el.look.fov);
      const perPixel = fov / box.height;
      const before = { azimuth: await azimuth(page), draws: await draws(page) };
      // a hand drags to the right: the view turns to the left, as in the standing view; and down, which tips it up
      await drag(page, 100, 0);
      const after = { azimuth: await azimuth(page), draws: await draws(page) };
      const expected = -100 * perPixel;
      expect(turn(before.azimuth, after.azimuth), `the drag turned the view by about ${expected.toFixed(1)} degrees`).toBeLessThan(expected * 0.6);
      expect(Math.abs(turn(before.azimuth, after.azimuth) - expected)).toBeLessThan(Math.abs(expected) * 0.4 + 2);
      expect(await read(page, (el) => el.landing!.playing)).toBe(playing);
      // the frames that follow do not put it back: the clock goes on (or does not), five more are drawn, and the view is where the drag left it
      if (playing) await expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThanOrEqual(after.draws + 5);
      else await page.waitForTimeout(800);
      const later = await azimuth(page);
      expect(Math.abs(turn(after.azimuth, later)), "the turn stays").toBeLessThan(3);
      // a drag down tips the view up, and it stays too. The pitch is read here, not from `before`: while the descent plays, the ground camera looks up at a lander that is falling, so its own pitch falls by several degrees across the azimuth drag and the frames that follow. Counting that fall made a 6 degree tip look like less than 2 on a slow run (MODULES-1748).
      const pitchBefore = await pitch(page);
      await drag(page, 0, 40);
      const tipped = await pitch(page);
      expect(tipped - pitchBefore, "dragging down tips the view up").toBeGreaterThan(2);
      if (playing) await expect.poll(() => draws(page), { timeout: 120_000 }).toBeGreaterThanOrEqual((await draws(page)) + 3);
      expect(Math.abs((await pitch(page)) - tipped), "the tip stays").toBeLessThan(3);
    });
  }
}

/** The mean brightness of each 20 by 20 pixel block of the lower half of a picture, left to right and top to bottom, and the share of its pixels that are almost black. */
async function groundBlocks(page: Page, png: Buffer): Promise<{ blocks: number[]; black: number; width: number; height: number }> {
  return page.evaluate(async (b64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    const top = Math.floor(image.height / 2);
    const data = ctx.getImageData(0, top, image.width, image.height - top).data;
    const w = image.width;
    const h = image.height - top;
    const blocks: number[] = [];
    let black = 0;
    for (let by = 0; by + 20 <= h; by += 20) {
      for (let bx = 0; bx + 20 <= w; bx += 20) {
        let sum = 0;
        for (let y = by; y < by + 20; y += 1) {
          for (let x = bx; x < bx + 20; x += 1) {
            const i = (y * w + x) * 4;
            const l = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
            sum += l;
            if (l < 8) black += 1;
          }
        }
        blocks.push(sum / 400);
      }
    }
    return { blocks, black: black / (w * h), width: image.width, height: h };
  }, png.toString("base64"));
}

test("two frames of the same moment of the playing descent match on the ground, a made crater's floor included: it does not flicker between black and its shadow (MODULES-1547)", async ({ page }, testInfo) => {
  test.setTimeout(480_000);
  // the shadows and the made detail are on, as on the site; the ground camera, at T+11:20 when the lunar module is 85 m up, and still more than 20 m up when the six pictures are taken (the dust of the blast starts at 21 m and is made with random grains), and the view tipped down by a drag so that the ground fills the lower half
  await watch(page, "", "ground", 680, false);
  await read(page, (el) => {
    el.landingRate = 0.25;
  });
  // each drag up tips the view down by a few degrees (the pitch of the turn is kept within 60 degrees): drag until the lower half of the picture is ground
  for (let n = 0; n < 6 && (await pitch(page)) > -6; n += 1) await drag(page, 0, -150);
  expect(await pitch(page), "the view looks down at the ground").toBeLessThan(-4);
  // the words the page writes over the picture are put out of the way: the pictures are of the ground, and the clock in the words changes every second
  await read(page, (el) => {
    for (const id of ["landing", "note", "status"]) el.shadowRoot!.getElementById(id)!.style.visibility = "hidden";
  });
  await read(page, (el) => el.playLanding());
  mkdirSync("test-results/evidence", { recursive: true });
  const frames: { blocks: number[]; black: number; clock: number; quality: string }[] = [];
  for (let n = 1; n <= 6; n += 1) {
    const sent = await draws(page);
    await expect.poll(() => draws(page), { timeout: 240_000 }).toBeGreaterThanOrEqual(sent + 2);
    const state = await read(page, (el) => ({ quality: el.stats.quality, t: el.landing!.t, playing: el.landing!.playing }));
    expect(state.playing, "the descent is playing").toBe(true);
    const png = await view(page).screenshot();
    const name = `crater-frame-${n}.png`;
    writeFileSync(`test-results/evidence/${name}`, png);
    await testInfo.attach(name, { body: png, contentType: "image/png" });
    const stats = await groundBlocks(page, png);
    frames.push({ blocks: stats.blocks, black: stats.black, clock: state.t, quality: state.quality });
  }
  // the same moment held, for the eye: the draws stop (three reads the same) and the picture is taken. A slow machine steps its quality of rest down to the quality of motion, so the quality is not asserted here
  await read(page, (el) => el.pauseLanding());
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
      { timeout: 240_000, intervals: [700] },
    )
    .toBeGreaterThanOrEqual(3);
  const rest = await view(page).screenshot();
  writeFileSync("test-results/evidence/crater-frame-rest.png", rest);
  await testInfo.attach("crater-frame-rest.png", { body: rest, contentType: "image/png" });

  const report = frames.map((f, i) => {
    const previous = frames[i - 1];
    const diffs = previous === undefined ? [] : f.blocks.map((b, k) => Math.abs(b - previous.blocks[k]!));
    return { frame: i + 1, clock: Number(f.clock.toFixed(2)), quality: f.quality, black: Number(f.black.toFixed(4)), meanDiff: diffs.length === 0 ? 0 : diffs.reduce((a, b) => a + b, 0) / diffs.length, maxDiff: diffs.length === 0 ? 0 : Math.max(...diffs) };
  });
  writeFileSync("test-results/evidence/crater-numbers.json", JSON.stringify(report, null, 2));
  await testInfo.attach("crater-numbers.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(frames[0]!.blocks.length, "a ground to compare").toBeGreaterThan(30);
  for (const f of report.slice(1)) {
    expect(f.meanDiff, `frame ${f.frame}: the ground's blocks differ from the frame before by ${f.meanDiff.toFixed(2)} on average`).toBeLessThan(6);
    expect(f.maxDiff, `frame ${f.frame}: no block of the ground changes by more than 50 of 255 (a crater's floor going black)`).toBeLessThan(50);
    expect(Math.abs(f.black - report[f.frame - 2]!.black), `frame ${f.frame}: the share of black pixels hardly changes`).toBeLessThan(0.02);
  }
});
