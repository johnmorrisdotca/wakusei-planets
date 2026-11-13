// Fetching a site's heights in rings: its manifest, then the first view (the coarse level whole, the finest level round the standing place, their pictures and the nearest horizon map), then everything else,
// nearest first, a few tiles at a time, each decoded by the browser into bytes and placed in its level. Browser only (it decodes pictures).
import { emptyLevel, fillFromCoarser, placeTile, tileAddress, type HeightLevel, type TerrainManifest } from "./height.ts";

/**
 * What a site's tiles cost to load and where the load has got to.
 *
 * @example
 * ```ts
 * import { type TerrainProgress } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const progress: TerrainProgress = { done: 30, total: 120, bytes: 1_500_000, first: 40 };
 * console.log(`${Math.round((progress.done / progress.total) * 100)}% of the tiles, ${(progress.bytes / 1e6).toFixed(1)} MB`);
 * ```
 */
export interface TerrainProgress {
  /** Files placed so far. */
  done: number;
  /** Files in all. */
  total: number;
  /** Bytes fetched so far. */
  bytes: number;
  /** Files in the first view, which `loadTerrain` waits for. */
  first: number;
}

/**
 * The terrain of a site, as loaded.
 *
 * The levels are whole from the first view on, and get finer in place as the rest of the tiles arrive: a tile not yet fetched holds what the coarser level makes of it. `complete` settles when the last
 * tile is in.
 *
 * @example
 * ```ts
 * import { type Terrain } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const describe = (terrain: Terrain): string => `${terrain.manifest.site}: ${terrain.levels.length} levels, ${terrain.firstBytes} bytes for the first view`;
 * console.log(describe({ manifest: { site: "apollo-17" }, levels: [], pictures: [], horizons: [], bytes: 0, firstBytes: 0, complete: Promise.resolve() } as unknown as Terrain));
 * ```
 */
export interface Terrain {
  manifest: TerrainManifest;
  /** The levels, finest first. */
  levels: HeightLevel[];
  /** The ground picture's levels (grey in red, green and blue), where the site has a picture. */
  pictures: HeightLevel[];
  /** The baked horizons of the first three levels (`cells * sectors / 3` wide, `cells` tall, RGBA), where the site has them. */
  horizons: { id: string; width: number; height: number; data: Uint8Array }[];
  /** Bytes fetched so far. */
  bytes: number;
  /** Bytes the first view took. */
  firstBytes: number;
  /** Settles when every tile is in (rejects if one cannot be had, with the first view still good). */
  complete: Promise<void>;
}

/**
 * What loading needs beyond the address: a `fetch` of your own (a test's), how many tiles to ask for at once (6), a way to stop, a line for progress and a line for each change of the terrain.
 *
 * @example
 * ```ts
 * import { type LoadOptions } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const options: LoadOptions = { concurrency: 4, onProgress: (progress) => console.log(`${progress.done} of ${progress.total}`), onChange: (id) => console.log(`${id} grew finer`) };
 * console.log(options.concurrency);
 * ```
 */
export interface LoadOptions {
  fetch?: typeof fetch;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?(progress: TerrainProgress): void;
  /** Called after a file is placed, with the name of what changed: a level (`h5`), a picture level (`a5`) or a horizon map (`horizon:h5`), so a texture can be sent again. */
  onChange?(id: string): void;
}

/** One picture's bytes as RGBA, decoded by the browser with no colour conversion (two of the colours of a height tile are two halves of a number). */
async function decodePicture(blob: Blob, width: number, height: number): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
  const canvas = typeof OffscreenCanvas === "function" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const g = (canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
  if (g === null) throw new Error("no 2d canvas to decode a tile with");
  g.drawImage(bitmap, 0, 0);
  bitmap.close();
  return g.getImageData(0, 0, width, height).data;
}
const decodeTile = (blob: Blob, size: number): Promise<Uint8ClampedArray> => decodePicture(blob, size, size);

/**
 * One file to fetch: a height tile, a picture tile or a horizon map, of the level at `index` in its list.
 *
 * @example
 * ```ts
 * import { type LoadJob } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const job: LoadJob = { kind: "height", index: 0, column: 3, row: 4, first: true };
 * console.log(`${job.kind} tile ${job.column}/${job.row} of level ${job.index}${job.first ? " in the first view" : ""}`);
 * ```
 */
export interface LoadJob {
  kind: "height" | "picture" | "horizon";
  index: number;
  column: number;
  row: number;
  /** Part of the first view. */
  first: boolean;
}

/**
 * The order a site's files are fetched in: the first view first (the coarse level whole, the finest level's 4 x 4 tiles round the site, the pictures of the same two and the finest horizon map), then every
 * other height and picture tile nearest the site first, then the other horizon maps, then the levels beyond the coarse one (the far terrain, which only the farthest mountains need).
 *
 * @param manifest - The site's manifest.
 * @returns The files, in the order to fetch them.
 *
 * @example
 * ```ts
 * import { loadPlan, type TerrainManifest } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const level = (id: string, res: number) => ({ id, res, tiles: 8, half: (256 * 8 * res) / 2 });
 * const manifest = { tile: 256, levels: [level("h5", 5), level("h20", 20), level("h80", 80)] } as unknown as TerrainManifest;
 * const plan = loadPlan(manifest);
 * console.log(`${plan.filter((job) => job.first).length} files in the first view of ${plan.length}`);
 * ```
 */
export function loadPlan(manifest: TerrainManifest): LoadJob[] {
  const tiles = (count: number, near: boolean): [number, number][] => {
    const out: [number, number][] = [];
    const from = near && count > 4 ? Math.floor(count / 2) - 2 : 0;
    const to = near && count > 4 ? from + 4 : count;
    for (let row = from; row < to; row += 1) for (let column = from; column < to; column += 1) out.push([column, row]);
    return out;
  };
  const heightLevels = manifest.levels;
  const pictureLevels = manifest.picture?.levels ?? [];
  const horizons = manifest.horizon?.levels ?? [];
  const coarse = Math.min(heightLevels.length - 1, Math.max(0, (horizons.length > 0 ? horizons.length : heightLevels.length - 1) - 1));
  const pictureCoarse = pictureLevels.length - 1;
  const first: LoadJob[] = [];
  const seen = new Set<string>();
  const add = (list: LoadJob[], kind: LoadJob["kind"], index: number, column: number, row: number, isFirst: boolean): void => {
    const key = `${kind}:${index}:${column}:${row}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ kind, index, column, row, first: isFirst });
  };
  const level = (kind: "height" | "picture", index: number, near: boolean, list: LoadJob[], isFirst: boolean): void => {
    const info = (kind === "height" ? heightLevels : pictureLevels)[index];
    if (info === undefined) return;
    for (const [column, row] of tiles(info.tiles, near)) add(list, kind, index, column, row, isFirst);
  };
  level("height", coarse, false, first, true);
  level("height", 0, true, first, true);
  if (pictureLevels.length > 0) {
    level("picture", pictureCoarse, false, first, true);
    level("picture", 0, true, first, true);
  }
  if (horizons.length > 0) add(first, "horizon", 0, 0, 0, true);
  const rest: LoadJob[] = [];
  for (let index = 0; index <= coarse; index += 1) level("height", index, false, rest, false);
  for (let index = 0; index < pictureLevels.length; index += 1) level("picture", index, false, rest, false);
  const distance = (job: LoadJob): number => {
    const info = (job.kind === "height" ? heightLevels : pictureLevels)[job.index]!;
    const side = manifest.tile * info.res;
    return Math.hypot((job.column + 0.5) * side - info.half, (job.row + 0.5) * side - info.half);
  };
  rest.sort((a, b) => distance(a) - distance(b) || a.index - b.index);
  for (let index = 1; index < horizons.length; index += 1) add(rest, "horizon", index, 0, 0, false);
  const far: LoadJob[] = [];
  for (let index = coarse + 1; index < heightLevels.length; index += 1) level("height", index, false, far, false);
  return [...first.filter((job) => job.first), ...rest.filter((job) => !job.first), ...far];
}

/**
 * Load a site's terrain in rings: the manifest, then the first view, then the rest in the background. The promise settles when the first view is in and the levels are whole (the tiles still to come hold what
 * the coarser level makes of them); the rest arrives in place, `onChange` says what, and `complete` settles at the end.
 *
 * @param base - The folder the tiles are served from, with the body and the site under it (`<base>moon/apollo-17/manifest.json`).
 * @param body - The body, `moon`.
 * @param site - The site's name, `apollo-17`.
 * @param options - A fetch, a concurrency, a signal, a progress line and a line for changes.
 * @returns The manifest and the levels, finest first.
 *
 * @example
 * ```ts no-run
 * import { loadTerrain } from "@johnmorrisdotca/wakusei-planets/surface";
 *
 * const terrain = await loadTerrain("https://johnmorrisdotca.github.io/wakusei-planets/tiles/", "moon", "apollo-17");
 * console.log(`${terrain.firstBytes} bytes to the first view`);
 * await terrain.complete;
 * console.log(`${terrain.bytes} bytes in all`);
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
  const hz = manifest.horizon;
  const horizonWidth = hz === null || hz === undefined ? 0 : hz.cells * (hz.sectors / 3);
  const horizons: Terrain["horizons"] = (hz?.levels ?? []).map((entry) => ({ id: entry.id, width: horizonWidth, height: hz!.cells, data: new Uint8Array(horizonWidth * hz!.cells * 4) }));
  const plan = loadPlan(manifest);
  const firstJobs = plan.filter((job) => job.first);
  const restJobs = plan.filter((job) => !job.first);
  const terrain: Terrain = { manifest, levels, pictures, horizons, bytes: 0, firstBytes: 0, complete: Promise.resolve() };
  const placed = new Set<string>();
  let done = 0;
  const report = (): void => options.onProgress?.({ done, total: plan.length, bytes: terrain.bytes, first: firstJobs.length });
  const fetchJob = async (job: LoadJob): Promise<void> => {
    if (job.kind === "horizon") {
      const entry = hz!.levels[job.index]!;
      const response = await get(`${folder}${manifest.body}/${manifest.site}/${entry.file}`, { signal: options.signal });
      if (!response.ok) throw new Error(`horizon ${entry.id}: ${response.status}`);
      const blob = await response.blob();
      terrain.bytes += blob.size;
      horizons[job.index]!.data.set(await decodePicture(blob, horizonWidth, hz!.cells));
      options.onChange?.(`horizon:${entry.id}`);
    } else {
      const picture = job.kind === "picture";
      const target = (picture ? pictures : levels)[job.index]!;
      const address = picture ? `${folder}${manifest.body}/${manifest.site}/ground/${target.id}/${job.column}/${job.row}.webp` : tileAddress(folder, manifest, target.id, job.column, job.row);
      const response = await get(address, { signal: options.signal });
      if (!response.ok) throw new Error(`tile ${target.id}/${job.column}/${job.row}: ${response.status}`);
      const blob = await response.blob();
      terrain.bytes += blob.size;
      placeTile(target, manifest.tile, job.column, job.row, await decodeTile(blob, manifest.tile));
      placed.add(`${job.kind}:${job.index}:${job.column}:${job.row}`);
      options.onChange?.(target.id);
    }
    done += 1;
    report();
  };
  const run = async (jobs: readonly LoadJob[]): Promise<void> => {
    let next = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const job = jobs[next++];
        if (job === undefined) return;
        await fetchJob(job);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency ?? 6) }, worker));
  };
  await run(firstJobs);
  // the tiles still to come hold what the coarser level makes of them, from the coarse level down
  const coarse = Math.min(levels.length - 1, Math.max(0, (hz?.levels.length ?? levels.length - 1) - 1));
  for (let index = coarse - 1; index >= 0; index -= 1) {
    const to = levels[index]!;
    const from = levels[index + 1]!;
    fillFromCoarser(to, from, manifest.tile, (column, row) => placed.has(`height:${index}:${column}:${row}`), { from: from.height ?? manifest.height, to: to.height ?? manifest.height });
  }
  for (let index = pictures.length - 2; index >= 0; index -= 1) {
    fillFromCoarser(pictures[index]!, pictures[index + 1]!, manifest.tile, (column, row) => placed.has(`picture:${index}:${column}:${row}`), "grey");
  }
  terrain.firstBytes = terrain.bytes;
  terrain.complete = run(restJobs);
  terrain.complete.catch(() => undefined);
  return terrain;
}
