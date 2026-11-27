// The flat solar system, as numbers: a top-down map of the Sun, the planets, the dwarf planets and small bodies, the belts, the comets and our spacecraft (the Tesla Roadster among them), in the ecliptic plane, with distances
// squeezed by the plan's logarithm or true. The same family as the flat maps (`./index.ts`): the same view and zoom names, the same words. Pure: no DOM, no clock reads (the moment is always given).
import { smallBodyAt, type SmallBody } from "../door/small-bodies.ts";
import { toJulianDate } from "../clock.ts";
import { cometOrbit, cometPosition, listComets, type CometRecord } from "../comets.ts";
import { craftPositionAu, sampleCraftPath } from "../craft-track.ts";
import { heliocentric } from "../ephemeris.ts";
import { BODIES, DWARF_IDS, MINOR_IDS, PLANET_IDS, type HostId, type MinorId } from "../facts.ts";
import { planRadius, planSunExtent, type PlanSpacing } from "../plan/layout.ts";
import { planetOrbit, type SpaceDwarf, type SpaceMinor, type SpacePlanet } from "../space/frame.ts";
import { SPACECRAFT, SPACECRAFT_IDS, type SpacecraftId } from "../spacecraft.ts";
import { toEcliptic, type Vec3 } from "../vec.ts";
import { MAX_ZOOM } from "./geometry.ts";

const DAY = 86_400_000;

/**
 * The kinds of thing the flat solar system draws, which a page can switch on and off: `planets` (the eight and Pluto), `dwarfs` (the dwarf planets and the named asteroids and centaurs), `belts` (the asteroid belts and the Kuiper belt, as clouds of points), `comets` and `craft`.
 *
 * @example
 * ```ts
 * import { SYSTEM_LAYERS } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_LAYERS.join(", "));
 * ```
 */
export const SYSTEM_LAYERS = ["planets", "dwarfs", "belts", "comets", "craft"] as const;

/**
 * One layer of the flat solar system.
 *
 * @example
 * ```ts
 * import type { SystemLayer } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const layer: SystemLayer = "comets";
 * console.log(layer);
 * ```
 */
export type SystemLayer = (typeof SYSTEM_LAYERS)[number];

/**
 * What a mark on the map is: the Sun (`star`), a `planet`, a `dwarf-planet`, an `asteroid`, a `centaur`, a `comet` or a `spacecraft`.
 *
 * @example
 * ```ts
 * import type { SystemKind } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const kind: SystemKind = "spacecraft";
 * console.log(kind);
 * ```
 */
export type SystemKind = "star" | "planet" | "dwarf-planet" | "asteroid" | "centaur" | "comet" | "spacecraft";

/**
 * How the map sits in its box: the box's size in pixels, the place under its middle in the map's own plane (the unit disc, the edge at 1, x to the March equinox and y a quarter turn on), and the zoom (1 shows the whole disc, up to 8).
 *
 * @example
 * ```ts
 * import type { SystemView } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const view: SystemView = { width: 800, height: 450, centerX: 0, centerY: 0, zoom: 1 };
 * console.log(view.zoom);
 * ```
 */
export interface SystemView {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  zoom: number;
}

/**
 * The furthest the map zooms in: the same 8 times as the flat maps of the Moon and Mars.
 *
 * @example
 * ```ts
 * import { SYSTEM_MAX_ZOOM } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_MAX_ZOOM);
 * ```
 */
export const SYSTEM_MAX_ZOOM = MAX_ZOOM;

/**
 * The distance, in astronomical units, the squeezed scale treats as near the Sun: the plan's own (`<wakusei-plan>`), so the two maps put a planet in the same place on their radii.
 *
 * @example
 * ```ts
 * import { SYSTEM_INNER } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_INNER);
 * ```
 */
export const SYSTEM_INNER = 0.1;

/**
 * The reach of the map, the distance at its edge in astronomical units: the smallest of 50, 100, 200, 500, 1,000 and 2,000 that holds `farthest`, or `fixed` where one is asked for.
 *
 * @param farthest - The distance in the plane of the farthest thing that must be inside, in au.
 * @param fixed - A reach the page asked for, in au; used when it is above zero and finite.
 * @returns The distance at the edge, in au.
 *
 * @example
 * ```ts
 * import { systemExtent } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemExtent(49.3), systemExtent(141), systemExtent(141, 30));
 * ```
 */
export const systemExtent = (farthest: number, fixed?: number): number => (fixed !== undefined && Number.isFinite(fixed) && fixed > 0 ? fixed : planSunExtent(farthest));

/**
 * Where a place in the ecliptic plane falls on the map's disc: its direction kept, its distance squeezed (`ln(1 + d / 0.1) / ln(1 + edge / 0.1)`, the plan's `planRadius`) or true (`d / edge`). The edge is 1.
 *
 * @param x - Astronomical units toward the March equinox.
 * @param y - Astronomical units a quarter turn on.
 * @param extent - The distance at the edge, in au.
 * @param spacing - `squeezed` or `true`.
 * @returns `x` and `y` in the unit disc, and `r`, the distance from the middle (above 1 beyond the edge).
 *
 * @example
 * ```ts
 * import { squeezeAu } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const earth = squeezeAu(1, 0, 50, "squeezed");
 * console.log(earth.r.toFixed(2), squeezeAu(1, 0, 50, "true").r.toFixed(2));
 * ```
 */
export function squeezeAu(x: number, y: number, extent: number, spacing: PlanSpacing): { x: number; y: number; r: number } {
  const d = Math.hypot(x, y);
  if (d === 0) return { x: 0, y: 0, r: 0 };
  const r = planRadius(d, extent, spacing, SYSTEM_INNER);
  return { x: (x / d) * r, y: (y / d) * r, r };
}

/**
 * The distance in astronomical units that a radius of the disc stands for: the opposite of the squeeze, so a point pressed on the map can be read as a distance.
 *
 * @param r - The distance from the middle in the unit disc.
 * @param extent - The distance at the edge, in au.
 * @param spacing - `squeezed` or `true`.
 * @returns Astronomical units.
 *
 * @example
 * ```ts
 * import { radiusAu, squeezeAu } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(radiusAu(squeezeAu(5.2, 0, 50, "squeezed").r, 50, "squeezed").toFixed(2));
 * ```
 */
export const radiusAu = (r: number, extent: number, spacing: PlanSpacing): number => (spacing === "true" ? r * extent : SYSTEM_INNER * Math.expm1(r * Math.log1p(extent / SYSTEM_INNER)));

/**
 * Pixels for one unit of the disc: the whole disc fills the box's shorter side at zoom 1.
 *
 * @param view - The view.
 * @returns Pixels to the disc's edge from its middle.
 *
 * @example
 * ```ts
 * import { systemScale } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemScale({ width: 800, height: 400, centerX: 0, centerY: 0, zoom: 1 }), systemScale({ width: 800, height: 400, centerX: 0, centerY: 0, zoom: 2 }));
 * ```
 */
export const systemScale = (view: SystemView): number => (Math.min(view.width, view.height) / 2) * view.zoom * 0.96;

/**
 * Where a place of the disc falls in the box, in pixels from its top left (y goes up on the map and down on the screen).
 *
 * @param view - The view.
 * @param x - Across the unit disc.
 * @param y - Up the unit disc.
 * @returns `x` and `y` in pixels.
 *
 * @example
 * ```ts
 * import { projectSystem } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(projectSystem({ width: 800, height: 400, centerX: 0, centerY: 0, zoom: 1 }, 0, 0));
 * ```
 */
export function projectSystem(view: SystemView, x: number, y: number): { x: number; y: number } {
  const k = systemScale(view);
  return { x: view.width / 2 + (x - view.centerX) * k, y: view.height / 2 - (y - view.centerY) * k };
}

/**
 * The place of the disc at a point of the box: the opposite of `projectSystem`.
 *
 * @param view - The view.
 * @param px - Pixels from the left.
 * @param py - Pixels from the top.
 * @returns `x` and `y` in the unit disc.
 *
 * @example
 * ```ts
 * import { unprojectSystem } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(unprojectSystem({ width: 800, height: 400, centerX: 0, centerY: 0, zoom: 1 }, 400, 200));
 * ```
 */
export function unprojectSystem(view: SystemView, px: number, py: number): { x: number; y: number } {
  const k = systemScale(view);
  return { x: view.centerX + (px - view.width / 2) / k, y: view.centerY - (py - view.height / 2) / k };
}

/**
 * The view kept inside what the map can show: the zoom between 1 and 8, and the middle never further from the Sun than the disc's edge.
 *
 * @param view - The view asked for.
 * @returns The view to use.
 *
 * @example
 * ```ts
 * import { clampSystemView } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(clampSystemView({ width: 800, height: 400, centerX: 3, centerY: 4, zoom: 20 }));
 * ```
 */
export function clampSystemView(view: SystemView): SystemView {
  const zoom = Math.min(SYSTEM_MAX_ZOOM, Math.max(1, Number.isFinite(view.zoom) ? view.zoom : 1));
  let x = Number.isFinite(view.centerX) ? view.centerX : 0;
  let y = Number.isFinite(view.centerY) ? view.centerY : 0;
  const d = Math.hypot(x, y);
  if (d > 1) {
    x /= d;
    y /= d;
  }
  return { ...view, zoom, centerX: x, centerY: y };
}

/**
 * Zoom by a factor about a point of the box, so the place under that point stays under it (as far as the clamp allows).
 *
 * @param view - The view.
 * @param factor - Above 1 zooms in.
 * @param px - Pixels from the left; the middle when left out.
 * @param py - Pixels from the top; the middle when left out.
 * @returns The new view, clamped.
 *
 * @example
 * ```ts
 * import { zoomSystemAbout } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(zoomSystemAbout({ width: 800, height: 400, centerX: 0, centerY: 0, zoom: 1 }, 2, 600, 100).zoom);
 * ```
 */
export function zoomSystemAbout(view: SystemView, factor: number, px = view.width / 2, py = view.height / 2): SystemView {
  const at = unprojectSystem(view, px, py);
  const zoom = Math.min(SYSTEM_MAX_ZOOM, Math.max(1, view.zoom * factor));
  const next = { ...view, zoom };
  const k = systemScale(next);
  return clampSystemView({ ...next, centerX: at.x - (px - view.width / 2) / k, centerY: at.y + (py - view.height / 2) / k });
}

/**
 * Distances worth a ring on the map, in astronomical units: the Earth's (1), Jupiter's (5), Saturn's (10), Neptune's (30) and 100.
 *
 * @example
 * ```ts
 * import { SYSTEM_RINGS } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_RINGS.join(" "));
 * ```
 */
export const SYSTEM_RINGS: readonly number[] = [1, 5, 10, 30, 100, 500];

/** The colour each planet is drawn in: artistic, chosen to tell them apart on a dark map. */
const PLANET_COLOURS: Readonly<Record<string, string>> = { mercury: "#b8b2a8", venus: "#efd9a7", earth: "#4fa3ff", mars: "#ee6a4b", jupiter: "#e0a96d", saturn: "#ead591", uranus: "#8fe8ec", neptune: "#6b86ff", pluto: "#cdb8a6" };
/** The craft's colours, in the package's order of craft. */
const CRAFT_COLOURS = ["#ffd23f", "#4cc9f0", "#6ee7a0", "#a78bfa", "#ff9ecb", "#f4a261", "#b8e986", "#5eead4", "#7aa2ff", "#e879f9", "#fde68a"] as const;

/**
 * The colour of a mark: a planet's own, a pale grey for the dwarf planets and small bodies, ice blue for a comet and one of a set for each craft; the Tesla Roadster is red.
 *
 * @param id - A planet, dwarf planet, small body, comet or craft id, or `sun`.
 * @param layer - Its layer.
 * @returns A CSS colour.
 *
 * @example
 * ```ts
 * import { systemColour } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemColour("earth", "planets"), systemColour("roadster", "craft"));
 * ```
 */
export function systemColour(id: string, layer: SystemLayer | "sun"): string {
  if (layer === "sun") return "#ffd54f";
  if (layer === "planets") return PLANET_COLOURS[id] ?? "#ffffff";
  if (layer === "dwarfs") return "#cfd6e0";
  if (layer === "comets") return "#9ee6ff";
  if (layer === "belts") return "#d9d3c3";
  if (id === "roadster") return "#ff3b30";
  const at = SPACECRAFT_IDS.indexOf(id as SpacecraftId);
  return CRAFT_COLOURS[(at < 0 ? 0 : at) % CRAFT_COLOURS.length]!;
}

/** The names of the minor bodies the map draws as dwarfs-layer marks: Halley is a comet here. */
const SMALL_BODIES: readonly MinorId[] = MINOR_IDS.filter((id) => id !== "halley");
/** The ids of the planets and of the dwarf layer, in order. */
const PLANETS: readonly string[] = PLANET_IDS;
const DWARFS: readonly string[] = [...DWARF_IDS, ...SMALL_BODIES];

/**
 * The ids the dwarfs layer draws: the dwarf planets, then Vesta, Pallas, Chiron and Pholus (Halley is among the comets).
 *
 * @example
 * ```ts
 * import { SYSTEM_DWARFS } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(SYSTEM_DWARFS.join(", "));
 * ```
 */
export const SYSTEM_DWARFS: readonly string[] = DWARFS;

/**
 * One thing on the map at a moment.
 *
 * @example
 * ```ts
 * import { systemMarks, type SystemMark } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const earth: SystemMark = systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets"] }).find((m) => m.id === "earth")!;
 * console.log(earth.distanceAu.toFixed(2), earth.kind);
 * ```
 */
export interface SystemMark {
  id: string;
  layer: SystemLayer | "sun";
  kind: SystemKind;
  /** Where it is, in astronomical units from the Sun, in the J2000 ecliptic. */
  au: Vec3;
  /** Its distance from the Sun in the plane of the map, in au (its height does not count: the map is a view from above). */
  planeAu: number;
  /** Its distance from the Sun in three dimensions, in au. */
  distanceAu: number;
  /** Where it falls on the unit disc for the reach and spacing asked for. */
  x: number;
  y: number;
  /** True when it is further out than the edge: it is left off the map. */
  beyond: boolean;
}

/**
 * What `systemMarks` is asked: the layers, the craft and comets to draw (all by default), the reach (`auto`, the smallest step that holds the planets, the dwarf planets and the craft shown, by default) and the spacing.
 *
 * @example
 * ```ts
 * import type { SystemOptions } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const options: SystemOptions = { layers: ["planets", "craft"], craft: ["roadster"], spacing: "true" };
 * console.log(options.layers);
 * ```
 */
export interface SystemOptions {
  /** Default: every layer except the belts, which `systemBelts` places. */
  layers?: readonly SystemLayer[];
  /** The craft to draw; default all of them. */
  craft?: readonly string[];
  /** The comets to draw; default all of them. */
  comets?: readonly string[];
  /** A reach in au; default the smallest step that holds what is shown. */
  extent?: number;
  /** Default `squeezed`. */
  spacing?: PlanSpacing;
}

/**
 * The craft's place at a moment in astronomical units, or `undefined` while its path is not loaded (`loadSpacecraft`) or the moment is outside the record of its path (a craft that has not launched, or whose record has ended).
 *
 * @param id - The craft.
 * @param ms - Milliseconds since 1970 (UTC).
 * @returns The place, or `undefined`.
 *
 * @example
 * ```ts
 * import { loadSpacecraft } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 * import { craftAu } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * await loadSpacecraft("roadster");
 * const car = craftAu("roadster", Date.UTC(2026, 10, 17));
 * console.log(car === undefined ? "not loaded" : Math.hypot(car[0], car[1]).toFixed(1), "au from the Sun");
 * ```
 */
export function craftAu(id: string, ms: number): Vec3 | undefined {
  if (!SPACECRAFT_IDS.includes(id as SpacecraftId)) return undefined;
  return craftPositionAu(id as SpacecraftId, ms);
}

/** A comet's place, or undefined where two-body motion has none. */
function cometAu(record: CometRecord, ms: number): Vec3 | undefined {
  try {
    return cometPosition(record, ms);
  } catch {
    return undefined;
  }
}

/** The places of the planets and of the dwarf layer, in au. */
function bodyAu(id: string, ms: number): Vec3 {
  return heliocentric(id as HostId | MinorId, ms);
}

/**
 * The name of a thing on the map in a language: the Sun, a planet, a dwarf planet or small body, a comet or a craft. The Tesla Roadster is called by its car's name (the mannequin is Starman, in the facts).
 *
 * @param id - The thing's id.
 * @param lang - `en` or `ja`.
 * @returns The name, or the id where there is none.
 *
 * @example
 * ```ts
 * import { systemName } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemName("roadster", "en"), "|", systemName("roadster", "ja"), "|", systemName("halley", "ja"));
 * ```
 */
export function systemName(id: string, lang: "en" | "ja"): string {
  if (id === "roadster") return lang === "ja" ? "テスラ・ロードスター" : "Tesla Roadster";
  if (SPACECRAFT_IDS.includes(id as SpacecraftId)) return SPACECRAFT[id as SpacecraftId].name[lang];
  const comet = listComets().find((one) => one.id === id);
  if (comet) return comet.name[lang];
  const body = (BODIES as Readonly<Record<string, { name: { en: string; ja: string } }>>)[id];
  return body ? body.name[lang] : id;
}

/**
 * What every drawn thing is at a moment, with its place on the disc. The planets come from VSOP87B and the fitted tables, the dwarf planets and small bodies from their fitted tables or one epoch's elements, the comets by two-body motion on JPL's elements,
 * and the craft from the Horizons paths, which must be loaded first (`loadSpacecraft`); a craft with no path at that moment is left out. A thing further out than the reach is marked `beyond` and not worth drawing.
 *
 * @param ms - Milliseconds since 1970 (UTC).
 * @param options - The layers, the craft and comets wanted, the reach and the spacing.
 * @returns The Sun first, then the planets, dwarfs, comets and craft.
 *
 * @example
 * ```ts
 * import { systemMarks } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const marks = systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets", "comets"] });
 * const earth = marks.find((m) => m.id === "earth")!;
 * console.log(marks.length, Math.round((Math.atan2(earth.au[1], earth.au[0]) * 180) / Math.PI), "degrees of ecliptic longitude");
 * ```
 */
export function systemMarks(ms: number, options: SystemOptions = {}): SystemMark[] {
  const layers = new Set(options.layers ?? SYSTEM_LAYERS.filter((one) => one !== "belts"));
  const spacing: PlanSpacing = options.spacing === "true" ? "true" : "squeezed";
  const raw: { id: string; layer: SystemLayer; kind: SystemKind; au: Vec3 }[] = [];
  if (layers.has("planets")) for (const id of PLANETS) raw.push({ id, layer: "planets", kind: "planet", au: bodyAu(id, ms) });
  if (layers.has("dwarfs"))
    for (const id of DWARFS) raw.push({ id, layer: "dwarfs", kind: id === "chiron" || id === "pholus" ? "centaur" : id === "vesta" || id === "pallas" ? "asteroid" : "dwarf-planet", au: bodyAu(id, ms) });
  if (layers.has("comets")) {
    const wanted = options.comets;
    for (const record of listComets()) {
      if (wanted !== undefined && !wanted.includes(record.id)) continue;
      const au = cometAu(record, ms);
      if (au !== undefined) raw.push({ id: record.id, layer: "comets", kind: "comet", au });
    }
  }
  if (layers.has("craft")) {
    const wanted = options.craft;
    for (const id of SPACECRAFT_IDS) {
      if (wanted !== undefined && !wanted.includes(id)) continue;
      const au = craftAu(id, ms);
      if (au !== undefined) raw.push({ id, layer: "craft", kind: "spacecraft", au });
    }
  }
  // the reach holds the planets, the dwarf planets and the craft drawn; comets and belts further out than it are left off
  const farthest = Math.max(0, ...raw.filter((one) => one.layer !== "comets").map((one) => Math.hypot(one.au[0], one.au[1])));
  const extent = systemExtent(farthest, options.extent);
  const place = (one: (typeof raw)[number]): SystemMark => {
    const at = squeezeAu(one.au[0], one.au[1], extent, spacing);
    return { ...one, planeAu: Math.hypot(one.au[0], one.au[1]), distanceAu: Math.hypot(one.au[0], one.au[1], one.au[2]), x: at.x, y: at.y, beyond: at.r > 1 };
  };
  const sun: SystemMark = { id: "sun", layer: "sun", kind: "star", au: [0, 0, 0], planeAu: 0, distanceAu: 0, x: 0, y: 0, beyond: false };
  return [sun, ...raw.map(place)];
}

/**
 * The reach the map stands at for what is drawn: what `systemMarks` used. Worked out the same way, from the planets, the dwarf planets and the craft shown, so the map's scale can be had without placing the marks again.
 *
 * @param marks - The marks from `systemMarks`.
 * @param fixed - A reach the page asked for, in au.
 * @returns The distance at the edge, in au.
 *
 * @example
 * ```ts
 * import { systemMarks, systemReach } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemReach(systemMarks(Date.UTC(2026, 10, 17), { layers: ["planets"] })));
 * ```
 */
export const systemReach = (marks: readonly SystemMark[], fixed?: number): number => systemExtent(Math.max(0, ...marks.filter((one) => one.layer !== "comets").map((one) => one.planeAu)), fixed);

/**
 * Where the bodies of the belts are at a moment, in au in the ecliptic plane: two numbers a body, the Kepler orbit of each one's elements (`beltPositions` without the height, which a view from above does not use).
 *
 * @param bodies - The belt bodies, from `loadBeltBodies`.
 * @param ms - Milliseconds since 1970 (UTC).
 * @param out - A list of `2 * bodies.length` numbers to fill in; made when left out.
 * @returns The list.
 *
 * @example
 * ```ts
 * import { systemBelts } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const body = { name: "T", a: 2.7, e: 0, i: 0, node: 0, peri: 0, M0: 0, epoch: 2461200.5, H: 9 };
 * console.log(systemBelts([body], Date.UTC(2026, 10, 17))[0]?.toFixed(2));
 * ```
 */
export function systemBelts(bodies: readonly SmallBody[], ms: number, out: Float32Array = new Float32Array(bodies.length * 2)): Float32Array {
  const jd = toJulianDate(ms);
  for (let k = 0; k < bodies.length; k += 1) {
    const p = smallBodyAt(bodies[k]!, jd);
    out[k * 2] = p[0];
    out[k * 2 + 1] = p[1];
  }
  return out;
}

const orbitCache = new Map<string, readonly (readonly [number, number])[]>();
const YEAR = 365.25 * DAY;

/**
 * The orbit line of a planet, dwarf planet or small body, as points in the ecliptic plane in au: one trip round the Sun from the start of the year the moment is in (a planet's path changes by less than a pixel in a year), kept for that year.
 *
 * @param id - A planet, dwarf planet or small body of the map.
 * @param ms - Milliseconds since 1970 (UTC).
 * @param points - How many steps round it.
 * @returns The points; the last is the first again.
 *
 * @example
 * ```ts
 * import { systemOrbit } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * const line = systemOrbit("earth", Date.UTC(2026, 10, 17));
 * console.log(line.length, Math.hypot(...line[0]!).toFixed(2));
 * ```
 */
export function systemOrbit(id: string, ms: number, points = 96): readonly (readonly [number, number])[] {
  const bucket = Math.floor(ms / YEAR);
  const key = `${id}|${bucket}|${points}`;
  let found = orbitCache.get(key);
  if (found === undefined) {
    if (orbitCache.size > 300) orbitCache.clear();
    // `planetOrbit` answers in the scene's axes (J2000 equatorial, y north): back to the equatorial axes, then the ecliptic
    found = planetOrbit(id as SpacePlanet | SpaceDwarf | SpaceMinor, bucket * YEAR, points).map((p) => {
      const e = toEcliptic([p[0], -p[2], p[1]]);
      return [e[0], e[1]] as const;
    });
    orbitCache.set(key, found);
  }
  return found;
}

/**
 * A comet's orbit line as points in the ecliptic plane in au, as far out as the reach.
 *
 * @param id - The comet's id.
 * @param reach - The furthest distance to draw, in au.
 * @returns The points.
 *
 * @example
 * ```ts
 * import { systemCometOrbit } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * console.log(systemCometOrbit("halley", 50).length > 20);
 * ```
 */
export function systemCometOrbit(id: string, reach: number): readonly (readonly [number, number])[] {
  const record = listComets().find((one) => one.id === id);
  if (record === undefined || !(reach > record.q)) return [];
  const flat = cometOrbit(record, 120, reach);
  const out: [number, number][] = [];
  for (let k = 0; k + 2 < flat.length; k += 3) out.push([flat[k]!, flat[k + 1]!]);
  return out;
}

/**
 * A craft's whole path as points in the ecliptic plane, `count` steps over its record, each with its moment. Break drawn lines at the craft's Horizons joins. `[]` while the path is not loaded.
 *
 * @param id - The craft.
 * @param count - How many steps (from 2).
 * @returns Points with their moments in milliseconds since 1970.
 *
 * @example
 * ```ts
 * import { loadSpacecraft } from "@johnmorrisdotca/wakusei-planets/spacecraft";
 * import { craftPath } from "@johnmorrisdotca/wakusei-planets/flat/system";
 *
 * await loadSpacecraft("roadster");
 * const path = craftPath("roadster", 100);
 * console.log(path.length, new Date(path[0]!.ms).getUTCFullYear(), new Date(path[path.length - 1]!.ms).getUTCFullYear());
 * ```
 */
export function craftPath(id: string, count = 300): { x: number; y: number; ms: number }[] {
  if (!SPACECRAFT_IDS.includes(id as SpacecraftId)) return [];
  const { start, end } = SPACECRAFT[id as SpacecraftId].record;
  if (end === 0) return [];
  return sampleCraftPath(id as SpacecraftId, start, end, Math.max(2, Math.floor(count)));
}

export { SYSTEM_WORDS, saySystem } from "./system-words.ts";
export type { SystemPick, WakuseiFlatSystem } from "./system-element.ts";
