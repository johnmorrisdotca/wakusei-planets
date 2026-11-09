// A made-up tile set for the browser tests: the pyramid's shape and manifest of the real one for Mars, every tile one flat colour for its level, so a test can tell which level is on the
// screen. Nothing is downloaded from anywhere. Not a test file.
import { crc32, deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

/** The colour of a tile of this level (red, green, blue). */
export const COLOURS: Record<number, [number, number, number]> = {
  1: [255, 0, 255],
  2: [0, 255, 255],
  3: [255, 255, 0],
};

const png = (rgb: [number, number, number]): Buffer => {
  const size = 512;
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x += 1) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

const level = (n: number) => ({ level: n, width: 2048 * 2 ** n, height: 1024 * 2 ** n, columns: 4 * 2 ** n, rows: 2 * 2 ** n });
export const MANIFEST = { version: 1, tileSize: 512, base: 2048, bodies: { mars: { levels: [1, 2, 3].map(level) } } };

export interface TileLog {
  /** Every tile fetched, as `body/level/column/row`. */
  tiles: string[];
  manifests: number;
}

/** Serve the made-up set at the demo's `tiles/`. `fail` is asked for each tile (`body/level/column/row`) and answers true to give a 404. The returned log is the requests so far. */
export async function routeTiles(page: Page, fail: (tile: string) => boolean = () => false): Promise<TileLog> {
  const log: TileLog = { tiles: [], manifests: 0 };
  const pictures = new Map<string, Buffer>();
  await page.route("**/tiles/**", (route) => {
    const path = new URL(route.request().url()).pathname.split("/tiles/")[1] ?? "";
    if (path === "manifest.json") {
      log.manifests += 1;
      return route.fulfill({ json: MANIFEST, headers: { "access-control-allow-origin": "*" } });
    }
    const match = /^(\w+)\/(\d)\/(\d+)\/(\d+)\.webp$/.exec(path);
    if (!match) return route.fulfill({ status: 404 });
    const tile = path.replace(/\.webp$/, "");
    log.tiles.push(tile);
    if (fail(tile)) return route.fulfill({ status: 404 });
    const colour = COLOURS[Number(match[2])] ?? [128, 128, 128];
    const key = colour.join(",");
    if (!pictures.has(key)) pictures.set(key, png(colour));
    return route.fulfill({ body: pictures.get(key)!, contentType: "image/png", headers: { "access-control-allow-origin": "*" } });
  });
  return log;
}

/** A tile set whose manifest cannot be fetched, as on a site that has none. */
export const routeNoTiles = async (page: Page): Promise<void> => {
  await page.route("**/tiles/**", (route) => route.fulfill({ status: 404 }));
};
