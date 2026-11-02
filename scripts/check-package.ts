// Check the built package the way a consumer would: the entry files are there, and importing the built index draws every body.
import { existsSync } from "node:fs";

const entries = ["index", "element", "scene/look", "bodies/all", "bodies/sun", "bodies/jupiter", "bodies/saturn", "bodies/moons-jupiter"];
for (const entry of entries) for (const ext of ["js", "d.ts"]) if (!existsSync(new URL(`../dist/${entry}.${ext}`, import.meta.url))) throw new Error(`missing dist/${entry}.${ext}`);

const mod = await import(new URL("../dist/index.js", import.meta.url).href);
let bytes = 0;
for (const id of mod.BODY_IDS as string[]) {
  const svg = mod.lineSvg(id, { size: 200 });
  if (typeof svg !== "string" || !svg.startsWith("<svg")) throw new Error(`lineSvg(${id}) did not return SVG`);
  bytes += svg.length;
}
const moon = mod.apparent("moon", Date.UTC(2026, 10, 24, 14));
if (moon.illumination < 0.95) throw new Error("the Moon is not full on 2026-11-24");
const saturn = mod.ringStrip(mod.BODIES.saturn, 128);
if (saturn === null || saturn.width !== 128) throw new Error("ringStrip is off");
console.log(`package ok: ${mod.BODY_IDS.length} bodies drawn (${(bytes / 1024).toFixed(0)} KB of SVG), full Moon found`);
