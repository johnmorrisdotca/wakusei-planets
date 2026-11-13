// A long run: the demo plays through every body, with the date running, for SOAK_MINUTES (ten by default; the CI run is one). The JavaScript heap, the GPU objects and the contexts must be flat.
import { COUNT_SCRIPT, GPU_KINDS, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test } from "@playwright/test";
import "./load.ts";

const MINUTES = Number(process.env.SOAK_MINUTES ?? 10);
test.use({ reducedMotion: "no-preference" });

test(`${MINUTES} minutes of changes leave memory, GPU objects and contexts flat`, async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/?body=jupiter&sky=real&moons=1&play=on&speed=3600");
  const main = page.locator("#main");
  await main.hover();
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const heap = () => page.evaluate(() => (globalThis as unknown as { gc?: () => void }).gc?.()).then(() => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize));
  const ids = ["jupiter", "saturn", "mars", "earth", "neptune", "venus", "sun", "pluto", "uranus", "mercury"];
  let i = 0;
  // the warm-up goes to every body the walk can reach, twice round (the second time with the first's shaders and pictures held), and waits at each for it to be live and for the draws to hold still: every lazy thing a body makes is made before the count
  for (let round = 0; round < 2; round += 1) {
    for (const id of ids) {
      await page.locator(`.tile[data-body="${id}"]`).click();
      await main.hover();
      await expect(main).toHaveAttribute("data-state", "live", { timeout: 60_000 });
      await expect.poll(async () => (await readCounts(page)).draws, { timeout: 60_000 }).toBeGreaterThan(0);
    }
  }
  const rest = async () => {
    // the same body is live when we count, so the same shaders and buffers are held
    await page.locator('.tile[data-body="jupiter"]').click();
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 60_000 });
    // the date runs, so the draws do not hold still: wait for the objects to hold still
    let last = -1;
    let same = 0;
    await expect.poll(async () => {
      const now = gpuObjects(await readCounts(page));
      same = now === last ? same + 1 : 0;
      last = now;
      return same;
    }, { timeout: 60_000, intervals: [500], message: "the graphics objects held still" }).toBeGreaterThanOrEqual(4);
  };
  await rest();
  const start = { heap: await heap(), counts: await readCounts(page) };
  const end = Date.now() + MINUTES * 60_000;
  while (Date.now() < end) {
    await page.locator(`.tile[data-body="${ids[i++ % ids.length]}"]`).click();
    await main.hover();
    // the walk's own pace: a soak is a length of time
    await page.waitForTimeout(900);
  }
  await rest();
  const stop = { heap: await heap(), counts: await readCounts(page) };
  console.log(`soak ${MINUTES} min: heap ${(start.heap / 1048576).toFixed(1)} -> ${(stop.heap / 1048576).toFixed(1)} MB, GPU objects ${gpuObjects(start.counts)} -> ${gpuObjects(stop.counts)}, contexts ${stop.counts.contexts}`);
  expect(stop.counts.contexts).toBe(1);
  expect(gpuObjects(stop.counts)).toBeLessThanOrEqual(gpuObjects(start.counts) + 4);
  expect(stop.heap).toBeLessThan(start.heap * 1.25 + 3 * 1048576);
});

test(`${MINUTES} minutes in the space view, going from the Earth to the planets and back with the clock running, leave memory, GPU objects and contexts flat`, async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z&play=on&speed=3600");
  const sky = page.locator("wakusei-space");
  await expect(sky).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const heap = () => page.evaluate(() => (globalThis as unknown as { gc?: () => void }).gc?.()).then(() => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize));
  const places = ["Moon", "Sun", "Inner planets", "Whole solar system", "Jupiter and its moons", "Earth"];
  const toggles: readonly (readonly [string, string])[] = [["Scale", "True"], ["Look", "Painted"], ["Light", "Always lit"], ["Scale", "Compressed"], ["Look", "Realistic"], ["Light", "The Sun's"]];
  let i = 0;
  const step = async () => {
    const drawsAtStep = await sky.evaluate((el) => Reflect.get(el, "stats").draws as number);
    await page.getByRole("group", { name: "Go to" }).getByRole("button", { name: places[i % places.length]!, exact: true }).dispatchEvent("click");
    const [group, name] = toggles[i % toggles.length]!;
    await page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click");
    if (i % 3 === 0) await page.getByRole("group", { name: "Ride along" }).getByRole("button", { name: ["The Moon", "Mars", "Io, over Jupiter", "Off"][(i / 3) % 4]!, exact: true }).dispatchEvent("click");
    i += 1;
    // on to the next when the view has drawn the change and a little more (the clock runs, so it keeps drawing), not after a sleep
    await expect.poll(() => sky.evaluate((el) => Reflect.get(el, "stats").draws as number), { timeout: 60_000 }).toBeGreaterThan(drawsAtStep + 2);
  };
  // the warm-up is one whole period of the walk (the places, the toggles and the rides come round together every twelve steps), twice: every lazy thing the walk can touch is made before the count
  for (let k = 0; k < 24; k += 1) await step();
  // A body's shader is compiled the first time it is drawn and kept until the look changes: a bounded cache (the bodies and moons of the page). So the count is taken from a state that is the same every time:
  // first scale and light, riding nothing, the Earth reached (the glide over), then the look changed to painted and back so every body is made again with only the Earth's view in sight, and the sky held at the date the page opened on.
  const rest = async () => {
    for (const [group, name] of [["Ride along", "Off"], ["Scale", "Compressed"], ["Light", "The Sun's"], ["Go to", "Earth"]] as const) {
      const before = await sky.evaluate((el) => Reflect.get(el, "stats").draws as number);
      await page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await expect.poll(() => sky.evaluate((el) => Reflect.get(el, "stats").draws as number), { timeout: 60_000 }).toBeGreaterThan(before);
    }
    await expect.poll(() => sky.evaluate((el) => Reflect.get(el, "stats").ride.gliding), { timeout: 60_000 }).toBe(false);
    // a look is remade only by a draw made with it: wait for that draw, not a clock, or on a slow machine the two looks go by with no draw between and the bodies a walk made are kept (CI counted 104, 100 and 143 in three walks)
    for (const name of ["Painted", "Realistic"]) {
      const before = await sky.evaluate((el) => Reflect.get(el, "stats").draws as number);
      await page.getByRole("group", { name: "Look" }).getByRole("button", { name, exact: true }).dispatchEvent("click");
      await expect.poll(() => sky.evaluate((el) => Reflect.get(el, "stats").draws as number), { timeout: 60_000 }).toBeGreaterThan(before);
    }
    await sky.evaluate((el) => {
      Reflect.set(el, "speed", 0);
      Reflect.set(el, "time", Date.UTC(2026, 10, 2, 14));
    });
    // the pictures and moons let go over a few seconds: wait until the count has stopped moving (four reads in a row), never past a minute
    let last = -1;
    let same = 0;
    await expect.poll(async () => {
      const now = gpuObjects(await readCounts(page));
      same = now === last ? same + 1 : 0;
      last = now;
      return same;
    }, { timeout: 60_000, intervals: [500], message: "the graphics objects held still" }).toBeGreaterThanOrEqual(4);
  };
  const run = () => sky.evaluate((el) => Reflect.set(el, "speed", 3600));
  const kinds = (c: Awaited<ReturnType<typeof readCounts>>) => JSON.stringify(Object.fromEntries(GPU_KINDS.map((k) => [k, c.created[k] - c.deleted[k]])));
  await rest();
  const start = { heap: await heap(), counts: await readCounts(page) };
  await run();
  // A leak that depends on timing (a picture arriving as a body is let go) shows in some walks and not in others, so every walk is counted on its own, against the start, and the first one over fails.
  const end = Date.now() + MINUTES * 60_000;
  let walks = 0;
  while (Date.now() < end || walks < 3) {
    for (let k = 0; k < places.length; k += 1) await step();
    walks += 1;
    await rest();
    const counts = await readCounts(page);
    const held = await sky.evaluate((el) => { const s = Reflect.get(el, "stats"); return { ...s.bodies, camera: s.camera.position.map((n: number) => Math.round(n * 100) / 100) }; });
    console.log(`space soak walk ${walks}: ${gpuObjects(counts)} (start ${gpuObjects(start.counts)}), ${kinds(counts)}, ${JSON.stringify(held)}`);
    expect(gpuObjects(counts), `walk ${walks}, started ${kinds(start.counts)}, now ${kinds(counts)}`).toBeLessThanOrEqual(gpuObjects(start.counts) + 4);
    await run();
  }
  const stop = { heap: await heap(), counts: await readCounts(page) };
  console.log(`space soak ${MINUTES} min, ${walks} walks, before ${kinds(start.counts)}, after ${kinds(stop.counts)}`);
  console.log(`space soak ${MINUTES} min: heap ${(start.heap / 1048576).toFixed(1)} -> ${(stop.heap / 1048576).toFixed(1)} MB, GPU objects ${gpuObjects(start.counts)} -> ${gpuObjects(stop.counts)}, contexts ${stop.counts.contexts}`);
  expect(stop.counts.contexts).toBe(1);
  expect(gpuObjects(stop.counts)).toBeLessThanOrEqual(gpuObjects(start.counts) + 4);
  expect(stop.heap).toBeLessThan(start.heap * 1.25 + 3 * 1048576);
});
