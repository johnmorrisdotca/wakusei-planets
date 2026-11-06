// The portrait builder's scene as plain data, and everything that can be worked out from it without a screen: where each body goes when the layout is automatic, the camera that fits them,
// which body is under a pointer, where a dragged body snaps, the order they are drawn in, the history for undo, and the short text that keeps a scene in the address. Pure: no DOM, no three.js.
import { ORBITS } from "../data/orbits.ts";
import { heliocentric, moonVector } from "../ephemeris.ts";
import { BODIES, DWARF_IDS, MOONS_OF, PLANET_IDS, ringReach, type BodyId, type HostId, type Look, type MoonId } from "../facts.ts";

/** How the automatic layout arranges the bodies. */
export type Arrange = "row" | "arc" | "grid" | "orbit";
/** `true`: every size to scale. `readable`: sizes squeezed together so a small body can still be seen. */
export type ScaleMode = "true" | "readable";
export type Background = "black" | "stars" | "gradient" | "transparent";

/**
 * One body in the scene: which body, where it is and how big, how it is turned and how fast it turns by itself.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, type PortraitItem } from "@johnmorrisdotca/wakusei-planets";
 *
 * const saturn: PortraitItem = addBody(defaultPortrait(), "saturn").items[0]!;
 * console.log(saturn.body, saturn.turn);
 * ```
 */
export interface Item {
  body: BodyId;
  x: number;
  y: number;
  /** The radius, in scene units. */
  r: number;
  /** The longitude at the middle of the disc, degrees east (with a date: turned this much from the real one). */
  spin: number;
  /** The pole's lean on the page, degrees; the body's own tilt when left out. */
  tilt?: number;
  /** How far the viewer looks over the pole, degrees; the usual for the body when left out. */
  pitch?: number;
  /** Degrees a second it turns by itself, eastward. */
  turn: number;
}

/**
 * A portrait scene: the bodies, back to front, and how they are arranged, sized, lit and drawn. Plain data: keep it, change it by making a new one, and `encodeScene` it for an address.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, type Portrait } from "@johnmorrisdotca/wakusei-planets";
 *
 * const scene: Portrait = addBody(addBody(defaultPortrait(), "jupiter"), "io");
 * console.log(scene.items.length, scene.layout, scene.scale);
 * ```
 */
export interface Portrait {
  /** Back to front. */
  items: Item[];
  /** `auto`: the layout places and sizes every body. `manual`: the positions and sizes below are used as they are. */
  layout: "auto" | "manual";
  arrange: Arrange;
  scale: ScaleMode;
  /** `auto`: a planet's moons that are in the scene go round it in orbit order. `manual`: each body is placed by itself. */
  moons: "auto" | "manual";
  look: Look;
  bg: Background;
  /** Width over height. */
  aspect: number;
  /** Where the Sun is: `az` clockwise from the top of the picture, `el` toward the viewer (0 along the page, 90 straight at it), degrees. */
  light: { az: number; el: number };
  labels: boolean;
  orbits: boolean;
  shadows: boolean;
  /** The body as the Earth sees it on this date (ISO), or `undefined` for a portrait. */
  date: string | undefined;
  /** The view in a manual layout: the centre and the half-height, in scene units. An automatic layout always fits. */
  camera: { x: number; y: number; h: number };
}

/**
 * A body of a scene as the layout puts it: its place and size now (stored, or worked out by an automatic layout), and how far its picture reaches past the disc.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, layoutPortrait, type PlacedItem } from "@johnmorrisdotca/wakusei-planets";
 *
 * const placed: PlacedItem[] = layoutPortrait(addBody(defaultPortrait(), "saturn")).placed;
 * console.log(placed[0]?.reach, placed[0]?.r);
 * ```
 */
export interface Placed extends Item {
  index: number;
  /** How far the picture of the body reaches from its centre (rings, the Sun's glow), in scene units. */
  reach: number;
}

/**
 * What a layout works out for a scene: every body placed, and the camera that holds them (its centre and half-height, in the scene's units).
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, layoutPortrait, type PortraitLayout } from "@johnmorrisdotca/wakusei-planets";
 *
 * const layout: PortraitLayout = layoutPortrait(addBody(defaultPortrait(), "mars"));
 * console.log(layout.camera.h);
 * ```
 */
export interface Resolved {
  placed: Placed[];
  camera: { x: number; y: number; h: number };
}

export const ASPECTS: readonly (readonly [string, number])[] = [["16:9", 16 / 9], ["4:3", 4 / 3], ["1:1", 1], ["3:4", 3 / 4]];
export const MAX_ITEMS = 40;

/** The Sun, then each planet and dwarf planet followed by its moons nearest first: the order a layout and a row of buttons use. */
export const ORDER: readonly BodyId[] = ["sun", ...[...PLANET_IDS, ...DWARF_IDS].flatMap((planet) => [planet, ...(planet in MOONS_OF ? [...MOONS_OF[planet as keyof typeof MOONS_OF]].sort(byDistance) : [])])] as BodyId[];
function byDistance(a: BodyId, b: BodyId): number {
  return (ORBITS[a]?.a ?? 0) - (ORBITS[b]?.a ?? 0);
}
export const rankOf = (id: BodyId): number => ORDER.indexOf(id);

/**
 * An empty scene with the usual settings: an automatic row, readable sizes, the stars behind, the Sun upper left.
 *
 * @returns A new scene with no bodies.
 *
 * @example
 * ```ts
 * import { defaultPortrait } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(defaultPortrait().bg);
 * ```
 */
export function defaultPortrait(): Portrait {
  return {
    items: [],
    layout: "auto",
    arrange: "row",
    scale: "readable",
    moons: "auto",
    look: "painted",
    bg: "stars",
    aspect: 16 / 9,
    light: { az: 300, el: 38 },
    labels: true,
    orbits: true,
    shadows: true,
    date: undefined,
    camera: { x: 0, y: 0, h: 1 },
  };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round = (v: number, places = 4): number => Math.round(v * 10 ** places) / 10 ** places;

// --- sizes ---------------------------------------------------------------------------------------------------------------------------------------------

/** How far the picture of a body reaches past its disc, in its radii: Saturn's rings, the Sun's glow. */
export const reachOf = (id: BodyId): number => (id === "sun" ? 1.7 : Math.max(1, ringReach(BODIES[id]) * 1.04));

/** Raw sizes for the bodies, in any unit, in proportion: true to scale, or squeezed (a root of the radius) with the smallest lifted to a tenth of the largest so every body can be seen. */
export function sizesFor(ids: readonly BodyId[], mode: ScaleMode): number[] {
  if (mode === "true") return ids.map((id) => BODIES[id].radiusKm);
  const raw = ids.map((id) => BODIES[id].radiusKm ** 0.3);
  const floor = 0.11 * Math.max(...raw, 0);
  return raw.map((r) => Math.max(r, floor));
}

// --- the automatic layout -------------------------------------------------------------------------------------------------------------------------------

interface Unit {
  members: number[];
  /** Offsets of each member from the unit's first member, in raw units. */
  at: number[];
  minX: number;
  maxX: number;
  halfH: number;
}

/** Groups: a planet with its moons that are in the scene, or a body alone. */
function groups(items: readonly Item[], moons: "auto" | "manual"): number[][] {
  const out: number[][] = [];
  const owner = new Map<BodyId, number[]>();
  items.forEach((item, i) => {
    const parent = BODIES[item.body].parent;
    const home = moons === "auto" && parent !== undefined ? owner.get(parent) : undefined;
    if (home !== undefined) home.push(i);
    else {
      const group = [i];
      out.push(group);
      owner.set(item.body, group);
    }
  });
  // moons nearest first inside their planet's group
  for (const group of out) if (group.length > 1) group.splice(1, group.length - 1, ...group.slice(1).sort((a, b) => byDistance(items[a]!.body, items[b]!.body)));
  return out;
}

/** A planet at the left of its group and its moons in a line to the right of it, in orbit order, each clear of the last. */
function unitOf(members: number[], radii: readonly number[], ids: readonly BodyId[]): Unit {
  const first = members[0]!;
  const reachFirst = radii[first]! * reachOf(ids[first]!);
  const at = [0];
  let cursor = reachFirst;
  let maxX = reachFirst;
  let halfH = reachFirst;
  for (const m of members.slice(1)) {
    const r = radii[m]!;
    const x = cursor + 0.22 * radii[first]! + r;
    at.push(x);
    cursor = x + r;
    maxX = Math.max(maxX, x + r);
    halfH = Math.max(halfH, r);
  }
  return { members, at, minX: -reachFirst, maxX, halfH };
}

function arrangeUnits(units: Unit[], how: Arrange, aspect: number): { ox: number; oy: number }[] {
  const n = units.length;
  const widths = units.map((u) => u.maxX - u.minX);
  const tallest = Math.max(...units.map((u) => u.halfH * 2), 0);
  const gap = 0.12 * Math.max(...widths, tallest, 1e-9);
  if (how === "grid" && n > 1) {
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
    const cellW = Math.max(...widths) + gap;
    const cellH = tallest + gap;
    return units.map((u, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const rows = Math.ceil(n / cols);
      return { ox: (col - (cols - 1) / 2) * cellW - (u.minX + u.maxX) / 2, oy: ((rows - 1) / 2 - row) * cellH };
    });
  }
  const total = widths.reduce((a, b) => a + b, 0) + gap * Math.max(0, n - 1);
  let cursor = -total / 2;
  const out = units.map((u, i) => {
    const left = cursor;
    cursor += widths[i]! + gap;
    return { ox: left - u.minX, oy: 0 };
  });
  if (how === "arc" && n > 1) {
    const R = total * 0.85;
    for (const o of out) o.oy = (o.ox * o.ox) / (2 * R);
  }
  return out;
}

// --- the true orbit distance layout ---------------------------------------------------------------------------------------------------------------------

const AU_KM = 149_597_870.7;
const J2000 = Date.UTC(2000, 0, 1, 12);

interface Spot {
  x: number;
  y: number;
}

/** The ring a body goes round its centre on is drawn through it, so the layout keeps the centre of each body that has one. */
interface System {
  members: number[];
  spot: Map<number, Spot>;
  centre: Map<number, number>;
}

/**
 * The orbit layout, in kilometres: the Sun (if it is in the scene) with the planets at their true distance, each planet with its moons at theirs; or each planet with its moons, side by side.
 * With a date the bodies are where they really are, seen from above the ecliptic; without one they are in a line to the right of their centre. Sizes are true, or squeezed so the smallest can be seen.
 */
function orbitLayout(p: Portrait): { placed: Placed[]; reachPoints: Spot[] } {
  const items = p.items;
  const ms = p.date === undefined ? undefined : Date.parse(p.date);
  const when = ms !== undefined && Number.isFinite(ms) ? ms : undefined;
  const index = new Map<BodyId, number>(items.map((i, k) => [i.body, k]));
  const planetKind = (id: BodyId): boolean => BODIES[id].parent === undefined && id !== "sun";
  const planetSpot = (id: BodyId): Spot => {
    const v = heliocentric(id as HostId, when ?? J2000);
    return when === undefined ? { x: Math.hypot(v[0], v[1], v[2]) * AU_KM, y: 0 } : { x: v[0] * AU_KM, y: v[1] * AU_KM };
  };
  const moonSpot = (id: BodyId): Spot => {
    if (when === undefined) return { x: ORBITS[id]?.a ?? 0, y: 0 };
    const v = moonVector(id as MoonId, when);
    return { x: v[0], y: v[1] };
  };
  const systems: System[] = [];
  const taken = new Set<number>();
  const sun = index.get("sun");
  const attachMoons = (system: System, planet: number, at: Spot): void => {
    for (const [k, item] of items.entries()) {
      if (BODIES[item.body].parent !== items[planet]!.body || taken.has(k)) continue;
      const m = moonSpot(item.body);
      system.members.push(k);
      system.spot.set(k, { x: at.x + m.x, y: at.y + m.y });
      system.centre.set(k, planet);
      taken.add(k);
    }
  };
  if (sun !== undefined) {
    const system: System = { members: [sun], spot: new Map([[sun, { x: 0, y: 0 }]]), centre: new Map() };
    taken.add(sun);
    for (const [k, item] of items.entries()) {
      if (!planetKind(item.body)) continue;
      const at = planetSpot(item.body);
      system.members.push(k);
      system.spot.set(k, at);
      system.centre.set(k, sun);
      taken.add(k);
      attachMoons(system, k, at);
    }
    systems.push(system);
  }
  for (const [k, item] of items.entries()) {
    if (taken.has(k) || !planetKind(item.body)) continue;
    const system: System = { members: [k], spot: new Map([[k, { x: 0, y: 0 }]]), centre: new Map() };
    taken.add(k);
    if (p.moons === "auto") attachMoons(system, k, { x: 0, y: 0 });
    systems.push(system);
  }
  for (const [k] of items.entries()) {
    if (taken.has(k)) continue;
    systems.push({ members: [k], spot: new Map([[k, { x: 0, y: 0 }]]), centre: new Map() });
    taken.add(k);
  }
  // sizes: true, or squeezed against the size of the picture the distances make
  const ids = items.map((i) => i.body);
  let span = 0;
  for (const system of systems) {
    for (const k of system.members) {
      const c = system.centre.get(k);
      if (c === undefined) continue;
      const a = system.spot.get(k)!;
      const b = system.spot.get(c)!;
      span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  const biggest = Math.max(...ids.map((id) => BODIES[id].radiusKm));
  span = Math.max(span, biggest * 8);
  const radius = (id: BodyId): number => (p.scale === "true" ? BODIES[id].radiusKm : Math.max(0.014 * span, 0.06 * span * (BODIES[id].radiusKm / biggest) ** 0.4));
  const raw: Placed[] = items.map((item, index2) => ({ ...item, index: index2, x: 0, y: 0, r: radius(item.body), reach: radius(item.body) * reachOf(item.body) }));
  // the circle each body goes round its centre on reaches this far every way
  const extent = (system: System): { minX: number; maxX: number; minY: number; maxY: number } => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const k of system.members) {
      const a = system.spot.get(k)!;
      const reach = raw[k]!.reach;
      minX = Math.min(minX, a.x - reach);
      maxX = Math.max(maxX, a.x + reach);
      minY = Math.min(minY, a.y - reach);
      maxY = Math.max(maxY, a.y + reach);
      const c = system.centre.get(k);
      if (c !== undefined) {
        const b = system.spot.get(c)!;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        minX = Math.min(minX, b.x - d);
        maxX = Math.max(maxX, b.x + d);
        minY = Math.min(minY, b.y - d);
        maxY = Math.max(maxY, b.y + d);
      }
    }
    return { minX, maxX, minY, maxY };
  };
  const extents = systems.map(extent);
  const units: Unit[] = systems.map((s, k) => ({ members: s.members, at: [], minX: extents[k]!.minX, maxX: extents[k]!.maxX, halfH: Math.max(extents[k]!.maxY, -extents[k]!.minY) }));
  const spots = arrangeUnits(units, "row", p.aspect);
  const reachPoints: Spot[] = [];
  systems.forEach((s, k) => {
    const dy = (extents[k]!.minY + extents[k]!.maxY) / 2;
    for (const m of s.members) {
      const a = s.spot.get(m)!;
      raw[m]!.x = spots[k]!.ox + a.x;
      raw[m]!.y = a.y - dy;
    }
    reachPoints.push({ x: spots[k]!.ox + extents[k]!.minX, y: extents[k]!.minY - dy }, { x: spots[k]!.ox + extents[k]!.maxX, y: extents[k]!.maxY - dy });
  });
  return { placed: raw, reachPoints };
}

/** The camera that holds every body with a margin: its centre and half-height. */
export function fitCamera(placed: readonly Pick<Placed, "x" | "y" | "reach">[], aspect: number, margin = 1.1, labels = false): { x: number; y: number; h: number } {
  if (placed.length === 0) return { x: 0, y: 0, h: 1 };
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of placed) {
    x0 = Math.min(x0, p.x - p.reach);
    x1 = Math.max(x1, p.x + p.reach);
    y0 = Math.min(y0, p.y - p.reach);
    y1 = Math.max(y1, p.y + p.reach);
  }
  if (labels) y0 -= (y1 - y0) * 0.08;
  const h = Math.max((x1 - x0) / 2 / aspect, (y1 - y0) / 2, 1e-9) * margin;
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, h };
}

/**
 * Where every body is and how big, and the camera that holds them. A manual scene gives what it stores. An automatic one works it out (a row, an arc or a grid, a planet's moons round it in orbit
 * order) and fits the camera, so its units are the camera's half-height.
 *
 * @param scene - The scene.
 * @returns Every body placed, back to front, and the camera.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, layoutPortrait } from "@johnmorrisdotca/wakusei-planets";
 *
 * const { placed } = layoutPortrait(addBody(addBody(defaultPortrait(), "earth"), "moon"));
 * console.log(placed.map((item) => `${item.body} ${item.x.toFixed(2)}`).join(", "));
 * ```
 */
export function resolve(scene: Portrait): Resolved {
  const p = scene;
  if (p.layout === "manual" || p.items.length === 0) {
    return { placed: p.items.map((item, index) => ({ ...item, index, reach: item.r * reachOf(item.body) })), camera: p.camera };
  }
  if (p.arrange === "orbit") {
    const { placed: raw, reachPoints } = orbitLayout(p);
    const cam = fitCamera([...raw, ...reachPoints.map((q) => ({ x: q.x, y: q.y, reach: 0 }))], p.aspect, 1.1, p.labels);
    const k = 1 / cam.h;
    return { placed: raw.map((it) => ({ ...it, x: (it.x - cam.x) * k, y: (it.y - cam.y) * k, r: it.r * k, reach: it.reach * k })), camera: { x: 0, y: 0, h: 1 } };
  }
  const ids = p.items.map((item) => item.body);
  const sizes = sizesFor(ids, p.scale);
  const grouped = groups(p.items, p.moons);
  const units = grouped.map((members) => unitOf(members, sizes, ids));
  const spots = arrangeUnits(units, p.arrange, p.aspect);
  const raw: Placed[] = p.items.map((item, index) => ({ ...item, index, x: 0, y: 0, r: sizes[index]!, reach: sizes[index]! * reachOf(item.body) }));
  units.forEach((u, k) => {
    u.members.forEach((m, j) => {
      raw[m]!.x = spots[k]!.ox + u.at[j]!;
      raw[m]!.y = spots[k]!.oy;
    });
  });
  const cam = fitCamera(raw, p.aspect, 1.1, p.labels);
  const k = 1 / cam.h;
  return { placed: raw.map((it) => ({ ...it, x: (it.x - cam.x) * k, y: (it.y - cam.y) * k, r: it.r * k, reach: it.reach * k })), camera: { x: 0, y: 0, h: 1 } };
}

// --- changing a scene ----------------------------------------------------------------------------------------------------------------------------------

const copy = (p: Portrait): Portrait => ({ ...p, items: p.items.map((i) => ({ ...i })), light: { ...p.light }, camera: { ...p.camera } });

/** A manual layout with every body where the automatic one has it now. */
export function freeze(p: Portrait): Portrait {
  if (p.layout === "manual") return p;
  const { placed, camera } = resolve(p);
  const out = copy(p);
  out.layout = "manual";
  out.items = placed.map((q) => ({ body: q.body, x: q.x, y: q.y, r: q.r, spin: q.spin, turn: q.turn, ...(q.tilt !== undefined ? { tilt: q.tilt } : {}), ...(q.pitch !== undefined ? { pitch: q.pitch } : {}) }));
  out.camera = camera;
  return out;
}

/** The automatic layout again. */
export function auto(p: Portrait): Portrait {
  return { ...copy(p), layout: "auto" };
}

const fresh = (body: BodyId): Item => ({ body, x: 0, y: 0, r: 0.3, spin: BODIES[body].showLon ?? 0, turn: 0 });

/** The factor between a stored radius and the size a body should be by the scene's scale, from the bodies already there (0.3 of the half-height for the largest, for an empty scene). */
function unitSize(p: Portrait, adding: BodyId): number {
  const have = p.items.filter((i) => i.r > 0);
  if (have.length === 0) return 0.34 / sizesFor([adding], p.scale)[0]!;
  const sizes = sizesFor(have.map((i) => i.body), p.scale);
  const k = have.map((i, n) => i.r / sizes[n]!).sort((a, b) => a - b);
  return k[Math.floor(k.length / 2)]!;
}

/**
 * Add a body to a scene (once), in its place in the order of the sky for an automatic layout, or at the front and to the right of the others for a manual one.
 *
 * @param scene - The scene to add to; it is not changed.
 * @param body - The body's name.
 * @returns A new scene with the body, or the same one when it is already there.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait } from "@johnmorrisdotca/wakusei-planets";
 *
 * const scene = addBody(addBody(defaultPortrait(), "saturn"), "earth");
 * console.log(scene.items.map((item) => item.body).join(", "));
 * ```
 */
export function addBody(scene: Portrait, body: BodyId): Portrait {
  const p = scene;
  if (p.items.some((i) => i.body === body) || p.items.length >= MAX_ITEMS) return p;
  const out = copy(p);
  const item = fresh(body);
  if (p.layout === "auto") {
    item.r = 0.3;
    const at = out.items.findIndex((i) => rankOf(i.body) > rankOf(body));
    out.items.splice(at < 0 ? out.items.length : at, 0, item);
    return out;
  }
  const sized = sizesFor([body], p.scale)[0]! * unitSize(p, body);
  item.r = Math.max(0.006, sized);
  const right = out.items.reduce((m, i) => Math.max(m, i.x + i.r), -Infinity);
  item.x = out.items.length === 0 ? out.camera.x : right + item.r * 1.4 + 0.04;
  item.y = out.items.length === 0 ? out.camera.y : out.items[out.items.length - 1]!.y;
  out.items.push(item);
  const visible = Math.abs(item.x - out.camera.x) + item.r < out.camera.h * out.aspect && Math.abs(item.y - out.camera.y) + item.r < out.camera.h;
  if (!visible) out.camera = fitCamera(resolve(out).placed, out.aspect, 1.1, out.labels);
  return out;
}

export function removeBody(p: Portrait, body: BodyId): Portrait {
  if (!p.items.some((i) => i.body === body)) return p;
  const out = copy(p);
  out.items = out.items.filter((i) => i.body !== body);
  return out;
}

/** Add the moons of a planet that are not in the scene yet, in orbit order. */
export function addMoons(p: Portrait, planet: BodyId): Portrait {
  const moons = planet in MOONS_OF ? [...MOONS_OF[planet as keyof typeof MOONS_OF]].sort(byDistance) : [];
  let out = p;
  for (const moon of moons) out = addBody(out, moon);
  if (out === p || p.layout === "auto") return out;
  // manual: lay the new moons out round their planet the way the automatic layout does
  const host = out.items.find((i) => i.body === planet);
  if (host === undefined) return out;
  const copyOut = copy(out);
  let cursor = host.x + host.r * reachOf(host.body);
  for (const moon of moons) {
    const item = copyOut.items.find((i) => i.body === moon);
    if (item === undefined || p.items.some((i) => i.body === moon)) continue;
    item.x = cursor + 0.22 * host.r + item.r;
    item.y = host.y;
    cursor = item.x + item.r;
  }
  return copyOut;
}

/** Move one body to a new place in the list: the front is the end. */
export function moveInOrder(p: Portrait, from: number, to: number): Portrait {
  const target = clamp(to, 0, p.items.length - 1);
  if (from === target || from < 0 || from >= p.items.length) return p;
  const out = copy(p);
  const [item] = out.items.splice(from, 1);
  out.items.splice(target, 0, item!);
  return out;
}

/** Change one body's fields. */
export function setItem(p: Portrait, index: number, change: Partial<Item>): Portrait {
  if (index < 0 || index >= p.items.length) return p;
  const out = copy(p);
  out.items[index] = { ...out.items[index]!, ...change };
  if (out.items[index]!.tilt === undefined) delete out.items[index]!.tilt;
  if (out.items[index]!.pitch === undefined) delete out.items[index]!.pitch;
  return out;
}

/** Change the portrait's own settings. A change to manual layout keeps every body where it is on the page. */
export function setPortrait(p: Portrait, change: Partial<Omit<Portrait, "items">>): Portrait {
  let out = copy(p);
  if (change.layout === "manual") out = freeze(out);
  out = { ...out, ...change, light: { ...(change.light ?? out.light) }, camera: { ...(change.camera ?? out.camera) } };
  out.aspect = clamp(out.aspect, 0.25, 4);
  return out;
}

/** Every body sized by a scale, keeping the largest as it is (a manual layout's way to go back to true or readable sizes). */
export function rescale(p: Portrait, mode: ScaleMode): Portrait {
  const out = copy(p);
  out.scale = mode;
  if (p.items.length === 0 || p.layout === "auto") return out;
  const largest = p.items.reduce((m, i) => (i.r > m.r ? i : m), p.items[0]!);
  const base = sizesFor([largest.body], mode)[0]!;
  const sizes = sizesFor(p.items.map((i) => i.body), mode);
  out.items.forEach((item, i) => {
    const scaled = (sizes[i]! / base) * largest.r;
    item.r = mode === "true" ? scaled : Math.max(0.004, scaled);
  });
  return out;
}

/** Move the camera to the middle of the bodies, keeping its zoom. */
export function centreCamera(p: Portrait): Portrait {
  if (p.layout === "auto") return p;
  const fit = fitCamera(resolve(p).placed, p.aspect, 1.1, p.labels);
  return { ...copy(p), camera: { ...p.camera, x: fit.x, y: fit.y } };
}

/** Zoom out or in so every body is in the picture. */
export function fitAll(p: Portrait): Portrait {
  if (p.layout === "auto") return p;
  return { ...copy(p), camera: fitCamera(resolve(p).placed, p.aspect, 1.1, p.labels) };
}

// --- looking at the picture -----------------------------------------------------------------------------------------------------------------------------

/** The scene's units to pixels: a body at the camera's centre is in the middle of a picture `width` by `height`. */
export function toScreen(camera: Resolved["camera"], width: number, height: number): { px(x: number): number; py(y: number): number; scale: number } {
  const scale = height / (2 * camera.h);
  return { px: (x) => width / 2 + (x - camera.x) * scale, py: (y) => height / 2 - (y - camera.y) * scale, scale };
}

/** The inverse: a pixel to the scene's units. */
export function fromScreen(camera: Resolved["camera"], width: number, height: number, x: number, y: number): { x: number; y: number } {
  const scale = height / (2 * camera.h);
  return { x: (x - width / 2) / scale + camera.x, y: -(y - height / 2) / scale + camera.y };
}

/** The index of the body under a point (scene units), front first; a body smaller than `slop` is still hit within it. */
export function hitTest(placed: readonly Placed[], x: number, y: number, slop = 0): number {
  for (let i = placed.length - 1; i >= 0; i -= 1) {
    const p = placed[i]!;
    if (Math.hypot(x - p.x, y - p.y) <= Math.max(p.r, slop)) return i;
  }
  return -1;
}

export interface Guide {
  axis: "x" | "y";
  at: number;
}

/** Where a body being dragged snaps: its middle and edges to the middle and edges of the others and to the middle of the picture, within `tolerance` (scene units). */
export function snap(moving: { x: number; y: number; r: number }, others: readonly { x: number; y: number; r: number }[], centre: { x: number; y: number }, tolerance: number): { x: number; y: number; guides: Guide[] } {
  const best = (own: readonly number[], targets: readonly number[]): { delta: number; at: number } | undefined => {
    let found: { delta: number; at: number } | undefined;
    for (const t of targets) for (const o of own) if (Math.abs(t - o) <= tolerance && (found === undefined || Math.abs(t - o) < Math.abs(found.delta))) found = { delta: t - o, at: t };
    return found;
  };
  const xs = [centre.x, ...others.flatMap((o) => [o.x - o.r, o.x, o.x + o.r])];
  const ys = [centre.y, ...others.flatMap((o) => [o.y - o.r, o.y, o.y + o.r])];
  const sx = best([moving.x - moving.r, moving.x, moving.x + moving.r], xs);
  const sy = best([moving.y - moving.r, moving.y, moving.y + moving.r], ys);
  const guides: Guide[] = [];
  if (sx !== undefined) guides.push({ axis: "x", at: sx.at });
  if (sy !== undefined) guides.push({ axis: "y", at: sy.at });
  return { x: moving.x + (sx?.delta ?? 0), y: moving.y + (sy?.delta ?? 0), guides };
}

/** The Sun's direction as a unit vector in the picture's frame (x right, y up, z toward the viewer). */
export function lightVector(light: { az: number; el: number }): [number, number, number] {
  const az = (light.az * Math.PI) / 180;
  const el = (light.el * Math.PI) / 180;
  return [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
}

// --- undo ---------------------------------------------------------------------------------------------------------------------------------------------

export interface History {
  readonly current: Portrait;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Remember a new state (a finished change). */
  push(next: Portrait): void;
  /** Make the newest step this state instead of a new step (a change that goes on: a key held, a slider dragged). */
  replace(next: Portrait): void;
  undo(): Portrait;
  redo(): Portrait;
}

/** The states a scene has been through, to step back and forward over. A state is never changed, so each is kept as it is. */
export function createHistory(initial: Portrait, limit = 100): History {
  const past: Portrait[] = [];
  let future: Portrait[] = [];
  let now = initial;
  return {
    get current() {
      return now;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    push(next) {
      if (next === now) return;
      past.push(now);
      if (past.length > limit) past.shift();
      future = [];
      now = next;
    },
    replace(next) {
      now = next;
      future = [];
    },
    undo() {
      const back = past.pop();
      if (back !== undefined) {
        future.push(now);
        now = back;
      }
      return now;
    },
    redo() {
      const forward = future.pop();
      if (forward !== undefined) {
        past.push(now);
        now = forward;
      }
      return now;
    },
  };
}

// --- the address --------------------------------------------------------------------------------------------------------------------------------------

const LOOKS: readonly Look[] = ["line", "realistic", "painted", "illustrated"];
const BACKGROUNDS: readonly Background[] = ["black", "stars", "gradient", "transparent"];
const ARRANGES: readonly Arrange[] = ["row", "arc", "grid", "orbit"];

const num = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const optional = (value: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * The scene as one short piece of text that is safe in an address: fields joined by `~`, each `name:value`, then one `body_x_y_r_spin_tilt_pitch_turn` for each body, back to front. An empty scene is an empty string.
 *
 * @param scene - The scene.
 * @returns The text.
 *
 * @example
 * ```ts
 * import { addBody, defaultPortrait, encodeScene } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(encodeScene(addBody(defaultPortrait(), "mars")));
 * ```
 */
export function encodeScene(scene: Portrait): string {
  const p = scene;
  const d = defaultPortrait();
  const fields: string[] = [];
  if (p.layout !== d.layout) fields.push(`layout:${p.layout}`);
  if (p.arrange !== d.arrange) fields.push(`arrange:${p.arrange}`);
  if (p.scale !== d.scale) fields.push(`scale:${p.scale}`);
  if (p.moons !== d.moons) fields.push(`moons:${p.moons}`);
  if (p.look !== d.look) fields.push(`look:${p.look}`);
  if (p.bg !== d.bg) fields.push(`bg:${p.bg}`);
  if (round(p.aspect, 3) !== round(d.aspect, 3)) fields.push(`ratio:${round(p.aspect, 3)}`);
  if (p.light.az !== d.light.az || p.light.el !== d.light.el) fields.push(`light:${round(p.light.az, 1)},${round(p.light.el, 1)}`);
  if (!p.labels) fields.push("labels:0");
  if (!p.orbits) fields.push("orbits:0");
  if (!p.shadows) fields.push("shadows:0");
  if (p.date !== undefined) fields.push(`date:${p.date}`);
  if (p.layout === "manual") fields.push(`cam:${round(p.camera.x)},${round(p.camera.y)},${round(p.camera.h)}`);
  for (const i of p.items) {
    const manual = p.layout === "manual";
    fields.push([i.body, manual ? round(i.x) : "", manual ? round(i.y) : "", manual ? round(i.r) : "", round(i.spin, 1), i.tilt === undefined ? "" : round(i.tilt, 1), i.pitch === undefined ? "" : round(i.pitch, 1), i.turn === 0 ? "" : round(i.turn, 2)].join("_"));
  }
  return fields.join("~");
}

/**
 * The scene from its text. Anything it does not understand is left at its default and a body it does not know is dropped, so any text gives a scene.
 *
 * @param text - Text from `encodeScene`, or anything.
 * @returns The scene.
 *
 * @example
 * ```ts
 * import { decodeScene } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(decodeScene("look:painted~jupiter_0_0_0.3_0").items[0]?.body);
 * ```
 */
export function decodeScene(text: string): Portrait {
  const p = defaultPortrait();
  const items: Item[] = [];
  for (const field of text.split("~")) {
    if (field === "") continue;
    const colon = field.indexOf(":");
    if (colon > 0) {
      const key = field.slice(0, colon);
      const value = field.slice(colon + 1);
      if (key === "layout") p.layout = value === "manual" ? "manual" : "auto";
      else if (key === "arrange" && (ARRANGES as readonly string[]).includes(value)) p.arrange = value as Arrange;
      else if (key === "scale") p.scale = value === "true" ? "true" : "readable";
      else if (key === "moons") p.moons = value === "manual" ? "manual" : "auto";
      else if (key === "look" && (LOOKS as readonly string[]).includes(value)) p.look = value as Look;
      else if (key === "bg" && (BACKGROUNDS as readonly string[]).includes(value)) p.bg = value as Background;
      else if (key === "ratio") p.aspect = clamp(num(value, p.aspect), 0.25, 4);
      else if (key === "light") {
        const [az, el] = value.split(",");
        p.light = { az: ((num(az, p.light.az) % 360) + 360) % 360, el: clamp(num(el, p.light.el), 0, 90) };
      } else if (key === "labels") p.labels = value !== "0";
      else if (key === "orbits") p.orbits = value !== "0";
      else if (key === "shadows") p.shadows = value !== "0";
      else if (key === "date") p.date = Number.isFinite(Date.parse(value)) ? value : undefined;
      else if (key === "cam") {
        const [x, y, h] = value.split(",");
        p.camera = { x: num(x, 0), y: num(y, 0), h: Math.max(1e-6, num(h, 1)) };
      }
      continue;
    }
    const [body, x, y, r, spin, tilt, pitch, turn] = field.split("_");
    if (body === undefined || !(body in BODIES) || items.some((i) => i.body === body) || items.length >= MAX_ITEMS) continue;
    const item: Item = { body: body as BodyId, x: num(x, 0), y: num(y, 0), r: Math.max(0.0005, num(r, 0.3)), spin: num(spin, BODIES[body as BodyId].showLon ?? 0), turn: clamp(num(turn, 0), -720, 720) };
    const t = optional(tilt);
    const pi = optional(pitch);
    if (t !== undefined) item.tilt = t;
    if (pi !== undefined) item.pitch = clamp(pi, -90, 90);
    items.push(item);
  }
  p.items = items;
  return p;
}

// --- presets --------------------------------------------------------------------------------------------------------------------------------------------

/**
 * A ready-made scene with its name in English and Japanese.
 *
 * @example
 * ```ts
 * import { PORTRAIT_PRESETS, type PortraitPreset } from "@johnmorrisdotca/wakusei-planets";
 *
 * const first: PortraitPreset = PORTRAIT_PRESETS[0]!;
 * console.log(first.id, first.name.en);
 * ```
 */
export interface Preset {
  id: string;
  name: { en: string; ja: string };
  scene: Portrait;
}

const fromList = (ids: readonly BodyId[], change: Partial<Omit<Portrait, "items">> = {}): Portrait => ids.reduce((p, id) => addBody(p, id), { ...defaultPortrait(), ...change });

/**
 * Ready-made scenes to start from: a family photo of the Sun and the planets, the gas giants to scale, Jupiter and the Galileans, the Earth and the Moon to scale (size and distance), Mars and its moons at their true distance, and the inner planets round the Sun.
 *
 * @example
 * ```ts
 * import { PORTRAIT_PRESETS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(PORTRAIT_PRESETS.map((preset) => preset.id).join(", "));
 * ```
 */
export const PRESETS: readonly Preset[] = [
  { id: "family", name: { en: "Family photo", ja: "家族写真" }, scene: fromList(["sun", ...PLANET_IDS], { arrange: "arc", scale: "readable", moons: "manual", orbits: false }) },
  { id: "giants", name: { en: "Gas giants", ja: "巨大ガス惑星" }, scene: fromList(["jupiter", "saturn", "uranus", "neptune"], { arrange: "row", scale: "true", moons: "manual", bg: "gradient" }) },
  { id: "galileans", name: { en: "Jupiter and the Galileans", ja: "木星とガリレオ衛星" }, scene: fromList(["jupiter", "io", "europa", "ganymede", "callisto"], { arrange: "row", scale: "readable", moons: "auto", orbits: true }) },
  { id: "earthmoon", name: { en: "Earth and Moon to scale", ja: "地球と月 (大きさと距離の比)" }, scene: fromList(["earth", "moon"], { arrange: "orbit", scale: "true", moons: "auto", orbits: true }) },
  { id: "marsmoons", name: { en: "Mars and its moons at true distance", ja: "火星と衛星 (本当の距離)" }, scene: fromList(["mars", "phobos", "deimos"], { arrange: "orbit", scale: "readable", moons: "auto", orbits: true }) },
  { id: "orrery", name: { en: "The inner planets round the Sun", ja: "太陽と内側の惑星 (本当の距離)" }, scene: fromList(["sun", "mercury", "venus", "earth", "mars"], { arrange: "orbit", scale: "readable", moons: "auto", orbits: true, bg: "black" }) },
];
