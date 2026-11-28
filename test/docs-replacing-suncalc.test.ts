// The code in the "Replacing suncalc" guide (English and Japanese) is run, not just shown: each ts block is written to a temporary file with the package specifier pointed at src/, then imported.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "..");
const PACKAGE = "@johnmorrisdotca/wakusei-planets/suncalc";

for (const file of ["docs/guides/replacing-suncalc.md", "docs/guides/ja/replacing-suncalc.md"]) {
  test(`every ts example in ${file} runs and prints what it should`, async () => {
    const blocks = [...readFileSync(join(root, file), "utf8").matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]!);
    assert.equal(blocks.length, 4, "the four examples are there");
    const dir = mkdtempSync(join(tmpdir(), "suncalc-guide-"));
    const logged: string[] = [];
    const log = console.log;
    try {
      for (const [i, code] of blocks.entries()) {
        const source = code
          .replaceAll(`"${PACKAGE}/legacy"`, JSON.stringify(pathToFileURL(join(root, "src/suncalc-legacy.ts")).href))
          .replaceAll(`"${PACKAGE}"`, JSON.stringify(pathToFileURL(join(root, "src/suncalc.ts")).href));
        assert.ok(!source.includes(PACKAGE), "every import was pointed at src/");
        const path = join(dir, `block${i}.ts`);
        writeFileSync(path, source);
        console.log = (...args: unknown[]): void => void logged.push(args.map(String).join(" "));
        await import(pathToFileURL(path).href);
      }
    } finally {
      console.log = log;
      rmSync(dir, { recursive: true, force: true });
    }
    assert.match(logged[0]!, /^2026-06-21T0[23]:\d\d:\d\d\.\d{3}Z 62$/, "London's sunrise on the solstice and the Sun's altitude at noon, in degrees");
    assert.match(logged[1]!, /^-?\d\.\d\d \d\.\d\d$/, "legacy: radians");
    assert.match(logged[2]!, /^\d+ 62$/, "converted back to degrees from north and from radians");
    assert.equal(logged[3], "true", "no sunrise at Tromsø in the midnight Sun is an invalid Date");
    assert.equal(logged[4], "16.45 12:16:26", "the sundial is ahead of Greenwich mean solar time");
  });
}
