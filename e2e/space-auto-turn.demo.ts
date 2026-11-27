import "./load.ts";
import { expect, test } from "@playwright/test";
import { drawnAfter, NOV2, openSpace, SPACE } from "./space-ui.ts";

test.use({ reducedMotion: "no-preference" });

test("the space controls' angle Auto-turn keeps two fixed landmarks in left-to-right order", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("chromium"), "3D in software, Chromium only");
  await openSpace(page, `t=${NOV2}&speed=0`);
  const controls = page.locator("#controls");
  await controls.evaluate((el) => el.setAttribute("speed", "8"));
  const space = page.locator(SPACE);
  const before = await space.evaluate((el) => {
    const { draws } = Reflect.get(el, "stats");
    const controller = Reflect.get(document.querySelector("#controls")!, "controller");
    controller.set({ yaw: 2, tilt: 0, roll: 0 }, true, "set");
    return draws;
  });
  await drawnAfter(page, before, "setting the start angle");

  const samples = await space.evaluate(async (el) => {
    const bar = document.querySelector("#controls")!;
    const controller = Reflect.get(bar, "controller");
    const play = bar.shadowRoot!.querySelector<HTMLButtonElement>('[data-b="play"]')!;
    const { position, up, forward } = Reflect.get(el, "stats").camera;
    const cross = (a: number[], b: number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
    const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);
    const right = cross(forward, up);
    const landmarks = [-0.12, 0.12].map((offset) => position.map((p: number, i: number) => p + 100_000 * (forward[i] + offset * right[i]!)));
    const sample = () => {
      const { position, up, forward, width, height, fov } = Reflect.get(el, "stats").camera;
      const right = cross(forward, up);
      const halfHeight = Math.tan(fov * Math.PI / 360);
      const xs = landmarks.map((point) => {
        const ray = point.map((p: number, i: number) => p - position[i]);
        return dot(ray, right) / (dot(ray, forward) * halfHeight * width / height);
      });
      const { yaw, tilt, roll } = controller.state;
      return { yaw, tilt, roll, xs, forwardUp: forward[1], screenUp: up[1] };
    };
    const readings = [sample()];
    let draws = Reflect.get(el, "stats").draws;
    play.click();
    const started = performance.now();
    while (Math.abs(controller.state.yaw - readings[0]!.yaw) < 5 && performance.now() - started < 4000) {
      await new Promise(requestAnimationFrame);
      if (Reflect.get(el, "stats").draws === draws) continue;
      draws = Reflect.get(el, "stats").draws;
      readings.push(sample());
    }
    play.click();
    return readings;
  });
  expect(samples.length).toBeGreaterThan(4);
  expect(Math.abs(samples.at(-1)!.yaw - samples[0]!.yaw)).toBeGreaterThan(3);
  for (const { tilt, roll, xs, forwardUp, screenUp } of samples) {
    expect(tilt).toBe(0);
    expect(roll).toBe(0);
    expect(Math.abs(forwardUp)).toBeLessThanOrEqual(Math.cos(Math.PI / 18));
    expect(screenUp).toBeGreaterThan(0);
    expect(xs[0]).toBeGreaterThan(-1);
    expect(xs[1]).toBeLessThan(1);
    expect(xs[0]).toBeLessThan(xs[1]!);
  }
});

test("the first draw of a glide keeps the roll the reader set", async ({ page }, info) => {
  test.skip(!info.project.name.startsWith("chromium"), "3D in software, Chromium only");
  await openSpace(page, `t=${NOV2}`);
  const space = page.locator(SPACE);
  const before = await space.evaluate((el) => {
    const { draws } = Reflect.get(el, "stats");
    const controller = Reflect.get(document.querySelector("#controls")!, "controller");
    controller.set({ yaw: 0, tilt: 0, roll: 30 }, true, "set");
    return draws;
  });
  await drawnAfter(page, before, "setting the reader's roll");
  const { start, first } = await space.evaluate(async (el) => {
    const sample = () => {
      const { camera, travelling } = Reflect.get(el, "stats");
      // With world north projected into the picture, its two components give the camera's roll.
      const { forward: f, up: u } = camera;
      const roll = Math.atan2(f[2] * u[0] - f[0] * u[2], u[1]) * 180 / Math.PI;
      return { roll, progress: travelling?.progress ?? null };
    };
    const start = sample();
    const moved = new Promise<ReturnType<typeof sample>>((resolve) => {
      el.addEventListener("wakusei-camera", function read() {
        const first = sample();
        if (first.progress === null) return;
        el.removeEventListener("wakusei-camera", read);
        resolve(first);
      });
    });
    Reflect.get(el, "goTo").call(el, "mars", { transition: "direct", duration: 9000 });
    return { start, first: await moved };
  });
  expect(Math.abs(start.roll)).toBeCloseTo(30);
  expect(first.progress).toBeLessThan(0.2);
  expect(Math.abs(first.roll - start.roll)).toBeLessThan(3);
});
