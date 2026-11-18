// Every e2e spec can be tried on a busy machine (MODULES-1590). `import "./load.ts"` in a spec puts CPU_THROTTLE on its Chromium (e2e/under-load.ts); a spec that skips it is silently never tried that way.
// This reads the spec files Playwright would run (testDir and testMatch of playwright.config.ts) and names each one that does not take the switch. It needs no browser, so `pnpm check` runs it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import config from "../playwright.config.ts";

// These specs may go without the switch, each for a reason:
const EXEMPT: Record<string, string> = {
  "docs-site.demo.mjs": "the family's own file, held to one hash by test/docs-site.test.ts: it cannot be edited here",
  "craft-freeze.demo.ts": "a freeze test: it counts what the page schedules and draws, on a clock the test holds",
  "earth-places-freeze.demo.ts": "a freeze test: it counts draws and graphics objects",
  "flat-freeze.demo.ts": "a freeze test: it counts draws and graphics objects",
  "lineup-freeze.demo.ts": "a freeze test: it counts draws and graphics objects",
};

// What counts as taking the switch: importing load.ts (it applies it for every test), importing under-load.ts (and calling it), or sending the throttle itself.
const TAKES_SWITCH = [/\bimport\s*(?:[^;"']*?\sfrom\s*)?["']\.\/(?:load|under-load)\.ts["']/, /Emulation\.setCPUThrottlingRate/];

const root = new URL("..", import.meta.url).pathname;
const toRegExp = (glob: string): RegExp => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*")}$`);
const patterns = [config.testMatch ?? []].flat().map((m) => (typeof m === "string" ? toRegExp(m) : m));

function specs(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? specs(join(dir, e.name)) : patterns.some((p) => p.test(e.name)) ? [join(dir, e.name)] : []));
}

test("every e2e spec takes the CPU_THROTTLE switch", () => {
  const found = specs(config.testDir ?? ".");
  assert.ok(found.length > 50, `only ${found.length} specs found: testDir or testMatch in playwright.config.ts changed shape`);
  const missing = found.filter((f) => !(f.split("/").pop()! in EXEMPT) && !TAKES_SWITCH.some((p) => p.test(readFileSync(join(root, f), "utf8"))));
  assert.deepEqual(missing, [], `these specs do not take CPU_THROTTLE: add  import "./load.ts";  at the top of each (or list it in EXEMPT in test/e2e-load.test.ts with the reason):\n  ${missing.join("\n  ")}`);
});

test("every exempt spec exists and still lacks the switch", () => {
  const names = new Map(specs(config.testDir ?? ".").map((f) => [f.split("/").pop()!, f]));
  for (const name of Object.keys(EXEMPT)) {
    const f = names.get(name);
    assert.ok(f, `${name} is exempt but is not a spec any more: remove it from EXEMPT`);
    assert.ok(!TAKES_SWITCH.some((p) => p.test(readFileSync(join(root, f), "utf8"))), `${name} takes the switch now: remove it from EXEMPT`);
  }
});
