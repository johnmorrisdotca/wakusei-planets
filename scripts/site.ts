// Build the demo into site/ for GitHub Pages, served at /wakusei-planets/: the page and the embed frame (made by page.ts from the family's shared header and footer), their scripts
// (split, so three.js is its own file fetched only when a 3D look is chosen), the stylesheets, the surface pictures, and the kazoku-ui parts the header uses.
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { MOON_PAGE_HOSTS } from "../src/moon-pages/data.ts";
import { publishThumbnails, thumbnailHead } from "./family-thumbnail.mjs";
import { stampSite } from "./site-stamp.mjs";
import { renderAll, renderBuilder, renderChart, renderCounts, renderCraft, renderEmbed, renderFlat, renderGroups, renderIndex, renderKids, renderLineup, renderMoons, renderPlan, renderPortrait, renderSpace, renderSystem, renderSpaceFull, renderStar, renderSurface, renderDots } from "./page.ts";

const at = (path: string) => new URL(`../${path}`, import.meta.url).pathname;

await rm(at("site/"), { recursive: true, force: true });
await mkdir(at("site/"), { recursive: true });
await build({
  entryPoints: [at("demo/demo.ts"), at("demo/surface.ts"), at("demo/embed.ts"), at("demo/builder.ts"), at("demo/portrait.ts"), at("demo/space.ts"), at("demo/space-full.ts"), at("demo/kids.ts"), at("demo/star.ts"), at("demo/craft.ts"), at("demo/lineup.ts"), at("demo/plan.ts"), at("demo/flat.ts"), at("demo/system.ts"), at("demo/moons.ts"), at("demo/groups.ts"), at("demo/all.ts"), at("demo/counts.ts"), at("demo/dots.ts"), at("demo/chart.ts")],
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  outdir: at("site/"),
  chunkNames: "[name]-[hash]",
  logLevel: "silent",
});
// The family header's language picker and theme switch: one small module for every page of the site.
await writeFile(at("site/kazoku-parts.src.js"), `import "@johnmorrisdotca/kazoku-ui/language-picker/define";\nimport "@johnmorrisdotca/kazoku-ui/theme-switch/define";\nimport "@johnmorrisdotca/kazoku-ui/page-frame/define";\n`);
await build({ entryPoints: [at("site/kazoku-parts.src.js")], outfile: at("site/kazoku-parts.js"), bundle: true, format: "esm", minify: true, logLevel: "silent", absWorkingDir: at("") });
await rm(at("site/kazoku-parts.src.js"));
await cp(at("demo/demo.css"), at("site/demo.css"));
await cp(at("demo/family.css"), at("site/family.css"));
if (existsSync(at("textures"))) await cp(at("textures"), at("site/textures"), { recursive: true });
// chikyu-earth's pictures of the Earth (NASA's, public domain: its day, night, clouds and water), for the page that asks for its realistic Earth in the shaded looks (`earth-from=chikyu` in the address, `earth-texture-base` on the body)
for (const name of ["day", "night", "clouds", "water"]) {
  for (const size of [1024, 2048]) {
    const from = at(`node_modules/@johnmorrisdotca/chikyu-earth/dist/textures/${name}-${size}.webp`);
    if (existsSync(from)) await cp(from, at(`site/earth-textures/${name}-${size}.webp`));
  }
}
// The rover models (NASA's two public domain; the Apollo one is CC BY-SA 4.0, a named exception, with its credit line on the surface page; NOTICE.md): each its own file, fetched only by a page that asks for it (`drive-model`), in no package.
if (existsSync(at("models"))) await cp(at("models"), at("site/models"), { recursive: true });
// Michroma, for a name written on a body: kazoku-ui's copy and its licence, beside the scripts, where the label fetches it from (`new URL("./fonts/…", import.meta.url)` in the bundled chunk).
await cp(at("node_modules/@johnmorrisdotca/kazoku-ui/dist/body-label/fonts"), at("site/fonts"), { recursive: true });
// The finer map tiles, if they have been made (`pnpm tiles`): served beside the textures at tiles/. They are in no package and no repository; the Pages workflow makes them.
if (existsSync(at(".cache/body-tiles-out/manifest.json"))) await cp(at(".cache/body-tiles-out"), at("site/tiles"), { recursive: true });
// The Moon's ground tiles (`pnpm terrain`), served beside them at tiles/moon/: in no package and no repository either.
if (existsSync(at(".cache/moon-terrain-out/moon"))) await cp(at(".cache/moon-terrain-out/moon"), at("site/tiles/moon"), { recursive: true });
// The family's card in the demo's <head> (og:image, twitter:image, the icon), and the three pictures published beside it.
const ALT = "Wakusei Planets: Mars, the Earth, Saturn with its rings, Jupiter and Neptune, shaded in 3D, side by side.";
const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
await writeFile(at("site/index.html"), renderIndex().replace("  </head>", `    ${thumbnailHead(pkg, { alt: ALT })}\n  </head>`), "utf8");
publishThumbnails(at(""), at("site/"));
await writeFile(at("site/embed.html"), renderEmbed(), "utf8");
await writeFile(at("site/portrait.html"), renderPortrait(), "utf8");
await writeFile(at("site/space.html"), renderSpace(), "utf8");
await writeFile(at("site/space-full.html"), renderSpaceFull(), "utf8");
await writeFile(at("site/kids.html"), renderKids(), "utf8");
await writeFile(at("site/star.html"), renderStar(), "utf8");
await writeFile(at("site/craft.html"), renderCraft(), "utf8");
await writeFile(at("site/lineup.html"), renderLineup(), "utf8");
await writeFile(at("site/plan.html"), renderPlan(), "utf8");
await writeFile(at("site/flat.html"), renderFlat(), "utf8");
await writeFile(at("site/system.html"), renderSystem(), "utf8");
await writeFile(at("site/surface.html"), renderSurface(), "utf8");
for (const host of MOON_PAGE_HOSTS) await writeFile(at(`site/${host}.html`), renderMoons(host), "utf8");
await writeFile(at("site/groups.html"), renderGroups(), "utf8");
await writeFile(at("site/all.html"), renderAll(), "utf8");
await writeFile(at("site/counts.html"), renderCounts(), "utf8");
await writeFile(at("site/dots.html"), renderDots(), "utf8");
await writeFile(at("site/chart.html"), renderChart(), "utf8");
await writeFile(at("site/builder.html"), renderBuilder(), "utf8");
// Pages keeps a file for about ten minutes, so the new page must not ask for the previous build's script by the same address.
const stamp = process.env.GITHUB_SHA?.slice(0, 7) || pkg.version;
await stampSite(at("site"), stamp);
console.log("site built: index.html, embed.html, portrait.html, space.html, space-full.html, kids.html, star.html, craft.html, lineup.html, plan.html, flat.html, system.html, jupiter.html, saturn.html, uranus.html, neptune.html, groups.html, all.html, counts.html, dots.html, chart.html, builder.html, demo.js, embed.js, kazoku-parts.js, demo.css, family.css");
