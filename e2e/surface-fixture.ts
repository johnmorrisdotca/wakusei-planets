// A made-up Moon site for the browser tests: the manifest and tiles of the real pyramid in shape (four levels, heights in two colours), 32 samples across a tile and two tiles across a level, so the page
// loads in a moment and a test can draw it small. The ground is a gentle swell with a hill 700 m to the north-east. Nothing is downloaded from anywhere. Not a test file.
import { crc32, deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

const TILE = 32;
const LEVELS = [
  { id: "h5", res: 5, tiles: 2 },
  { id: "h20", res: 20, tiles: 2 },
  { id: "h80", res: 80, tiles: 2 },
  { id: "far", res: 480, tiles: 2 },
].map((l) => ({ ...l, half: (l.tiles * TILE * l.res) / 2 }));
const MIN = -4000;
const RANGE = 8000;
export const GROUND = -2600;

const chunk = (type: string, data: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const png = (size: number, raw: Buffer): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};

/** The made-up ground's height at a point, metres east and north of the site. */
export const heightAt = (x: number, y: number): number => GROUND + 25 * Math.sin(x / 300) * Math.cos(y / 400) + 140 * Math.exp(-(((x - 500) / 350) ** 2 + ((y - 500) / 350) ** 2));

function tile(level: (typeof LEVELS)[number], column: number, row: number): Buffer {
  const raw = Buffer.alloc((1 + TILE * 3) * TILE);
  for (let y = 0; y < TILE; y += 1) {
    const base = y * (1 + TILE * 3);
    for (let x = 0; x < TILE; x += 1) {
      const worldX = (column * TILE + x + 0.5) * level.res - level.half;
      const worldY = level.half - (row * TILE + y + 0.5) * level.res;
      const v = Math.round(((heightAt(worldX, worldY) - MIN) / RANGE) * 65535);
      raw.set([v >> 8, v & 255, 0], base + 1 + x * 3);
    }
  }
  return png(TILE, raw);
}

export const MANIFEST = {
  version: 1,
  body: "moon",
  site: "apollo-17",
  name: { en: "Apollo 17, Taurus-Littrow", ja: "アポロ17号、タウルス・リットロー" },
  lat: 20.1911,
  lon: 30.7723,
  radius: 1737400,
  tile: TILE,
  height: { min: MIN, range: RANGE },
  ground: GROUND,
  levels: LEVELS,
  picture: null,
  credit: "NASA/GSFC/Arizona State University (LROC), LOLA Team (NASA/GSFC)",
  accuracy: "about 1 m vertical, about 10 m horizontal; one point every 5 m",
};

/** What the page asked for. */
export interface SurfaceLog {
  manifests: number;
  tiles: string[];
}

/** Serve the made-up site wherever the page looks for `moon/apollo-17/` tiles. */
export async function routeSurface(page: Page): Promise<SurfaceLog> {
  const log: SurfaceLog = { manifests: 0, tiles: [] };
  await page.route("**/tiles/moon/apollo-17/**", async (route) => {
    const url = new URL(route.request().url());
    const at = url.pathname.split("/tiles/moon/apollo-17/")[1]!;
    if (at === "manifest.json") {
      log.manifests += 1;
      await route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(MANIFEST) });
      return;
    }
    const m = /^terrain\/(\w+)\/(\d+)\/(\d+)\.png$/.exec(at);
    const level = m === null ? undefined : LEVELS.find((l) => l.id === m[1]);
    if (m === null || level === undefined) {
      await route.fulfill({ status: 404, body: "no such tile" });
      return;
    }
    log.tiles.push(`${m[1]}/${m[2]}/${m[3]}`);
    await route.fulfill({ contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: tile(level, Number(m[2]), Number(m[3])) });
  });
  return log;
}
