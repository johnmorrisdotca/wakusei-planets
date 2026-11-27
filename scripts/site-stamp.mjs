// GitHub Pages keeps a file for about ten minutes, so a new page can run the previous build's script.
// Every local script and stylesheet address names this build: the commit on Pages, the version otherwise.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** One file's text with this build named on every local script and stylesheet address. */
export function stampText(name, text, stamp) {
  if (name.endsWith(".js")) return text.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.\.?\/[^"']+\.js)\2/g, `$1$2$3?v=${stamp}$2`);
  if (name.endsWith(".html")) return text.replace(/(<script\b[^>]*\ssrc=|<link\b[^>]*\shref=)"(?![a-z]+:|\/\/)([^"?#]+)"/g, `$1"$2?v=${stamp}"`);
  return text;
}

/** Name the build on every local script and stylesheet under `dir`. Returns how many files changed. */
export async function stampSite(dir, stamp) {
  let changed = 0;
  for (const name of await readdir(dir, { recursive: true })) {
    const file = String(name);
    if (!file.endsWith(".js") && !file.endsWith(".html")) continue;
    const path = join(dir, file);
    const text = await readFile(path, "utf8");
    const next = stampText(file, text, stamp);
    if (next !== text) {
      await writeFile(path, next);
      changed += 1;
    }
  }
  return changed;
}
