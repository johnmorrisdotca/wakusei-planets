// Import this in a spec to be able to try it on a busy machine: CPU_THROTTLE=4 runs its Chromium at a quarter of the speed (e2e/under-load.ts). Nothing happens without the variable.
import { test } from "@playwright/test";
import { underLoad } from "./under-load.ts";

test.beforeEach(async ({ page, browserName }) => {
  await underLoad(page, browserName);
});
