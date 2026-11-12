// The demo's own tests: a real browser, real taps. `pnpm test:demo` builds the site and runs them; `pnpm test:freeze` runs the freeze test alone.
// The server is scripts/dev.ts on port 8226, at the site's real address /wakusei-planets/: this package's ports are 8225 to 8249, and tests use 8226.
// Every Chromium project draws WebGL in software, never on the machine's graphics card. WebKit has no software switch, so off CI its projects skip the pages that draw WebGL (the freeze test).
import { SOFTWARE_GL_ARGS } from "@johnmorrisdotca/kazoku-ui/testing";
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_PORT ?? 8226);
const phone = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const gl = { launchOptions: { args: [...SOFTWARE_GL_ARGS, "--enable-precise-memory-info", "--js-flags=--expose-gc"] } };
const others = ["freeze.demo.ts", "lineup-freeze.demo.ts", "earth-places-freeze.demo.ts", "soak.demo.ts"];

export default defineConfig({
  globalSetup: "@johnmorrisdotca/kazoku-ui/testing/global-setup",
  testDir: "e2e",
  testMatch: ["*.demo.ts", "*.demo.mjs"],
  fullyParallel: false,
  forbidOnly: true,
  // A hosted runner has two cores and draws 3D in software: one test at a time, with room for it.
  workers: 1,
  timeout: process.env.CI ? 180_000 : 120_000,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, reducedMotion: "reduce", locale: "en-US" },
  webServer: { command: "node scripts/dev.ts", env: { PORT: String(port) }, url: `http://127.0.0.1:${port}/wakusei-planets/`, reuseExistingServer: false },
  projects: [
    { name: "chromium-desk", testIgnore: others, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, ...gl } },
    { name: "chromium-phone", testIgnore: others, use: { ...devices["Desktop Chrome"], ...phone, ...gl } },
    // WebKit on a desktop viewport with touch: `isMobile` is Chromium's to honour.
    { name: "webkit-desk", testIgnore: others, use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
    { name: "webkit-phone", testIgnore: others, use: { ...devices["Desktop Safari"], viewport: phone.viewport, hasTouch: true } },
    { name: "freeze", testMatch: ["freeze.demo.ts", "lineup-freeze.demo.ts", "earth-places-freeze.demo.ts"], use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, ...gl } },
    { name: "soak", testMatch: "soak.demo.ts", timeout: (Number(process.env.SOAK_MINUTES ?? 10) + 4) * 60_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, ...gl } },
  ],
});
