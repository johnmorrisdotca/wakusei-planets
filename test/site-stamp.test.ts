// A built page names its build on every local script and stylesheet, so a browser that kept the last build cannot mix the two.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stampSite, stampText } from "../scripts/site-stamp.mjs";

const STAMP = "161eccb";

test("a page and a module name the build, and a second pass does not name it twice", () => {
  const html = `<link rel="stylesheet" href="family.css" /><link rel="stylesheet" href="https://example.com/a.css" /><script type="module" src="demo.js"></script><script type="module" src="./chunk.js"></script>`;
  const js = `import"./chunk-abc.js";\nimport "https://example.com/x.js";\n`;
  const stampedHtml = stampText("index.html", html, STAMP);
  const stampedJs = stampText("demo.js", js, STAMP);
  assert.match(stampedHtml, /href="family\.css\?v=161eccb"/);
  assert.match(stampedHtml, /src="demo\.js\?v=161eccb"/);
  assert.match(stampedHtml, /src="\.\/chunk\.js\?v=161eccb"/);
  assert.match(stampedHtml, /href="https:\/\/example\.com\/a\.css"/);
  assert.match(stampedJs, /import"\.\/chunk-abc\.js\?v=161eccb"/);
  assert.match(stampedJs, /https:\/\/example\.com\/x\.js"/);
  assert.equal(stampText("index.html", stampedHtml, STAMP), stampedHtml);
  assert.equal(stampText("demo.js", stampedJs, STAMP), stampedJs);
});

test("a built folder has no local script or stylesheet without the one stamp", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wakusei-stamp-"));
  try {
    await mkdir(join(dir, "nested"));
    await writeFile(join(dir, "index.html"), `<link rel="stylesheet" href="demo.css" /><script type="module" src="demo.js"></script>`);
    await writeFile(join(dir, "demo.js"), `import"./nested/chunk.js";\n`);
    await writeFile(join(dir, "nested", "chunk.js"), `export const n = 1;\n`);
    await writeFile(join(dir, "picture.webp"), "not text");
    assert.equal(await stampSite(dir, STAMP), 2);
    const bare: string[] = [];
    const stamps = new Set<string>();
    const hold = (address: string) => {
      const found = /\?v=([\w.-]+)$/.exec(address)?.[1];
      if (found === undefined) bare.push(address);
      else stamps.add(found);
    };
    const html = await readFile(join(dir, "index.html"), "utf8");
    for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/g)) {
      const address = /\s(?:src|href)="([^"]*)"/.exec(tag)?.[1];
      if (address !== undefined && !/^([a-z]+:|\/\/)/.test(address)) hold(address);
    }
    const js = await readFile(join(dir, "demo.js"), "utf8");
    for (const [, address] of js.matchAll(/["'`](\.\.?\/[^"'`\s]*\.js[^"'`\s]*)["'`]/g)) hold(address);
    assert.deepEqual(bare, []);
    assert.deepEqual([...stamps], [STAMP]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
