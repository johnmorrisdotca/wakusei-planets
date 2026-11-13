// Fetching a site's heights: its manifest, then every tile of every level, a few at a time, each decoded by the browser into bytes and placed in its level. Browser only (it decodes pictures).
import { emptyLevel, placeTile, tileAddress, type HeightLevel, type TerrainManifest } from "./height.ts";

/** What a site's tiles cost to load and where the load has got to. */
export interface TerrainProgress {
  /** Tiles placed so far. */
  done: number;
  /** Tiles in all. */
  total: number;
  /** Bytes fetched so far. */
  bytes: number;
}

/** The terrain of a site, as loaded. */
export interface Terrain {
  manifest: TerrainManifest;
  /** The levels, finest first. */
  levels: HeightLevel[];
  /** The ground picture's levels (grey in red, green and blue), where the site has a picture. */
  pictures: HeightLevel[];
  /** Bytes fetched in all. */
  bytes: number;
}

/** What loading needs beyond the address: a `fetch` of your own (a test's), how many tiles to ask for at once (6), a way to stop, and a line for progress. */
export interface LoadOptions {
  fetch?: typeof fetch;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?(progress: TerrainProgress): void;
}

/** One tile's bytes as RGBA, decoded by the browser with no colour conversion (two of the colours are two halves of a number). */
async function decodeTile(blob: Blob, size: number): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(size, size) : Object.assign(document.createElement("canvas"), { width: size, height: size });
  const g = (canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (g === null) throw new Error("no 2d canvas to decode a tile with");
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  return g.getImageData(0, 0, size, size).data;
}

/**
 * Load a site's terrain: its manifest and every tile of every level.
 *
 * @param base - The folder the tiles are served from, with the body and the site under it (`<base>moon/apollo-17/manifest.json`).
 * @param body - The body, `moon`.
 * @param site - The site's name, `apollo-17`.
 * @param options - A fetch, a concurrency, a signal and a progress line.
 * @returns The manifest and the levels, finest first.
 *
 * @example
 * ```ts no-run
 * import { loadTerrain } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const terrain = await loadTerrain("https://johnmorrisdotca.github.io/wakusei-planets/tiles/", "moon", "apollo-17");
 * console.log(terrain.levels.map((level) => `${level.id}: ${level.res} m`).join(", "));
 * ```
 */
export async function loadTerrain(base: string, body: string, site: string, options: LoadOptions = {}): Promise<Terrain> {
  const get = options.fetch ?? fetch;
  const folder = base.endsWith("/") ? base : `${base}/`;
  const manifestResponse = await get(`${folder}${body}/${site}/manifest.json`, { signal: options.signal });
  if (!manifestResponse.ok) throw new Error(`no terrain for ${body}/${site} at ${folder} (${manifestResponse.status})`);
  const manifest = (await manifestResponse.json()) as TerrainManifest;
  const levels = manifest.levels.map((info) => emptyLevel(info, manifest.tile));
  const pictures = (manifest.picture?.levels ?? []).map((info) => emptyLevel(info, manifest.tile));
  const jobs: { level: HeightLevel; column: number; row: number; picture: boolean }[] = [];
  for (const level of levels) for (let row = 0; row < level.tiles; row += 1) for (let column = 0; column < level.tiles; column += 1) jobs.push({ level, column, row, picture: false });
  for (const level of pictures) for (let row = 0; row < level.tiles; row += 1) for (let column = 0; column < level.tiles; column += 1) jobs.push({ level, column, row, picture: true });
  let done = 0;
  let bytes = 0;
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const job = jobs[next++];
      if (job === undefined) return;
      const address = job.picture ? `${folder}${manifest.body}/${manifest.site}/ground/${job.level.id}/${job.column}/${job.row}.webp` : tileAddress(folder, manifest, job.level.id, job.column, job.row);
      const response = await get(address, { signal: options.signal });
      if (!response.ok) throw new Error(`tile ${job.level.id}/${job.column}/${job.row}: ${response.status}`);
      const blob = await response.blob();
      bytes += blob.size;
      placeTile(job.level, manifest.tile, job.column, job.row, await decodeTile(blob, manifest.tile));
      done += 1;
      options.onProgress?.({ done, total: jobs.length, bytes });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 6) }, worker));
  return { manifest, levels, pictures, bytes };
}
