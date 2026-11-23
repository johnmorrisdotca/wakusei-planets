// The name written on a lumpy moon is written on a shell that clears its highest point, so no letter is hidden inside the surface; a smooth globe keeps its shell at 1. Chromium, drawing in software.
import "./load.ts";
import { expect, test } from "@playwright/test";

test("a name on a lumpy moon is written outside its highest point, and on a smooth globe at the surface", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-desk", "3D in software, Chromium only");
  await page.goto("/wakusei-planets/?body=thebe&look=realistic");
  const main = page.locator("#main");
  await main.evaluate((el) => el.setAttribute("body-label", "painted"));
  const shell = (): Promise<number | null> => main.evaluate((el) => (el as unknown as { stats: { label: { shell: number } | null } }).stats.label?.shell ?? null);
  await expect(main).toHaveAttribute("data-state", "live", { timeout: 90_000 }).catch(() => undefined);
  await main.hover();
  await expect.poll(shell, { timeout: 60_000 }).not.toBeNull();
  const lumpy = (await shell())!;
  expect(lumpy).toBeGreaterThan(1.02);
  await main.evaluate((el) => el.setAttribute("body", "jupiter"));
  await expect.poll(async () => (await shell()) !== null && (await shell()) !== lumpy, { timeout: 60_000 }).toBe(true);
  expect(await shell()).toBe(1);
});
