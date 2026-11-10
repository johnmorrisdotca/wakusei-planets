// Every way of using the package that the guides and the README show, run against the package as npm packs it: the files in examples/ are copied beside a copy of the
// packed package (.usage/node_modules/@johnmorrisdotca/wakusei-planets) and each one is built, type-checked or run, and the ones with a page are opened in a browser,
// which must show a body. The guides and the README must hold these files' text, word for word, so what a reader copies is what was tested.
// `pnpm test:usage` (builds the package and the site first). One browser, one page at a time.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "@playwright/test";
import { acquireBrowserLock } from "@johnmorrisdotca/kazoku-ui/testing";
import { build as esbuild } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const at = (...parts: string[]) => join(root, ...parts);
const usage = at(".usage");
const NAME = "@johnmorrisdotca/wakusei-planets";
const require = createRequire(import.meta.url);

/** Run a program and, if it fails, say what it printed. */
const sh = (program: string, args: string[], cwd: string): string => {
  try {
    return execFileSync(program, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const out = error as { stdout?: string; stderr?: string };
    throw new Error(`${program} ${args.join(" ")} failed:\n${out.stdout ?? ""}${out.stderr ?? ""}`);
  }
};

const only = process.argv.slice(2);
const results: string[] = [];
const failures: string[] = [];
const step = async (name: string, run: () => Promise<void> | void): Promise<void> => {
  if (only.length > 0 && !only.includes(name)) return;
  const started = Date.now();
  try {
    await run();
    results.push(`ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    results.push(`FAIL ${name}`);
  }
  console.log(results[results.length - 1]);
};

// 1. The package as npm packs it, installed beside the examples.
rmSync(usage, { recursive: true, force: true });
mkdirSync(usage, { recursive: true });
const packed = JSON.parse(execFileSync("npm", ["pack", "--json", "--pack-destination", usage], { cwd: root, encoding: "utf8" })) as { filename: string }[];
const tarball = join(usage, packed[0]!.filename);
const installed = join(usage, "node_modules", "@johnmorrisdotca", "wakusei-planets");
mkdirSync(installed, { recursive: true });
execFileSync("tar", ["-xzf", tarball, "-C", installed, "--strip-components=1"]);
cpSync(at("examples"), join(usage, "examples"), { recursive: true });
const examples = (name: string) => join(usage, "examples", name);

// 2. A page that is a folder of built files, served to the browser without a port.
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
const serve = async (page: Page, origin: string, folder: string, prefix = ""): Promise<void> => {
  await page.route(`${origin}${prefix}/**`, (route) => {
    const pathname = new URL(route.request().url()).pathname.slice(prefix.length);
    const file = join(folder, decodeURIComponent(pathname.endsWith("/") ? `${pathname}index.html` : pathname));
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? "application/octet-stream" });
  });
};

const opened = async (browser: Browser, run: (page: Page, errors: string[]) => Promise<void>): Promise<void> => {
  const context = await browser.newContext({ viewport: { width: 800, height: 700 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  try {
    await run(page, errors);
  } finally {
    await context.close();
  }
  if (errors.length > 0) throw new Error(`the page reported errors:\n${errors.join("\n")}`);
};

/** The body is drawn: an <svg> with its outline and features in the element's shadow root. */
const seesGlobe = async (page: Page, selector = "wakusei-body"): Promise<void> => {
  await page.locator(selector).first().waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForFunction((css) => (document.querySelector(css)?.shadowRoot?.querySelectorAll("svg path, svg ellipse").length ?? 0) > 5, selector, { timeout: 20_000 });
};

// 3. A bundle of one entry, as a CDN's bundler (jsDelivr's /+esm) or a bundler of your own makes it, to stand in for a CDN's answer.
const bundles = new Map<string, string>();
const bundleOf = async (entry: string): Promise<string> => {
  const found = bundles.get(entry);
  if (found !== undefined) return found;
  const out = await esbuild({ entryPoints: [entry], bundle: true, format: "esm", write: false, minify: true, absWorkingDir: root, logLevel: "silent" });
  const text = out.outputFiles[0]!.text;
  bundles.set(entry, text);
  return text;
};
const modules = (name: string) => join(installed, "dist", name);

/** unpkg's `?module`: a file of the package with its bare imports made into unpkg addresses, and a dependency's own bundle. */
const unpkgAnswer = async (pathname: string): Promise<string | null> => {
  const own = /^\/@johnmorrisdotca\/wakusei-planets(?:@[^/]+)?\/(.+)$/.exec(pathname);
  if (own) {
    const file = join(installed, own[1]!);
    if (!existsSync(file)) return null;
    return readFileSync(file, "utf8")
      .replace(/(from\s+|import\s*\(?\s*)"([^./"][^"]*)"/g, (_, lead: string, bare: string) => `${lead}"https://unpkg.com/${bare}?module"`)
      .replace(/(from\s+|import\s*\(?\s*)"(\.[^"?]*)"/g, (_, lead: string, relative: string) => `${lead}"${relative}?module"`);
  }
  const dependency = decodeURIComponent(pathname.slice(1)).replace(/@[\d.]+(?=\/|$)/, "");
  try {
    return await bundleOf(require.resolve(dependency, { paths: [root] }).replace(/\\/g, "/"));
  } catch {
    return null;
  }
};

const pageOf = (file: string) => readFileSync(file, "utf8");

const lock = await acquireBrowserLock();
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

await step("readme", () => {
  // The README's TypeScript and JavaScript blocks: each one is type-checked, and run unless it says `no-run` (it needs a browser).
  const folder = join(usage, "readme");
  mkdirSync(folder, { recursive: true });
  const blocks = [...readFileSync(at("README.md"), "utf8").matchAll(/^```(ts|js|mjs)( [^\n]*)?\n([\s\S]*?)^```$/gm)];
  if (blocks.length < 3) throw new Error("the README has no code blocks to check");
  const names = blocks.map((block, index) => {
    const name = `block-${index + 1}.${block[1] === "ts" ? "ts" : "mjs"}`;
    // A block that only shows a call leaves its value unused; making it a module keeps the files apart.
    writeFileSync(join(folder, name), `${block[3]}\nexport {};\n`);
    return { name, run: !(block[2] ?? "").includes("no-run") };
  });
  writeFileSync(join(folder, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, allowImportingTsExtensions: true, lib: ["es2023", "dom", "dom.iterable"], types: [], skipLibCheck: true }, include: names.filter((one) => one.name.endsWith(".ts")).map((one) => one.name) }));
  sh(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", join(folder, "tsconfig.json")], usage);
  for (const one of names) if (one.run) sh(process.execPath, [join(folder, one.name)], usage);
});

await step("node", () => {
  const out = execFileSync(process.execPath, [join(examples("node"), "server.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (!/^true -?\d+$/.test(out)) throw new Error(`unexpected output: ${out}`);
});

await step("typescript", () => {
  writeFileSync(join(examples("typescript"), "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", moduleResolution: "bundler", strict: true, noEmit: true, lib: ["es2023", "dom", "dom.iterable"], types: [], skipLibCheck: true }, include: ["index.ts"] }));
  execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", join(examples("typescript"), "tsconfig.json")], { cwd: usage, stdio: "pipe" });
  // The same file, run: types are erased, so it is plain JavaScript to Node.
  const run = execFileSync(process.execPath, [join(examples("typescript"), "index.ts")], { cwd: usage, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (!/^true Jupiter io/m.test(run)) throw new Error(`unexpected output: ${run}`);
});

await step("cdn-jsdelivr", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/wakusei-planets/element/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(modules("element.js")), contentType: "text/javascript" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "cdn-jsdelivr.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await seesGlobe(page);
    if ((await page.locator("wakusei-body").getAttribute("body")) !== "saturn") throw new Error("the element lost its attributes");
    // the line drawing zooms by itself, up to 50x
    const zoomed = await page.locator("wakusei-body").evaluate((el) => {
      let zoom = 1;
      el.addEventListener("wakusei-view", (event) => (zoom = (event as CustomEvent<{ zoom: number }>).detail.zoom));
      const box = el.getBoundingClientRect();
      for (let at = 0; at < 40; at += 1) el.dispatchEvent(new WheelEvent("wheel", { deltaY: -2000, ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true, composed: true }));
      return zoom;
    });
    if (Math.abs(zoomed - 50) > 0.01) throw new Error(`the line drawing zoomed to ${zoomed}, not 50`);
  });
});

await step("earth-without-chikyu", async () => {
  // chikyu-earth is an optional peer: a project without it must still build /earth and draw the Earth's line look (this package's own outline).
  const absent = { name: "no-chikyu", setup: (b: import("esbuild").PluginBuild) => b.onResolve({ filter: /^@johnmorrisdotca\/chikyu-earth/ }, (a) => ({ errors: [{ text: `${a.path} is not installed` }] })) };
  const out = await esbuild({ stdin: { contents: `import "@johnmorrisdotca/wakusei-planets/element"; import "@johnmorrisdotca/wakusei-planets/earth";`, resolveDir: usage }, bundle: true, format: "esm", write: false, absWorkingDir: root, logLevel: "silent", plugins: [absent] });
  await opened(browser, async (page) => {
    await page.route("https://page.test/**", (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/main.js") return route.fulfill({ body: out.outputFiles[0]!.text, contentType: "text/javascript" });
      return route.fulfill({ body: `<!doctype html><wakusei-body body="earth" look="line" size="300"></wakusei-body><script type="module" src="/main.js"></script>`, contentType: "text/html" });
    });
    await page.goto("https://page.test/");
    await page.waitForFunction(() => {
      const root = document.querySelector("wakusei-body")?.shadowRoot;
      return root !== null && root !== undefined && root.querySelector("chikyu-earth") === null && root.querySelectorAll("svg path, svg ellipse").length > 0;
    }, undefined, { timeout: 20_000 });
  });
});

await step("cdn-unpkg", async () => {
  await opened(browser, async (page) => {
    await page.route("https://unpkg.com/**", async (route) => {
      const { pathname, searchParams } = new URL(route.request().url());
      if (!searchParams.has("module")) return route.fulfill({ status: 404, body: "" });
      const body = await unpkgAnswer(pathname);
      return body === null ? route.fulfill({ status: 404, body: "" }) : route.fulfill({ body, contentType: "text/javascript" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "cdn-unpkg.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await seesGlobe(page);
  });
});

await step("cdn-realistic", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/npm/@johnmorrisdotca/wakusei-planets/element/+esm") return route.fulfill({ body: await bundleOf(modules("element.js")), contentType: "text/javascript" });
      if (pathname === "/npm/@johnmorrisdotca/wakusei-planets/jupiter/+esm") return route.fulfill({ body: await bundleOf(modules("bodies/jupiter.js")), contentType: "text/javascript" });
      const picture = pathname.split("/").pop() ?? "";
      if (picture.endsWith(".webp") && existsSync(at("textures", picture))) return route.fulfill({ body: readFileSync(at("textures", picture)), contentType: "image/webp" });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "cdn-realistic.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await page.locator("wakusei-body[data-state=live]").waitFor({ timeout: 60_000 });
    // the element zooms by itself: Ctrl and the wheel, with no controls on the page, up to its own limit and no further (Jupiter's soft 2048 picture and generic detail: 9.6x)
    const zoomed = await page.locator("wakusei-body").evaluate((el) => {
      let zoom = 1;
      el.addEventListener("wakusei-view", (event) => (zoom = (event as CustomEvent<{ zoom: number }>).detail.zoom));
      const box = el.getBoundingClientRect();
      for (let at = 0; at < 40; at += 1) el.dispatchEvent(new WheelEvent("wheel", { deltaY: -2000, ctrlKey: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2, bubbles: true, cancelable: true, composed: true }));
      return zoom;
    });
    if (Math.abs(zoomed - 9.6) > 0.01) throw new Error(`the shaded body zoomed to ${zoomed}, not 9.6`);
  });
});

await step("space", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/npm/@johnmorrisdotca/wakusei-planets/space/element/+esm") return route.fulfill({ body: await bundleOf(modules("space/element.js")), contentType: "text/javascript" });
      const picture = pathname.split("/").pop() ?? "";
      if (picture.endsWith(".webp") && existsSync(at("textures", picture))) return route.fulfill({ body: readFileSync(at("textures", picture)), contentType: "image/webp" });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "space.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await page.locator("wakusei-space[data-state=live]").waitFor({ timeout: 60_000 });
  });
});

await step("controls", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/npm/@johnmorrisdotca/wakusei-planets/element/+esm") return route.fulfill({ body: await bundleOf(modules("element.js")), contentType: "text/javascript" });
      if (pathname === "/npm/@johnmorrisdotca/kazoku-ui/view-controls/define/+esm") return route.fulfill({ body: await bundleOf(require.resolve("@johnmorrisdotca/kazoku-ui/view-controls/define", { paths: [root] })), contentType: "text/javascript" });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "controls.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await seesGlobe(page);
    await page.locator("kazoku-view-controls .bar").waitFor({ timeout: 20_000 });
    const before = await page.locator("wakusei-body").evaluate((el) => el.shadowRoot?.innerHTML ?? "");
    await page.locator("#planet").focus();
    for (let at = 0; at < 4; at += 1) await page.keyboard.press("ArrowRight");
    await page.waitForFunction((was) => document.querySelector("wakusei-body")?.shadowRoot?.innerHTML !== was, before, { timeout: 10_000 });
  });
});

await step("iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/wakusei-planets");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples(""), "iframe.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    const frame = page.frameLocator("iframe");
    await frame.locator("wakusei-body svg").waitFor({ timeout: 20_000 });
    if ((await frame.locator("wakusei-body").getAttribute("body")) !== "saturn") throw new Error("the embed ignored the body");
  });
});

// The bundlers and frameworks: built, then opened.
const { build: viteBuild } = await import("vite");
const viteApp = async (name: string, plugins: unknown[] = []): Promise<void> => {
  const dir = examples(name);
  const out = join(usage, "out", name);
  await viteBuild({ root: dir, plugins: plugins as never[], logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesGlobe(page);
  });
};

await step("vite", () => viteApp("vite"));
await step("react", () => viteApp("react"));
await step("vue", async () => viteApp("vue", [(await import("@vitejs/plugin-vue")).default()]));
await step("svelte", async () => viteApp("svelte", [(await import("@sveltejs/vite-plugin-svelte")).svelte()]));

await step("react-ssr", async () => {
  const script = join(usage, "ssr-react.tsx");
  writeFileSync(script, `import { renderToString } from "react-dom/server";\nimport { WakuseiBody } from "./examples/react/WakuseiBody";\nconst html = renderToString(<WakuseiBody />);\nif (!html.includes("<wakusei-body")) throw new Error("no element in " + html);\nconsole.log(html);\n`);
  const out = join(usage, "ssr-react.mjs");
  await esbuild({ entryPoints: [script], outfile: out, bundle: true, platform: "node", format: "esm", jsx: "automatic", absWorkingDir: root, logLevel: "silent", external: ["react", "react-dom"], splitting: false });
  const html = execFileSync(process.execPath, [out], { cwd: root, encoding: "utf8" });
  if (!html.includes('body="saturn"')) throw new Error(`the server render lost the attributes: ${html}`);
});

await step("webpack", async () => {
  const { default: webpack } = await import("webpack");
  const dir = examples("webpack");
  const config = (await import(pathToFileURL(join(dir, "webpack.config.mjs")).href)).default as Record<string, unknown>;
  const stats = await new Promise<import("webpack").Stats>((resolve, reject) => {
    webpack({ ...config, context: dir, output: { ...(config["output"] as object), path: join(usage, "out", "webpack") } } as import("webpack").Configuration, (error, result) => (error || !result ? reject(error ?? new Error("no result")) : resolve(result)));
  });
  if (stats.hasErrors()) throw new Error(stats.toString({ colors: false, errors: true }));
  const out = join(usage, "out", "webpack");
  writeFileSync(join(out, "index.html"), `<!doctype html><html><body><script src="main.js"></script></body></html>`);
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesGlobe(page);
  });
});

await step("angular", async () => {
  const dir = examples("angular");
  const out = join(usage, "out", "angular");
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", experimentalDecorators: true, useDefineForClassFields: false } }));
  await esbuild({ entryPoints: [join(dir, "main.ts")], outdir: out, bundle: true, splitting: true, format: "esm", tsconfig: join(dir, "tsconfig.json"), absWorkingDir: root, logLevel: "silent", minify: true });
  writeFileSync(join(out, "index.html"), readFileSync(join(dir, "index.html")));
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesGlobe(page);
  });
});

// A star drawn from its numbers: every way of putting it in a page.
/** The star is drawn from the numbers it was given, and says so: the label names it and says it is not a photo. */
const seesStar = async (page: Page): Promise<void> => {
  await seesGlobe(page);
  const label = await page.locator("wakusei-body").first().getAttribute("aria-label");
  if (!/Betelgeuse/.test(label ?? "") || !/not a photo/.test(label ?? "")) throw new Error(`the star's label is wrong: ${label}`);
};

await step("star-node", () => {
  const out = execFileSync(process.execPath, [join(examples("star"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (!/^#[0-9a-f]{6} true surface,spots,rotation,prominences,glow$/.test(out)) throw new Error(`unexpected output: ${out}`);
});

await step("star-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname !== "/npm/@johnmorrisdotca/wakusei-planets/element/+esm") return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ body: await bundleOf(modules("element.js")), contentType: "text/javascript" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("star"), "cdn.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await page.locator("wakusei-body[data-state=live]").waitFor({ timeout: 60_000 });
    const label = await page.locator("wakusei-body").getAttribute("aria-label");
    if (!/Betelgeuse/.test(label ?? "") || !/not a photo/.test(label ?? "")) throw new Error(`the star's label is wrong: ${label}`);
    const parts = await page.locator("wakusei-body").evaluate((el) => (el as unknown as { starLook: { parts: { status: string }[] } }).starLook.parts.map((part) => part.status));
    if (!parts.includes("illustrative") || !parts.includes("derived")) throw new Error(`the star does not say what is drawn for looks: ${parts}`);
  });
});

await step("star-iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/wakusei-planets");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("star"), "iframe.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    const frame = page.frameLocator("iframe");
    await frame.locator("wakusei-body svg").waitFor({ timeout: 20_000 });
    if ((await frame.locator("wakusei-body").getAttribute("star")) !== "Betelgeuse") throw new Error("the embed ignored the star");
    if ((await frame.locator("wakusei-body").getAttribute("temperature-k")) !== "3600") throw new Error("the embed ignored the star's numbers");
  });
});

const starApp = async (name: string, plugins: unknown[] = []): Promise<void> => {
  const dir = examples(`star/${name}`);
  const out = join(usage, "out", "star", name);
  await viteBuild({ root: dir, plugins: plugins as never[], logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesStar(page);
  });
};
await step("star-vite", () => starApp("vite"));
await step("star-react", () => starApp("react"));
await step("star-vue", async () => starApp("vue", [(await import("@vitejs/plugin-vue")).default()]));
await step("star-svelte", async () => starApp("svelte", [(await import("@sveltejs/vite-plugin-svelte")).svelte()]));
await step("star-angular", async () => {
  const dir = examples("star/angular");
  const out = join(usage, "out", "star", "angular");
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", experimentalDecorators: true, useDefineForClassFields: false } }));
  await esbuild({ entryPoints: [join(dir, "main.ts")], outdir: out, bundle: true, splitting: true, format: "esm", tsconfig: join(dir, "tsconfig.json"), absWorkingDir: root, logLevel: "silent", minify: true });
  writeFileSync(join(out, "index.html"), readFileSync(join(dir, "index.html")));
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesStar(page);
  });
});

// The size line-up: every way of putting it in a page.
/** The line-up is drawn on the page's one WebGL context, with the Earth and Jupiter, on Betelgeuse, and carries its zoom slider. */
const seesLineup = async (page: Page): Promise<void> => {
  const lineup = page.locator("wakusei-lineup").first();
  await lineup.waitFor({ state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector("wakusei-lineup")?.getAttribute("data-state") === "live", undefined, { timeout: 90_000 });
  const label = (await lineup.getAttribute("aria-label")) ?? "";
  if (!/Size line-up/.test(label) || !/Betelgeuse/.test(label) || !/Earth/.test(label) || !/Jupiter/.test(label)) throw new Error(`the line-up's label is wrong: ${label}`);
  if ((await lineup.evaluate((el) => (el as unknown as { focused: string }).focused)) !== "betelgeuse") throw new Error("the camera did not start on Betelgeuse");
  if ((await lineup.evaluate((el) => el.shadowRoot?.querySelectorAll("input[type=range]").length)) !== 1) throw new Error("the line-up has no zoom slider");
};

await step("lineup-node", () => {
  const out = execFileSync(process.execPath, [join(examples("lineup"), "node.mjs")], { cwd: usage, encoding: "utf8" }).trim();
  if (out !== "Stephenson 2-18: 2,150 Suns (+710 −290), 1.5 billion km, Fok et al. 2012 · estimated") throw new Error(`unexpected output: ${out}`);
});

await step("lineup-cdn", async () => {
  await opened(browser, async (page) => {
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname === "/npm/@johnmorrisdotca/wakusei-planets/lineup/+esm") return route.fulfill({ body: await bundleOf(modules("lineup/element.js")), contentType: "text/javascript" });
      // the Earth's own map, which its look always draws
      const picture = pathname.split("/").pop() ?? "";
      if (picture.endsWith(".webp") && existsSync(at("textures", picture))) return route.fulfill({ body: readFileSync(at("textures", picture)), contentType: "image/webp" });
      return route.fulfill({ status: 404, body: "" });
    });
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("lineup"), "cdn.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    await seesLineup(page);
  });
});

await step("lineup-iframe", async () => {
  if (!existsSync(at("site", "embed.html"))) throw new Error("site/ is not built: `pnpm test:usage` builds it");
  await opened(browser, async (page) => {
    await serve(page, "https://johnmorrisdotca.github.io", at("site"), "/wakusei-planets");
    await page.route("https://page.test/**", (route) => route.fulfill({ body: pageOf(join(examples("lineup"), "iframe.html")), contentType: "text/html" }));
    await page.goto("https://page.test/");
    const frame = page.frameLocator("iframe");
    await frame.locator("wakusei-lineup").waitFor({ timeout: 20_000 });
    if ((await frame.locator("wakusei-lineup").getAttribute("stars")) !== "bright") throw new Error("the embed ignored the stars");
    if ((await frame.locator("wakusei-lineup").getAttribute("at")) !== "betelgeuse") throw new Error("the embed ignored where the camera starts");
    await frame.locator("wakusei-lineup[data-state=live]").waitFor({ timeout: 60_000 });
  });
});

const lineupApp = async (name: string, plugins: unknown[] = []): Promise<void> => {
  const dir = examples(`lineup/${name}`);
  const out = join(usage, "out", "lineup", name);
  await viteBuild({ root: dir, plugins: plugins as never[], logLevel: "warn", build: { outDir: out, emptyOutDir: true }, base: "./", configFile: false });
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesLineup(page);
  });
};
await step("lineup-vite", () => lineupApp("vite"));
await step("lineup-react", () => lineupApp("react"));
await step("lineup-vue", async () => lineupApp("vue", [(await import("@vitejs/plugin-vue")).default()]));
await step("lineup-svelte", async () => lineupApp("svelte", [(await import("@sveltejs/vite-plugin-svelte")).svelte()]));
await step("lineup-angular", async () => {
  const dir = examples("lineup/angular");
  const out = join(usage, "out", "lineup", "angular");
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "esnext", experimentalDecorators: true, useDefineForClassFields: false } }));
  await esbuild({ entryPoints: [join(dir, "main.ts")], outdir: out, bundle: true, splitting: true, format: "esm", tsconfig: join(dir, "tsconfig.json"), absWorkingDir: root, logLevel: "silent", minify: true });
  writeFileSync(join(out, "index.html"), readFileSync(join(dir, "index.html")));
  await opened(browser, async (page) => {
    await serve(page, "https://app.test", out);
    await page.goto("https://app.test/");
    await seesLineup(page);
  });
});

await browser.close();
lock.release();

// 4. The guides and the README hold what was tested, word for word.
const everything = only.length === 0;
const FILES: Record<string, string[]> = {
  "serve/server.mjs": ["docs/guides/serve-it-yourself.md", "docs/guides/ja/serve-it-yourself.md"],
  "cdn-jsdelivr.html": ["README.md", "docs/guides/html-and-cdn.md", "docs/guides/ja/html-and-cdn.md"],
  "cdn-realistic.html": ["docs/guides/html-and-cdn.md", "docs/guides/ja/html-and-cdn.md"],
  "controls.html": ["README.md", "docs/guides/getting-started.md", "docs/guides/ja/getting-started.md"],
  "cdn-unpkg.html": ["docs/guides/html-and-cdn.md", "docs/guides/ja/html-and-cdn.md"],
  "space.html": ["docs/guides/space-view.md", "docs/guides/ja/space-view.md"],
  "iframe.html": ["docs/guides/embed-in-an-iframe.md", "docs/guides/ja/embed-in-an-iframe.md"],
  "vite/main.ts": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "vite/index.html": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "webpack/src/index.js": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "webpack/webpack.config.mjs": ["docs/guides/bundlers.md", "docs/guides/ja/bundlers.md"],
  "react/WakuseiBody.tsx": ["README.md", "docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "react/wakusei-body.d.ts": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "vue/PlanetView.vue": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "vue/main.ts": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "svelte/WakuseiBody.svelte": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "angular/wakusei-body.component.ts": ["docs/guides/frameworks.md", "docs/guides/ja/frameworks.md"],
  "star/cdn.html": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/iframe.html": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/node.mjs": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/vite/main.ts": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/vite/index.html": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/react/StarView.tsx": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/react/wakusei-star.d.ts": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/vue/StarView.vue": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/vue/main.ts": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/svelte/StarView.svelte": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "star/angular/star-view.component.ts": ["docs/guides/star-look.md", "docs/guides/ja/star-look.md"],
  "lineup/cdn.html": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/iframe.html": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/node.mjs": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/vite/main.ts": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/vite/index.html": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/react/LineupView.tsx": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/react/wakusei-lineup.d.ts": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/vue/LineupView.vue": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/vue/main.ts": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/svelte/LineupView.svelte": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "lineup/angular/lineup-view.component.ts": ["docs/guides/size-lineup.md", "docs/guides/ja/size-lineup.md"],
  "typescript/index.ts": ["docs/guides/typescript-and-node.md", "docs/guides/ja/typescript-and-node.md"],
  "node/server.mjs": ["docs/guides/typescript-and-node.md", "docs/guides/ja/typescript-and-node.md"],
};
const normal = (text: string) => text.replace(/\r\n/g, "\n").trim();
for (const [file, places] of everything ? Object.entries(FILES) : []) {
  const code = normal(readFileSync(at("examples", file), "utf8"));
  for (const place of places) {
    if (!normal(readFileSync(at(place), "utf8")).includes(code)) failures.push(`${place} does not hold examples/${file} word for word`);
  }
}
const unlisted = (folder: string): string[] => readdirSync(at("examples", folder), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? unlisted(join(folder, entry.name)) : [relative("", join(folder, entry.name)).split("\\").join("/")]));
const known = new Set([...Object.keys(FILES), "lineup/angular/index.html", "lineup/angular/main.ts", "lineup/react/index.html", "lineup/react/main.tsx", "lineup/svelte/index.html", "lineup/svelte/main.ts", "lineup/vue/index.html", "angular/index.html", "angular/main.ts", "star/angular/index.html", "star/angular/main.ts", "star/react/index.html", "star/react/main.tsx", "star/svelte/index.html", "star/svelte/main.ts", "star/vue/index.html", "react/index.html", "react/main.tsx", "svelte/index.html", "svelte/main.ts", "vue/index.html"]);
for (const file of everything ? unlisted("") : []) if (!known.has(file)) failures.push(`examples/${file} is not listed in scripts/check-usage.ts: say where the guides show it`);

console.log(failures.length === 0 ? `\nusage ok: ${results.length} ways to use ${NAME}` : `\n${failures.length} failure${failures.length === 1 ? "" : "s"}:\n- ${failures.join("\n- ")}`);
if (failures.length > 0) process.exit(1);
