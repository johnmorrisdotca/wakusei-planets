// A long run: the demo plays through every body, with the date running, for SOAK_MINUTES (ten by default; the CI run is one). The JavaScript heap, the GPU objects and the contexts must be flat.
import { COUNT_SCRIPT, gpuObjects, readCounts } from "@johnmorrisdotca/kazoku-ui/testing";
import { expect, test } from "@playwright/test";

const MINUTES = Number(process.env.SOAK_MINUTES ?? 10);
test.use({ reducedMotion: "no-preference" });

test(`${MINUTES} minutes of changes leave memory, GPU objects and contexts flat`, async ({ page }) => {
  await page.addInitScript(COUNT_SCRIPT);
  await page.goto("/wakusei-planets/?body=jupiter&sky=real&moons=1&speed=3600");
  const main = page.locator("#main");
  await main.hover();
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const heap = () => page.evaluate(() => (globalThis as unknown as { gc?: () => void }).gc?.()).then(() => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize));
  const ids = ["jupiter", "saturn", "mars", "earth", "neptune", "venus", "sun", "pluto", "uranus", "mercury"];
  let i = 0;
  const warm = Date.now() + 60_000;
  while (Date.now() < warm) {
    await page.locator(`.tile[data-body="${ids[i++ % ids.length]}"]`).click();
    await main.hover();
    await page.waitForTimeout(700);
  }
  const rest = async () => {
    // the same body is live when we count, so the same shaders and buffers are held
    await page.locator('.tile[data-body="jupiter"]').click();
    await main.hover();
    await expect(main).toHaveAttribute("data-state", "live", { timeout: 60_000 });
    await page.waitForTimeout(3000);
  };
  await rest();
  const start = { heap: await heap(), counts: await readCounts(page) };
  const end = Date.now() + MINUTES * 60_000;
  while (Date.now() < end) {
    await page.locator(`.tile[data-body="${ids[i++ % ids.length]}"]`).click();
    await main.hover();
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
  await page.goto("/wakusei-planets/space.html?t=2026-11-02T14:00Z&speed=3600");
  const sky = page.locator("wakusei-space");
  await expect(sky).toHaveAttribute("data-state", "live", { timeout: 120_000 });
  const heap = () => page.evaluate(() => (globalThis as unknown as { gc?: () => void }).gc?.()).then(() => page.evaluate(() => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize));
  const places = ["Moon", "Sun", "Inner planets", "Whole solar system", "Jupiter and its moons", "Earth"];
  const toggles: readonly (readonly [string, string])[] = [["Scale", "True"], ["Look", "Painted"], ["Earth's light", "Always lit"], ["Scale", "Compressed"], ["Look", "Realistic"], ["Earth's light", "The Sun's"]];
  let i = 0;
  const step = async () => {
    await page.getByRole("group", { name: "Go to" }).getByRole("button", { name: places[i % places.length]!, exact: true }).dispatchEvent("click");
    const [group, name] = toggles[i % toggles.length]!;
    await page.getByRole("group", { name: group }).getByRole("button", { name, exact: true }).dispatchEvent("click");
    i += 1;
    await page.waitForTimeout(900);
  };
  const warm = Date.now() + 60_000;
  while (Date.now() < warm) await step();
  const rest = async () => {
    await page.getByRole("group", { name: "Go to" }).getByRole("button", { name: "Earth", exact: true }).dispatchEvent("click");
    await page.waitForTimeout(3000);
  };
  await rest();
  const start = { heap: await heap(), counts: await readCounts(page) };
  const end = Date.now() + MINUTES * 60_000;
  while (Date.now() < end) await step();
  await rest();
  const stop = { heap: await heap(), counts: await readCounts(page) };
  console.log(`space soak ${MINUTES} min: heap ${(start.heap / 1048576).toFixed(1)} -> ${(stop.heap / 1048576).toFixed(1)} MB, GPU objects ${gpuObjects(start.counts)} -> ${gpuObjects(stop.counts)}, contexts ${stop.counts.contexts}`);
  expect(stop.counts.contexts).toBe(1);
  expect(gpuObjects(stop.counts)).toBeLessThanOrEqual(gpuObjects(start.counts) + 4);
  expect(stop.heap).toBeLessThan(start.heap * 1.25 + 3 * 1048576);
});
