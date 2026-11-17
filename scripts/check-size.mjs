// check-size.mjs: the size budget. Every published entry point is bundled and minified as a reader's bundler would (the measure `docs-site.mjs size` uses),
// gzipped, and held to the bytes recorded in scripts/size-baseline.json: it fails when an entry grows by more than MARGIN over its baseline (and more than
// SLACK bytes, so a 300 byte entry may not fail on 20 bytes), when an entry has no baseline and when a baseline names an entry that is gone.
//
//   pnpm size:budget          check (after `pnpm build`)
//   pnpm size:budget:update   measure and rewrite scripts/size-baseline.json: for a growth you mean, in the same commit, with the reason in the CHANGELOG
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { measureBundles } from "./docs-site.mjs";

/** How much an entry may grow over its baseline: 5 per cent. */
export const MARGIN = 0.05;
/** The least growth, in bytes, that can fail: under it an entry passes however small it is. */
export const SLACK = 256;

const root = fileURLToPath(new URL("..", import.meta.url));
const baselineFile = new URL("./size-baseline.json", import.meta.url);

/** The problems of `now` (entry: gzipped bytes) against `baseline`; empty when within the budget. */
export function overBudget(now, baseline) {
  const problems = [];
  for (const [key, gzip] of Object.entries(now)) {
    const was = baseline[key];
    if (was === undefined) problems.push(`${key}: ${gzip} B gzipped has no baseline (pnpm size:budget:update records it)`);
    else if (gzip > was * (1 + MARGIN) && gzip - was > SLACK) problems.push(`${key}: ${gzip} B gzipped, ${gzip - was} B over its baseline of ${was} B (the budget is ${MARGIN * 100}% and ${SLACK} B)`);
  }
  for (const key of Object.keys(baseline)) if (!(key in now)) problems.push(`${key}: in the baseline and no longer an entry point (pnpm size:budget:update)`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const measured = await measureBundles(root);
  const now = Object.fromEntries(Object.entries(measured.entries).map(([key, size]) => [key, size.gzip]));
  if (process.argv.includes("--write")) {
    writeFileSync(baselineFile, `${JSON.stringify({ measured: measured.measured, entries: now }, null, 2)}\n`);
    console.log(`wrote scripts/size-baseline.json: ${Object.keys(now).length} entry points`);
  } else {
    const problems = overBudget(now, JSON.parse(readFileSync(baselineFile, "utf8")).entries);
    if (problems.length > 0) {
      console.error(`The size budget fails:\n- ${problems.join("\n- ")}`);
      process.exit(1);
    }
    console.log(`size budget ok: ${Object.keys(now).length} entry points, each within ${MARGIN * 100}% (and ${SLACK} B) of scripts/size-baseline.json`);
  }
}
