// A busy machine, on demand: with CPU_THROTTLE=4 a Chromium page runs at a quarter of its speed (CDP Emulation.setCPUThrottlingRate), the way the tests are tried before they are handed in (--repeat-each=5). Off by default.
import type { Page } from "@playwright/test";

export async function underLoad(page: Page, browserName: string): Promise<void> {
  const rate = Number(process.env["CPU_THROTTLE"] ?? 0);
  if (!(rate > 1) || browserName !== "chromium") return;
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate });
}
