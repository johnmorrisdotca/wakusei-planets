// The pictures of the colouring sheets: a body as thick black outlines on white, drawn in millimetres from the package's own numbers (facts, tilt, rings). Big shapes only: a feature too small
// to colour is made bigger or left out, and two never overlap. Pure: an SVG string, no DOM.
import { BODIES, type BodyId, type Feature } from "../facts.ts";
import { cross, RAD, DEG, type Vec3 } from "../vec.ts";
import { facing, portrait, silhouette, surfacePoint, type Axes } from "../pose.ts";
import type { Pose } from "../ephemeris.ts";
import { OWN_FEATURES } from "./land.ts";

/** The thickness of the outline of a body and of every line inside it, in millimetres. */
export const OUTLINE_MM = 3;
export const LINE_MM = 2.5;
/** The smallest radius of a shape to colour, in millimetres, and the least between two lines. */
const MIN_SHAPE_MM = 8;
const MIN_GAP_MM = 12;
const INK = "#000";

const n = (v: number): string => (Math.round(v * 100) / 100).toString();
const polyline = (pts: readonly (readonly [number, number])[], close = false): string => `M${pts.map((p) => `${n(p[0])} ${n(p[1])}`).join("L")}${close ? "Z" : ""}`;
const stroke = (d: string, width: number): string => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

/** The edges of the rings a child colours, in kilometres from the planet's centre: the main rings of Saturn and the outer and inner rings of Uranus. */
const RING_EDGES: Partial<Record<BodyId, readonly [number, number]>> = { saturn: [74658, 136775], uranus: [41800, 51100] };
/** How far a body is turned to face the viewer, degrees east, where the body's own default is not the best side for a sheet. */
const PITCH: Partial<Record<BodyId, number>> = { saturn: 20, uranus: 35 };
const TILT: Partial<Record<BodyId, number>> = { saturn: 0 };
const SPIN: Partial<Record<BodyId, number>> = { earth: 100 };

export interface Art {
  /** The SVG markup, to put inside an `<svg>` measured in millimetres. */
  markup: string;
  /** How far the picture reaches from its centre: half its width and half its height. */
  halfWidth: number;
  halfHeight: number;
}

interface Frame {
  cx: number;
  cy: number;
  r: number;
}

const screen = (frame: Frame, p: Vec3): [number, number] => [frame.cx + p[0] * frame.r, frame.cy - p[1] * frame.r];

/** The pose a sheet draws: the body's own tilt, looked at a little from above, full face. */
export function sheetPose(id: BodyId): Pose {
  return portrait(id, { pitch: PITCH[id] ?? 18, tilt: TILT[id], phase: 0, spin: SPIN[id] });
}

const axesOf = (id: BodyId): Axes | undefined => {
  const km = BODIES[id].axesKm;
  return km === undefined ? undefined : [km[0] / BODIES[id].radiusKm, km[1] / BODIES[id].radiusKm, km[2] / BODIES[id].radiusKm];
};

/** The ring's edge as points of the plane of the rings, unit radius ρ, at angle t. */
const ringPoint = (pose: Pose, rho: number, t: number): Vec3 => {
  const e1 = pose.meridian;
  const e2 = cross(pose.pole, pose.meridian);
  return [rho * (Math.cos(t) * e1[0] + Math.sin(t) * e2[0]), rho * (Math.cos(t) * e1[1] + Math.sin(t) * e2[1]), rho * (Math.cos(t) * e1[2] + Math.sin(t) * e2[2])];
};

/** How far a body reaches from its centre, in units of its radius: its outline, its rings and, for the Sun, its rays. */
export function reach(id: BodyId, pose: Pose = sheetPose(id)): { x: number; y: number } {
  const facts = BODIES[id];
  const sil = silhouette(pose, facts.flattening, axesOf(id));
  const a = sil.angle * RAD;
  let x = Math.hypot(sil.a * Math.cos(a), sil.b * Math.sin(a));
  let y = Math.hypot(sil.a * Math.sin(a), sil.b * Math.cos(a));
  const edges = RING_EDGES[id];
  if (edges !== undefined) {
    for (let k = 0; k < 72; k += 1) {
      const p = ringPoint(pose, edges[1] / facts.radiusKm, (k / 72) * 2 * Math.PI);
      x = Math.max(x, Math.abs(p[0]));
      y = Math.max(y, Math.abs(p[1]));
    }
  }
  if (id === "sun") {
    x = Math.max(x, 1.3);
    y = Math.max(y, 1.3);
  }
  return { x, y };
}

/** The longer side of the box round some points. */
const size = (pts: readonly (readonly [number, number])[]): number => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
};

/** A circle or oval of angular radii (degrees) round a longitude and latitude, as points on the body. */
function around(lon: number, lat: number, rx: number, ry: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < 32; k += 1) {
    const t = (k / 32) * 2 * Math.PI;
    const dlat = ry * Math.sin(t);
    out.push([lon + (rx * Math.cos(t)) / Math.max(0.2, Math.cos((lat + dlat) * RAD)), Math.max(-89.9, Math.min(89.9, lat + dlat))]);
  }
  return out;
}

const between = (a: readonly [number, number], b: readonly [number, number]): number => {
  const cosine = Math.sin(a[1] * RAD) * Math.sin(b[1] * RAD) + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((a[0] - b[0]) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * DEG;
};

/** Break a line of samples into the runs that face the viewer. */
function runs<T>(samples: readonly T[], visible: (sample: T) => boolean): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  for (const sample of samples) {
    if (visible(sample)) current.push(sample);
    else if (current.length > 0) {
      out.push(current);
      current = [];
    }
  }
  if (current.length > 0) out.push(current);
  return out;
}

/** The lines inside the body: bands, big round shapes, and lines (cracks, lands) that are long enough to colour between. */
function inside(id: BodyId, pose: Pose, frame: Frame, line: number): string[] {
  const facts = BODIES[id];
  const f = facts.flattening;
  const axes = axesOf(id);
  const spin = SPIN[id] ?? facts.showLon ?? 0;
  const out: string[] = [];
  if (frame.r < 18) return out;
  const face = (lon: number, lat: number): number => facing(pose, lon, lat, f, axes);
  const at = (lon: number, lat: number): [number, number] => screen(frame, surfacePoint(pose, lon, lat, f, axes));
  const features: readonly Feature[] = OWN_FEATURES[id] ?? facts.features ?? [];

  // round shapes and ovals: made no smaller than MIN_SHAPE_MM across the radius, kept whole, never overlapping
  const minDeg = (MIN_SHAPE_MM / frame.r) * DEG;
  const shapes = features
    .map((one) => (one.kind === "circle" ? { lon: one.lon, lat: one.lat, rx: one.radius, ry: one.radius } : one.kind === "oval" ? { lon: one.lon, lat: one.lat, rx: one.rx, ry: one.ry } : undefined))
    .filter((one): one is { lon: number; lat: number; rx: number; ry: number } => one !== undefined)
    .sort((a, b) => b.rx * b.ry - a.rx * a.ry);
  const placed: { lon: number; lat: number; size: number }[] = [];
  const heights: [number, number][] = [];
  for (const shape of shapes) {
    if (placed.length >= 6) break;
    const rx = Math.min(45, Math.max(shape.rx, minDeg));
    const ry = Math.min(45, Math.max(shape.ry, minDeg));
    const size = Math.max(rx, ry);
    const ring = around(shape.lon, shape.lat, rx, ry);
    if (!ring.every(([lon, lat]) => face(lon, lat) > 0.35)) continue;
    if (placed.some((p) => between([p.lon, p.lat], [shape.lon, shape.lat]) < (p.size + size) * 1.15)) continue;
    placed.push({ lon: shape.lon, lat: shape.lat, size });
    heights.push([shape.lat, ry]);
    out.push(stroke(polyline(ring.map(([lon, lat]) => at(lon, lat)), true), line));
  }

  // bands of latitude: each at least MIN_GAP_MM from the last, and not so near the edge that the strip beyond is too thin to colour
  const kept: [number, number][] = [];
  const bands = features.filter((one): one is Extract<Feature, { kind: "band" }> => one.kind === "band").sort((a, b) => Math.abs(a.lat) - Math.abs(b.lat));
  for (const band of bands) {
    if (kept.length >= 7 || face(spin, band.lat) < 0.5) continue;
    if (heights.some(([lat, ry]) => Math.abs(lat - band.lat) < ry + 2)) continue;
    const here = at(spin, band.lat);
    if (kept.some((p) => Math.hypot(p[0] - here[0], p[1] - here[1]) < MIN_GAP_MM)) continue;
    const samples: [number, number][] = [];
    for (let lon = 0; lon <= 360; lon += 3) samples.push([lon, band.lat]);
    const parts = runs(samples, ([lon, lat]) => face(lon, lat) > 0.01).map((part) => part.map(([lon, lat]) => at(lon, lat)));
    if (!parts.some((part) => size(part) >= 2 * MIN_SHAPE_MM)) continue;
    kept.push(here);
    for (const part of parts) out.push(stroke(polyline(part), line));
  }

  // lines: whole (closed) or in the runs that face us, long enough to see
  for (const one of features) {
    if (one.kind !== "line") continue;
    const count = one.points.length;
    const samples: [number, number][] = [];
    for (let k = 0; k < (one.close === true ? count : count - 1); k += 1) {
      const a = one.points[k]!;
      const b = one.points[(k + 1) % count]!;
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let s = 0; s < steps; s += 1) samples.push([a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps]);
    }
    const last = one.points[one.close === true ? 0 : count - 1]!;
    samples.push([last[0], last[1]]);
    const parts = runs(samples, ([lon, lat]) => face(lon, lat) > 0.01);
    const whole = one.close === true && parts.length === 1 && parts[0]!.length === samples.length;
    for (const part of parts) {
      if (part.length < 3) continue;
      const pts = part.map(([lon, lat]) => at(lon, lat));
      if (size(pts) < 2 * MIN_SHAPE_MM) continue;
      out.push(stroke(polyline(pts, whole), line));
    }
  }
  return out;
}

/** The rings as thick edges: the back parts first (the planet will cover them), and the front parts as a white band with its edges, to go over the planet. */
function ringParts(id: BodyId, pose: Pose, frame: Frame, line: number): { back: string; front: string } {
  const edges = RING_EDGES[id];
  if (edges === undefined) return { back: "", front: "" };
  const radius = BODIES[id].radiusKm;
  const e1 = pose.meridian[2];
  const e2 = cross(pose.pole, pose.meridian)[2];
  const phi = Math.atan2(e2, e1);
  const arc = (rho: number, from: number, to: number): [number, number][] => Array.from({ length: 61 }, (_, k) => screen(frame, ringPoint(pose, rho, from + ((to - from) * k) / 60)));
  const front0 = phi - Math.PI / 2;
  const back0 = phi + Math.PI / 2;
  const back: string[] = [];
  const outer = edges[1] / radius;
  const inner = edges[0] / radius;
  for (const rho of [inner, outer]) back.push(stroke(polyline(arc(rho, back0, back0 + Math.PI)), line));
  const band = [...arc(outer, front0, front0 + Math.PI), ...arc(inner, front0 + Math.PI, front0).slice()];
  const front = [`<path d="${polyline(band, true)}" fill="#fff"/>`, ...[inner, outer].map((rho) => stroke(polyline(arc(rho, front0, front0 + Math.PI)), line))];
  return { back: back.join(""), front: front.join("") };
}

/** The Sun's rays: short thick strokes all round, long and short in turn. */
function rays(frame: Frame, line: number): string {
  const parts: string[] = [];
  for (let k = 0; k < 16; k += 1) {
    const a = (k / 16) * 2 * Math.PI;
    const r1 = 1.1;
    const r2 = k % 2 === 0 ? 1.3 : 1.2;
    parts.push(`M${n(frame.cx + Math.cos(a) * r1 * frame.r)} ${n(frame.cy + Math.sin(a) * r1 * frame.r)}L${n(frame.cx + Math.cos(a) * r2 * frame.r)} ${n(frame.cy + Math.sin(a) * r2 * frame.r)}`);
  }
  return stroke(parts.join(""), line);
}

/**
 * A body as a colouring picture: thick black outlines on white (the outline 3 mm, every line inside 2.5 mm), its big features, its rings, and the Sun's rays. The picture is drawn at its centre `(cx, cy)` with `r`
 * millimetres for the body's radius. `outline` is the outline's thickness; the lines inside are 2.5 mm or, for a thinner outline, a little less.
 * @param id - The body's name.
 * @param cx - The centre's place, in millimetres.
 * @param cy - The centre's place, in millimetres.
 * @param r - The body's radius, in millimetres.
 * @param outline - The outline's thickness in millimetres. Default 3.
 * @returns The SVG markup of the body, to put inside an `<svg>` measured in millimetres.
 *
 * @example
 * ```ts
 * import { colouringArt } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(colouringArt("mars", 50, 50, 40).startsWith("<g"));
 * ```
 */
export function colouringArt(id: BodyId, cx: number, cy: number, r: number, outline = OUTLINE_MM): string {
  const facts = BODIES[id];
  const pose = sheetPose(id);
  const frame: Frame = { cx, cy, r };
  const sil = silhouette(pose, facts.flattening, axesOf(id));
  const disc = `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(r * sil.a)}" ry="${n(r * sil.b)}" transform="rotate(${n(sil.angle)} ${n(cx)} ${n(cy)})"`;
  const line = Math.min(LINE_MM, outline * 0.84);
  const rings = ringParts(id, pose, frame, line);
  const clip = `kids-${id}-clip`;
  return [
    `<g data-body="${id}">`,
    rings.back,
    `${disc} fill="#fff" stroke="${INK}" stroke-width="${outline}"/>`,
    `<clipPath id="${clip}">${disc}/></clipPath>`,
    `<g clip-path="url(#${clip})">${inside(id, pose, frame, line).join("")}</g>`,
    id === "sun" ? rays(frame, line) : "",
    rings.front,
    `</g>`,
  ].join("");
}

/** A body's picture made as large as fits a box `width` by `height` millimetres, in the middle of it. */
export function colouringPicture(id: BodyId, width: number, height: number, top = 0): Art {
  const pose = sheetPose(id);
  const extent = reach(id, pose);
  const pad = OUTLINE_MM;
  const r = Math.min((width - 2 * pad) / (2 * extent.x), (height - 2 * pad) / (2 * extent.y));
  return { markup: colouringArt(id, width / 2, top + height / 2, r), halfWidth: extent.x * r, halfHeight: extent.y * r };
}
