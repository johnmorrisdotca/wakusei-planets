// Serve the built demo (site/) at /wakusei-planets/, on this package's port. `pnpm site` first, then `node scripts/dev.ts`.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT ?? 8300);
const root = new URL("../site/", import.meta.url).pathname;
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
};

createServer((req, res) => {
  void (async () => {
    let url = (req.url ?? "/").split("?")[0].replace(/^\/wakusei-planets\/?/, "/");
    if (url === "/") url = "/index.html";
    const path = join(root, normalize(url));
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("not found");
    }
  })();
}).listen(port, () => console.log(`demo on http://127.0.0.1:${port}/wakusei-planets/`));
