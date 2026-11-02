// Puts the surface pictures that belong in the npm package into dist/textures: the two smaller widths of each. The sharpest (2048) stay in the repository's textures/ folder and are fetched from there
// by jsDelivr's GitHub address when a view is zoomed in (see TEXTURE_FAR_BASE), so the package stays small.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";

const from = new URL("../textures/", import.meta.url);
const to = new URL("../dist/textures/", import.meta.url);
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) if (/-(512|1024)\.webp$/.test(name)) cpSync(new URL(name, from), new URL(name, to));
}
