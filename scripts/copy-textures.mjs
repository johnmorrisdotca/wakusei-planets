// Copy the bundled surface and ring textures. Remote widths stay in the repository.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { BODY_IDS } from "../dist/index.js";
import "../dist/bodies/all.js";
import { lookOf } from "../dist/scene/look.js";

const repositoryPictures = new Set();
for (const id of BODY_IDS) {
  const painted = lookOf(id)?.painted;
  if (painted?.far === undefined) continue;
  for (const width of painted.widths) {
    if (width >= painted.far) repositoryPictures.add(`${painted.map}-${width}.webp`);
  }
}

const from = new URL("../textures/", import.meta.url);
const to = new URL("../dist/textures/", import.meta.url);
if (existsSync(from)) {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    if (!repositoryPictures.has(name) && /-(512|1024)\.webp$|-ring-2048\.webp$/.test(name)) {
      cpSync(new URL(name, from), new URL(name, to));
    }
  }
}
