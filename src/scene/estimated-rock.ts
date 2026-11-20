// An irregular moon the package does not draw in full: a coarse rock, sized from the catalogue, coloured from its albedo, with a shape guessed from its id.
// The same id always builds the same rock. A full moon (one in the body's table) is not one of these. Nothing here draws; the element asks.
import { BODIES, type BodyFacts, type HostId } from "../facts.ts";
import { ESTIMATED_MOONS, type EstimatedMoonRow } from "../data/estimated-moons.ts";
import type { BodyLook } from "./look.ts";
import { shapeRadii, type ShapeTable } from "./shape.ts";

/** Where a catalogue radius comes from. `derived` was worked out from the brightness. `unknown` means the catalogue gives no size, and the rock is drawn at 1 km so the poster still has a picture. */
export type EstimatedSize = "measured" | "sheet" | "derived" | "unknown";

/** The colour class of an albedo. Unknown is neutral grey. */
export type AlbedoTone = "dark" | "mid" | "bright" | "grey";

/** One estimated rock, ready for `<wakusei-body>`. */
export interface EstimatedRock {
  id: string;
  host: HostId;
  label: string;
  /** The mean radius in kilometres. 1 when the catalogue gives no size. */
  radiusKm: number;
  sizeFrom: EstimatedSize;
  albedo: number | null;
  tone: AlbedoTone;
  /** The flat colour of the line drawing, `#rrggbb`. */
  colour: string;
  /** The seed of the shape and of the craters. The same id has the same seed. */
  seed: number;
  facts: BodyFacts;
  look: BodyLook;
  /** The words under the picture: the shape is always a guess, and a derived or unknown size says so. */
  note: { en: string; ja: string };
  /** The short line drawn on the picture. The longer `note` is the accessible name. */
  line: { en: string; ja: string };
  /** The guessed shape. The same object every time for this rock. */
  table: ShapeTable;
}

const SIZES = ["measured", "sheet", "derived", "unknown"] as const;

const TONES: Record<AlbedoTone, { colour: string; dark: readonly [number, number, number]; light: readonly [number, number, number] }> = {
  grey: { colour: "#8b8f96", dark: [0.42, 0.44, 0.47], light: [0.66, 0.68, 0.72] },
  dark: { colour: "#4a4e55", dark: [0.18, 0.19, 0.22], light: [0.38, 0.4, 0.44] },
  mid: { colour: "#8a8174", dark: [0.38, 0.34, 0.28], light: [0.62, 0.58, 0.5] },
  bright: { colour: "#d5d8dc", dark: [0.72, 0.74, 0.77], light: [0.94, 0.95, 0.97] },
};

/**
 * One surface shader for every estimated rock. `uRockSeed`, `uRockDark` and `uRockLight` are that moon's own, set on its material, so the page compiles this once.
 */
export const ESTIMATED_SURFACE = `
uniform float uRockSeed;
uniform vec3 uRockDark;
uniform vec3 uRockLight;
vec4 surface(vec3 p) {
  float h1 = craters(p, 3.0, 0.85, uRockSeed);
  float h2 = craters(p, 8.0, 0.55, uRockSeed + 7.0) * 0.6;
  float h3 = craters(p, 18.0, 0.40, uRockSeed + 3.0) * 0.3;
  float h = h1 + h2 + h3;
  float hr = h1 * reliefShare(p, 3.0) + h2 * reliefShare(p, 8.0) + h3 * reliefShare(p, 18.0);
  float tone = fbm(p * 2.4 + uRockSeed);
  vec3 col = mix(uRockDark, uRockLight, smoothstep(0.25, 0.75, tone));
  col *= 1.0 + 0.9 * h;
  return vec4(col, hr);
}`;

/** The albedo class: dark under 0.08, mid under 0.25, bright from there, and grey when the albedo is unknown. */
export function albedoTone(albedo: number | null): AlbedoTone {
  if (albedo === null || !Number.isFinite(albedo)) return "grey";
  if (albedo < 0.08) return "dark";
  if (albedo < 0.25) return "mid";
  return "bright";
}

const plain = (value: string): string => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash01(seed: number, i: number, salt: number): number {
  let h = Math.imul(seed ^ Math.imul(i + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A lump in about -1 to 1, the same for the same seed and direction. */
function noise(seed: number, x: number, y: number, z: number): number {
  let n = 0;
  let w = 0;
  for (let i = 0; i < 4; i += 1) {
    const cx = hash01(seed, i, 1) * 2 - 1;
    const cy = hash01(seed, i, 2) * 2 - 1;
    const cz = hash01(seed, i, 3) * 2 - 1;
    const amp = 0.55 + hash01(seed, i, 4);
    n += (amp * (x * cx + y * cy + z * cz)) / (Math.hypot(cx, cy, cz) || 1);
    w += amp;
  }
  return n / w;
}

const clampLump = (value: number): number => Math.min(1.7, Math.max(0.45, value));

/** How round the rock is: 0 is a potato (under 100 km), 1 is a globe (200 km and up), and the sizes between blend. */
function roundness(radiusKm: number): number {
  if (radiusKm >= 200) return 1;
  if (radiusKm <= 100) return 0;
  return (radiusKm - 100) / 100;
}

/**
 * The three axes, longest first. A small moon is about 1 : 0.6–0.9 : 0.5–0.8, from its seed. A large one is 1 : 1 : 1.
 */
function axesOf(seed: number, radiusKm: number): readonly [number, number, number] {
  const round = roundness(radiusKm);
  const b0 = 0.6 + 0.3 * hash01(seed, 1, 21);
  const c0 = 0.5 + 0.3 * hash01(seed, 2, 22);
  const b = Math.max(b0, c0);
  const c = Math.min(b0, c0);
  return [1, b + (1 - b) * round, c + (1 - c) * round];
}

/** The radius of an ellipsoid in a direction, as a fraction of its longest axis. */
function ellipsoid(x: number, y: number, z: number, axes: readonly [number, number, number]): number {
  const t = (x * x) / (axes[0] * axes[0]) + (y * y) / (axes[1] * axes[1]) + (z * z) / (axes[2] * axes[2]);
  return t > 0 ? 1 / Math.sqrt(t) : 1;
}

/**
 * A table of radii whose mean is `radiusKm`. A small moon is elongated, a large one nearly round, and both carry the same lumps. The poles are one radius each.
 * The steps fit in 16 bits: the unit is chosen from twelve times the radius, which covers a potato's gap between neighbours.
 */
function shapeOf(seed: number, radiusKm: number): ShapeTable {
  const lon = 16;
  const lat = 8;
  const rows = lat + 1;
  const axes = axesOf(seed, radiusKm);
  const lump = 0.35 * (1 - roundness(radiusKm));
  const raw: number[] = [];
  const at = (x: number, y: number, z: number): number => clampLump(1 + lump * noise(seed, x, y, z)) * ellipsoid(x, y, z, axes);
  for (let row = 0; row < rows; row += 1) {
    const phi = (Math.PI * row) / lat;
    const st = Math.sin(phi);
    const z = Math.cos(phi);
    const pole = row === 0 || row === lat ? at(0, 0, row === 0 ? 1 : -1) : undefined;
    for (let column = 0; column < lon; column += 1) {
      if (pole !== undefined) {
        raw.push(pole);
        continue;
      }
      const theta = (2 * Math.PI * column) / lon;
      raw.push(at(st * Math.cos(theta), st * Math.sin(theta), z));
    }
  }
  const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  const km = raw.map((value) => (value / mean) * radiusKm);
  const unit = Math.max(1, Math.floor(30000 / (12 * radiusKm + 1)));
  const whole = km.map((value) => Math.round(value * unit));
  const steps = new Int16Array(lon * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < lon; column += 1) {
      const i = row * lon + column;
      const above = row > 0 ? (whole[i - lon] as number) : 0;
      const left = column > 0 ? (whole[i - 1] as number) : 0;
      const aboveLeft = row > 0 && column > 0 ? (whole[i - lon - 1] as number) : 0;
      const predicted = column === 0 ? above : row === 0 ? left : left + above - aboveLeft;
      steps[i] = (whole[i] as number) - predicted;
    }
  }
  const bytes = new Uint8Array(steps.buffer, steps.byteOffset, steps.byteLength);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { lon, lat, unit, steps: btoa(binary) };
}

/** How far the longest radius is past the shortest. A potato is well above 1; a globe is near 1. */
export function rockSpread(seed: number, radiusKm: number): number {
  const radii = shapeRadii(shapeOf(seed, radiusKm));
  let low = Number.POSITIVE_INFINITY;
  let high = 0;
  for (const radius of radii) {
    if (radius < low) low = radius;
    if (radius > high) high = radius;
  }
  return high / low;
}

function notes(size: EstimatedSize): { en: string; ja: string } {
  if (size === "derived") return { en: "Shape estimated. Size estimated from brightness.", ja: "形は推定。大きさは明るさからの推定" };
  if (size === "unknown") return { en: "Shape estimated. Size unknown.", ja: "形は推定。大きさは不明" };
  return { en: "Shape estimated.", ja: "形は推定" };
}

let byKey: Map<string, EstimatedMoonRow> | undefined;
function index(): Map<string, EstimatedMoonRow> {
  if (byKey !== undefined) return byKey;
  byKey = new Map();
  for (const row of ESTIMATED_MOONS) byKey.set(plain(row[2]), row);
  for (const row of ESTIMATED_MOONS) byKey.set(plain(row[0]), row);
  return byKey;
}

const cache = new Map<string, EstimatedRock>();

function build(row: EstimatedMoonRow): EstimatedRock {
  const [id, hostName, label, tenths, sizeCode, albedoThousandths] = row;
  const host = hostName as HostId;
  const sizeFrom: EstimatedSize = SIZES[sizeCode];
  const radiusKm = tenths > 0 ? tenths / 10 : 1;
  const albedo = albedoThousandths < 0 ? null : albedoThousandths / 1000;
  const tone = albedoTone(albedo);
  const paint = TONES[tone];
  const seed = hashId(id);
  const table = shapeOf(seed, radiusKm);
  const facts: BodyFacts = {
    id: host,
    kind: "moon",
    parent: host,
    name: { en: label, ja: label },
    radiusKm,
    flattening: 0,
    tiltDeg: 0,
    pole: { ra: 0, dec: 90 },
    prime: { w0: 0, rate: 360 },
    rotationHours: 24,
    colour: paint.colour,
  };
  const look: BodyLook = {
    id: host,
    surface: ESTIMATED_SURFACE,
    relief: 0.85,
    ambient: 0.08,
    wrap: 0.08,
    detail: { amount: 0.2, stretch: 1 },
    rock: { seed: (seed % 10000) / 100, dark: paint.dark, light: paint.light },
    shape: () => Promise.resolve(table),
  };
  return { id, host, label, radiusKm, sizeFrom, albedo, tone, colour: paint.colour, seed, facts, look, note: notes(sizeFrom), line: { en: "Shape estimated.", ja: "形は推定" }, table };
}

/**
 * The estimated rock for a catalogue id, a name or a designation (`himalia`, `Himalia`, `S/2003 J 18`). `null` for a body the package draws in full, and for a name that is not a moon.
 *
 * @param query - The catalogue id, name or designation.
 * @returns The rock, or `null`.
 */
export function estimatedRock(query: string): EstimatedRock | null {
  const key = plain(query);
  if (key === "" || key in BODIES) return null;
  const row = index().get(key);
  if (row === undefined) return null;
  let rock = cache.get(row[0]);
  if (rock === undefined) {
    rock = build(row);
    cache.set(row[0], rock);
  }
  return rock;
}

/**
 * The line drawing of an estimated rock: the equator of its guessed shape, filled with its colour. Not a body's line drawing.
 *
 * @param rock - The rock.
 * @param size - The picture's width in pixels.
 * @returns The SVG.
 */
export function estimatedRockLine(rock: EstimatedRock, size: number): string {
  const span = Math.max(32, Math.round(size));
  const radii = shapeRadii(rock.table);
  const row = rock.table.lat / 2;
  const cx = span / 2;
  const cy = span / 2;
  const reach = span * 0.36;
  let d = "";
  for (let column = 0; column < rock.table.lon; column += 1) {
    const radius = (radii[row * rock.table.lon + column] as number) / rock.radiusKm;
    const theta = (2 * Math.PI * column) / rock.table.lon;
    const x = cx + Math.cos(theta) * reach * radius;
    const y = cy + Math.sin(theta) * reach * radius;
    d += `${column === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${span} ${span}" role="presentation"><path d="${d}Z" fill="${rock.colour}"/></svg>`;
}
