// Build the demo into site/ for GitHub Pages, served at /wakusei-planets/: the page and the embed frame (made by page.ts from the family's shared header and footer), their scripts
// (split, so three.js is its own file fetched only when a 3D look is chosen), the stylesheets, the surface pictures, and the kazoku-ui parts the header uses.
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { build } from "esbuild";
import { publishThumbnails, thumbnailHead } from "./family-thumbnail.mjs";
import { renderEmbed, renderIndex, renderKids, renderPortrait, renderSpace, renderStar } from "./page.ts";

const at = (path: string) => new URL(`../${path}`, import.meta.url).pathname;

await rm(at("site/"), { recursive: true, force: true });
await mkdir(at("site/"), { recursive: true });
await build({
  entryPoints: [at("demo/demo.ts"), at("demo/embed.ts"), at("demo/builder.ts"), at("demo/portrait.ts"), at("demo/space.ts"), at("demo/kids.ts"), at("demo/star.ts")],
  bundle: true,
  splitting: true,
  format: "esm",
  minify: true,
  outdir: at("site/"),
  chunkNames: "[name]-[hash]",
  logLevel: "silent",
});
// The family header's language picker and theme switch: one small module for every page of the site.
await writeFile(at("site/kazoku-parts.src.js"), `import "@johnmorrisdotca/kazoku-ui/language-picker/define";\nimport "@johnmorrisdotca/kazoku-ui/theme-switch/define";\n`);
await build({ entryPoints: [at("site/kazoku-parts.src.js")], outfile: at("site/kazoku-parts.js"), bundle: true, format: "esm", minify: true, logLevel: "silent", absWorkingDir: at("") });
await rm(at("site/kazoku-parts.src.js"));
await cp(at("demo/demo.css"), at("site/demo.css"));
await cp(at("demo/family.css"), at("site/family.css"));
if (existsSync(at("textures"))) await cp(at("textures"), at("site/textures"), { recursive: true });
// The family's card in the demo's <head> (og:image, twitter:image, the icon), and the three pictures published beside it.
const ALT = "Wakusei Planets: Mars, the Earth, Saturn with its rings, Jupiter and Neptune, shaded in 3D, side by side.";
const pkg = JSON.parse(readFileSync(at("package.json"), "utf8"));
await writeFile(at("site/index.html"), renderIndex().replace("  </head>", `    ${thumbnailHead(pkg, { alt: ALT })}\n  </head>`), "utf8");
publishThumbnails(at(""), at("site/"));
await writeFile(at("site/embed.html"), renderEmbed(), "utf8");
await writeFile(at("site/portrait.html"), renderPortrait(), "utf8");
await writeFile(at("site/space.html"), renderSpace(), "utf8");
await writeFile(at("site/kids.html"), renderKids(), "utf8");
await writeFile(at("site/star.html"), renderStar(), "utf8");
await cp(at("demo/builder.html"), at("site/builder.html"));
console.log("site built: index.html, embed.html, portrait.html, space.html, kids.html, star.html, builder.html, demo.js, embed.js, kazoku-parts.js, demo.css, family.css");
