// The line drawing: a body as thin outlines on a dark disc, in the same style as the family's other line drawings. One SVG string, no canvas, no DOM.
import { apparent, nearMoons, orbitPath, system, type Pose } from "./ephemeris.ts";
import { BODIES, ringReach, type BodyFacts, type BodyId, type Feature, type MoonId, type PlanetId } from "./facts.ts";
import { facing, portrait, silhouette, surfacePoint, type PortraitOptions } from "./pose.ts";
import { cross, RAD, scale, unit, type Vec3 } from "./vec.ts";

/**
 * Options for `lineSvg`: the size, a pose (`tilt`, `pitch`, `phase`, `spin`, a `time` or a `pose`), `moons`, `range`, `fill`, the language and the colours.
 *
 * @example
 * ```ts
 * import { lineSvg, type LineOptions } from "@johnmorrisdotca/wakusei-planets";
 *
 * const options: LineOptions = { size: 200, tilt: 15, lang: "ja" };
 * console.log(lineSvg("mars", options).includes("火星"));
 * ```
 */
export interface LineOptions extends PortraitOptions {
  /** The width and height of the square drawing, in pixels. Default 320. */
  size?: number;
  /** A moment in milliseconds since 1970: the body is drawn as the Earth sees it then (its real pose, phase and rings). Without it the body is a portrait. */
  time?: number;
  /** The radius of the body as a fraction of half the drawing's width, to draw bodies to scale side by side. Default: as large as fits, with its rings. */
  fill?: number;
  /** A pose to draw instead of the portrait or the date's (the viewer's frame; see {@link Pose}). */
  pose?: Pose;
  /** Zoom, and the pan as a fraction of half the picture, for a view a shared control moves. */
  zoom?: number;
  panX?: number;
  panY?: number;
  /** Draw the planet's moons on their orbits as the Earth sees them at `time` (now when `time` is left out). */
  moons?: boolean;
  /** Moons already placed (planet radii, the viewer's frame), for a picture that moves them itself; used with `pose`. */
  moonsAt?: readonly { id: MoonId; x: number; y: number; z: number; distance: number }[];
  /** Orbit paths already worked out (x, y, z in planet radii, by moon), to draw instead of working them out. */
  orbits?: ReadonlyMap<string, Float32Array>;
  /** How far the picture reaches from the planet's centre, in planet radii, when `moons` is on. Default: past the farthest moon. */
  range?: number;
  /** Write the names of the moons. Default true. */
  labels?: boolean;
  /** The language of the names and the description. Default `en`. */
  lang?: "en" | "ja";
  /** The colour of the lines. Default: a pale tint of the body's colour. */
  stroke?: string;
  /** The colour of the disc. Default: a dark tint of the body's colour. */
  paper?: string;
}

const NAVY = "#0b1424";

const hex = (c: string): [number, number, number] => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
/**
 * Mix two `#rrggbb` colours: `t` is how much of `b` (0 to 1).
 * @param a - The first colour.
 * @param b - The second colour.
 * @param t - How much of `b`, 0 to 1.
 * @returns The mixed colour as `#rrggbb`.
 *
 * @example
 * ```ts
 * import { mix } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(mix("#000000", "#ffffff", 0.5));
 * ```
 */
export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return `#${[0, 1, 2].map((i) => Math.round(x[i]! + (y[i]! - x[i]!) * t).toString(16).padStart(2, "0")).join("")}`;
}

const n = (v: number): string => (Math.round(v * 100) / 100).toString();

interface Frame {
  cx: number;
  cy: number;
  r: number;
}

/** Points (screen units, y up) to an SVG path d-string around `frame`, optionally closed. */
const path = (frame: Frame, points: readonly Vec3[], close = false): string => `M${points.map((p) => `${n(frame.cx + p[0] * frame.r)} ${n(frame.cy - p[1] * frame.r)}`).join("L")}${close ? "Z" : ""}`;

/** Break a run of samples into runs where `visible` holds. */
function runs(samples: readonly Vec3[], visible: (p: Vec3, i: number) => boolean): Vec3[][] {
  const out: Vec3[][] = [];
  let current: Vec3[] = [];
  samples.forEach((p, i) => {
    if (visible(p, i)) current.push(p);
    else if (current.length > 0) {
      out.push(current);
      current = [];
    }
  });
  if (current.length > 0) out.push(current);
  return out;
}

/** A small circle of angular radii (rx east-west, ry north-south, degrees) about a point of the body, as body-frame directions. */
function around(lon: number, lat: number, rx: number, ry: number, steps = 28): { lon: number; lat: number }[] {
  const out: { lon: number; lat: number }[] = [];
  for (let k = 0; k < steps; k += 1) {
    const t = (k / steps) * 2 * Math.PI;
    const dlat = ry * Math.sin(t);
    const dlon = rx * Math.cos(t) / Math.max(0.15, Math.cos((lat + dlat) * RAD));
    out.push({ lon: lon + dlon, lat: Math.max(-89.9, Math.min(89.9, lat + dlat)) });
  }
  return out;
}

function featurePaths(facts: BodyFacts, pose: Pose, frame: Frame, stroke: string, hair: number): string {
  const f = facts.flattening;
  const visible = (lon: number, lat: number): boolean => facing(pose, lon, lat, f) > 0.02;
  const out: string[] = [];
  const draw = (pts: readonly { lon: number; lat: number }[], close: boolean, fill: boolean): void => {
    const parts = runs(
      pts.map((p) => surfacePoint(pose, p.lon, p.lat, f)),
      (_, i) => visible(pts[i]!.lon, pts[i]!.lat),
    );
    for (const part of parts) {
      const whole = close && part.length === pts.length;
      if (part.length < 2) continue;
      out.push(`<path d="${path(frame, part, whole || (fill && part.length > 3))}" fill="${fill ? stroke : "none"}" fill-opacity="${fill ? 0.16 : 0}" stroke="${stroke}" stroke-width="${n(hair)}" stroke-opacity="${fill ? 0.55 : 0.9}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
  };
  const apply = (feature: Feature): void => {
    if (feature.kind === "circle") draw(around(feature.lon, feature.lat, feature.radius, feature.radius), true, feature.fill === true);
    else if (feature.kind === "oval") draw(around(feature.lon, feature.lat, feature.rx, feature.ry), true, feature.fill === true);
    else if (feature.kind === "band") {
      const pts: { lon: number; lat: number }[] = [];
      for (let lon = 0; lon <= 360; lon += 4) pts.push({ lon, lat: feature.lat });
      draw(pts, false, false);
    } else {
      const pts: { lon: number; lat: number }[] = [];
      for (let k = 0; k < feature.points.length - (feature.close === true ? 0 : 1); k += 1) {
        const a = feature.points[k]!;
        const b = feature.points[(k + 1) % feature.points.length]!;
        for (let s = 0; s < 6; s += 1) pts.push({ lon: a[0] + ((b[0] - a[0]) * s) / 6, lat: a[1] + ((b[1] - a[1]) * s) / 6 });
      }
      const last = feature.points[feature.close === true ? 0 : feature.points.length - 1]!;
      pts.push({ lon: last[0], lat: last[1] });
      draw(pts, feature.close === true, false);
    }
  };
  for (const feature of facts.features ?? []) apply(feature);
  return out.join("");
}

/** The rings of a planet as ellipse strokes, split into the part behind the planet and the part in front of it. */
function ringPaths(facts: BodyFacts, pose: Pose, frame: Frame, stroke: string, hair: number, scaleBy: number): { back: string; front: string } {
  const back: string[] = [];
  const front: string[] = [];
  if (facts.rings === undefined) return { back: "", front: "" };
  const e1 = pose.meridian;
  const e2 = cross(pose.pole, pose.meridian);
  const ring = (r: number, theta: number): Vec3 => [r * (Math.cos(theta) * e1[0] + Math.sin(theta) * e2[0]), r * (Math.cos(theta) * e1[1] + Math.sin(theta) * e2[1]), r * (Math.cos(theta) * e1[2] + Math.sin(theta) * e2[2])];
  const edge = (km: number, opacity: number, width: number): void => {
    const r = (km / facts.radiusKm) * scaleBy;
    const pts: Vec3[] = [];
    for (let k = 0; k <= 120; k += 1) pts.push(ring(r, (k / 120) * 2 * Math.PI));
    for (const part of runs(pts, (p) => p[2] < 0)) back.push(`<path d="${path(frame, part)}" fill="none" stroke="${stroke}" stroke-opacity="${n(opacity)}" stroke-width="${n(width)}"/>`);
    for (const part of runs(pts, (p) => p[2] >= 0)) front.push(`<path d="${path(frame, part)}" fill="none" stroke="${stroke}" stroke-opacity="${n(opacity)}" stroke-width="${n(width)}"/>`);
  };
  for (const band of facts.rings) {
    const wide = (band.to - band.from) / facts.radiusKm > 0.02;
    if (wide) {
      edge(band.from, 0.35 + band.alpha * 0.4, hair);
      edge(band.to, 0.35 + band.alpha * 0.4, hair);
    } else {
      edge((band.from + band.to) / 2, 0.25 + band.alpha * 0.5, hair);
    }
  }
  return { back: back.join(""), front: front.join("") };
}

/** The dark side of the disc as a filled shape, from the Sun's direction. Empty for a full disc. */
function nightPath(pose: Pose, frame: Frame): string {
  const L = pose.light;
  const xy = Math.hypot(L[0], L[1]);
  if (xy < 1e-6 && L[2] > 0) return "";
  const c = Math.atan2(-L[1], -L[0]);
  const u: Vec3 = [Math.cos(c - Math.PI / 2), Math.sin(c - Math.PI / 2), 0];
  let v = cross(unit(L), u);
  v = unit(v);
  if (v[2] < 0) v = scale(v, -1);
  const pts: Vec3[] = [];
  for (let k = 0; k <= 48; k += 1) {
    const t = (k / 48) * Math.PI;
    pts.push([u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), 0]);
  }
  for (let k = 1; k <= 48; k += 1) {
    const a = c + Math.PI / 2 - (k / 48) * Math.PI;
    pts.push([Math.cos(a), Math.sin(a), 0]);
  }
  return path(frame, pts, true);
}

function rays(frame: Frame, stroke: string, hair: number): string {
  const out: string[] = [];
  for (let k = 0; k < 32; k += 1) {
    const a = (k / 32) * 2 * Math.PI;
    const long = k % 2 === 0;
    const r0 = 1.07;
    const r1 = long ? 1.24 : 1.15;
    out.push(`M${n(frame.cx + Math.cos(a) * r0 * frame.r)} ${n(frame.cy + Math.sin(a) * r0 * frame.r)}L${n(frame.cx + Math.cos(a) * r1 * frame.r)} ${n(frame.cy + Math.sin(a) * r1 * frame.r)}`);
  }
  return `<path d="${out.join("")}" fill="none" stroke="${stroke}" stroke-width="${n(hair * 1.2)}" stroke-linecap="round" stroke-opacity="0.8"/>`;
}

const describe = (facts: BodyFacts, lang: "en" | "ja", tail: string): string => (lang === "ja" ? `${facts.name.ja}の線画${tail}` : `Line drawing of ${facts.name.en}${tail}`);

const orbitMemo = new Map<string, Float32Array>();
/** A moon's orbit path as it is in the hour of `time`, kept so a moving picture does not work it out again. */
function cachedOrbit(id: MoonId, time: number): Float32Array {
  const key = `${id}:${Math.floor(time / 3_600_000)}`;
  let path = orbitMemo.get(key);
  if (path === undefined) {
    if (orbitMemo.size > 64) orbitMemo.clear();
    path = orbitPath(id, time, 96);
    orbitMemo.set(key, path);
  }
  return path;
}

function bodyGroup(id: BodyId, pose: Pose, frame: Frame, o: Required<Pick<LineOptions, "stroke" | "paper">>, hair: number, ringScale: number): string {
  const facts = BODIES[id];
  const sil = silhouette(pose, facts.flattening);
  const disc = `<ellipse cx="${n(frame.cx)}" cy="${n(frame.cy)}" rx="${n(frame.r * sil.a)}" ry="${n(frame.r * sil.b)}" transform="rotate(${n(sil.angle)} ${n(frame.cx)} ${n(frame.cy)})"`;
  const rings = ringPaths(facts, pose, frame, o.stroke, hair, ringScale);
  const dark = id === "sun" || facts.kind === "star" ? "" : nightPath(pose, frame);
  const clipId = `wk-${id}-clip`;
  return [
    rings.back,
    `${disc} fill="${o.paper}" stroke="${o.stroke}" stroke-width="${n(hair * 1.6)}"/>`,
    `<clipPath id="${clipId}">${disc}/></clipPath>`,
    `<g clip-path="url(#${clipId})">`,
    featurePaths(facts, pose, frame, o.stroke, hair),
    dark === "" ? "" : `<path d="${dark}" fill="${NAVY}" fill-opacity="0.62" stroke="${o.stroke}" stroke-opacity="0.35" stroke-width="${n(hair * 0.8)}" stroke-dasharray="${n(hair * 3)} ${n(hair * 3)}"/>`,
    `</g>`,
    id === "sun" ? rays(frame, o.stroke, hair) : "",
    rings.front,
  ].join("");
}

function poseFor(id: BodyId, options: LineOptions): Pose {
  if (options.pose !== undefined) return options.pose;
  return options.time === undefined ? portrait(id, options) : apparent(id, options.time);
}

/**
 * A body as a line drawing, as an SVG string: the outline (squeezed by its flattening and leaning at its axial tilt), bands and features, rings with their gaps, and the dark side
 * dashed off. Give it a `time` to draw the body as the Earth sees it then; leave it out for a portrait. `moons: true` draws a planet with its moons on their orbits.
 *
 * @param id - The body's name: `sun`, a planet or a moon.
 * @param options - The size, the pose (`tilt`, `pitch`, `phase`, `spin` or a `time`), `moons`, `fill`, the language and the colours.
 * @returns The SVG markup, `<svg ...>` to `</svg>`.
 *
 * @example
 * ```ts
 * import { lineSvg } from "@johnmorrisdotca/wakusei-planets";
 *
 * const svg = lineSvg("saturn", { size: 320 });
 * console.log(svg.startsWith("<svg"), svg.includes("Saturn"));
 * ```
 */
export function lineSvg(id: BodyId, options: LineOptions = {}): string {
  const facts = BODIES[id];
  if (facts === undefined) throw new Error(`wakusei-planets: no body called "${String(id)}"`);
  const size = options.size ?? 320;
  const lang = options.lang ?? "en";
  const stroke = options.stroke ?? mix(facts.colour, "#ffffff", 0.42);
  const paper = options.paper ?? mix(facts.colour, NAVY, id === "sun" ? 0.62 : 0.84);
  const hair = Math.max(0.6, size / 320);
  const head = (label: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(size)} ${n(size)}" width="${n(size)}" height="${n(size)}" role="img" aria-label="${label}"><title>${label}</title>`;
  if (options.moons === true && facts.parent === undefined && id !== "sun") return systemSvg(id as PlanetId, options, size, stroke, paper, hair, head);
  const pose = poseFor(id, options);
  const reach = Math.max(ringReach(facts), id === "sun" ? 1.26 : 1);
  const fit = options.fill === undefined ? 0.94 / reach : options.fill;
  const zoom = options.zoom ?? 1;
  const frame: Frame = { cx: (size / 2) * (1 - (options.panX ?? 0)), cy: (size / 2) * (1 + (options.panY ?? 0)), r: (size / 2) * fit * zoom };
  const label = describe(facts, lang, options.time === undefined ? "" : `, ${new Date(options.time).toISOString().slice(0, 16).replace("T", " ")} UTC`);
  return `${head(label)}${bodyGroup(id, pose, frame, { stroke, paper }, hair, 1)}</svg>`;
}

/** A planet with its moons on their orbits, as the Earth sees it at a time. */
function systemSvg(planet: PlanetId, options: LineOptions, size: number, stroke: string, paper: string, hair: number, head: (label: string) => string): string {
  const facts = BODIES[planet];
  const time = options.time ?? Date.now();
  const sys = options.moonsAt === undefined || options.pose === undefined ? system(planet, time) : undefined;
  const pose = options.pose ?? sys!.planet;
  const lang = options.lang ?? "en";
  const near = nearMoons(planet);
  const reach = options.range ?? Math.max(ringReach(facts) * 1.1, ...near.map((m) => m.reach * 1.1), 1.8);
  const all = options.moonsAt ?? sys!.moons;
  const moons = all.filter((m) => m.distance <= reach * 1.05);
  const half = size / 2;
  const unitPx = (half * 0.94) / reach;
  const frame: Frame = { cx: half * (1 - (options.panX ?? 0)), cy: half * (1 + (options.panY ?? 0)), r: unitPx * (options.zoom ?? 1) };
  const parts: string[] = [];
  const names: string[] = [];
  const moonPx = (id: MoonId): number => Math.max((BODIES[id].radiusKm / facts.radiusKm) * unitPx, size / 110);
  // the orbits: the path each moon follows over one trip, as it is at that time
  for (const m of moons) {
    const flat = options.orbits?.get(m.id) ?? cachedOrbit(m.id, time);
    const orbitPts: Vec3[] = [];
    for (let k = 0; k <= flat.length / 3; k += 1) {
      const i = (k % (flat.length / 3)) * 3;
      orbitPts.push([flat[i]!, flat[i + 1]!, flat[i + 2]!]);
    }
    if (orbitPts.length > 2) parts.push(`<path d="${path(frame, orbitPts)}" fill="none" stroke="${stroke}" stroke-opacity="0.28" stroke-width="${n(hair * 0.7)}"/>`);
  }
  const placed = moons.map((m) => ({ m, px: frame.cx + m.x * unitPx, py: frame.cy - m.y * unitPx }));
  const draw = (items: typeof placed): string =>
    items
      .map(({ m, px, py }) => {
        const mf = BODIES[m.id];
        const r = moonPx(m.id);
        const label = options.labels === false ? "" : `<text x="${n(px + r + hair * 3)}" y="${n(py + size / 90)}" font-size="${n(size / 34)}" fill="${stroke}" fill-opacity="0.85" font-family="system-ui,sans-serif">${lang === "ja" ? mf.name.ja : mf.name.en}</text>`;
        names.push(mf.name[lang]);
        return `<circle cx="${n(px)}" cy="${n(py)}" r="${n(r)}" fill="${mix(mf.colour, NAVY, 0.25)}" stroke="${stroke}" stroke-width="${n(hair)}"/>${label}`;
      })
      .join("");
  const behind = placed.filter(({ m }) => m.z < 0);
  const inFront = placed.filter(({ m }) => m.z >= 0);
  parts.push(draw(behind), bodyGroup(planet, pose, frame, { stroke, paper }, hair, 1), draw(inFront));
  const label = lang === "ja" ? `${facts.name.ja}と衛星の線画 (${names.length})` : `Line drawing of ${facts.name.en} and its moons`;
  return `${head(label)}${parts.join("")}</svg>`;
}
