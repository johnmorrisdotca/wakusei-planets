// The drawing of the styled orbit paths: each is a closed line of points in the scene, turned here into flat quads that face the camera, a real width in CSS pixels and dashes measured along the line
// on the screen, all written into one buffer so that every path is one draw. Plain numbers in, plain numbers out: the scene hands the buffer to three.js. Nothing here touches the page.
import type { Vec3 } from "../vec.ts";
import type { ScreenLine } from "./paths.ts";

/** The camera as the ribbons need it: where it is, its three axes in the scene, the picture's size in CSS pixels and tan of half the vertical field of view. */
export interface RibbonView {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
  width: number;
  height: number;
  half: number;
}

/** One path to turn into quads. */
export interface RibbonInput {
  /** The points in the scene, three numbers each. The last may repeat the first. */
  points: ArrayLike<number>;
  count: number;
  /** One number from 0 to 1 for each point: how much of the path's opacity it keeps (a line is let go near a body looked at close). */
  fade?: ArrayLike<number>;
  colour: readonly [number, number, number];
  /** CSS pixels. */
  width: number;
  opacity: number;
  dash: readonly [number, number] | null;
}

/** The buffers every path writes into: six vertices a quad, three numbers of position and four of colour a vertex. */
export interface RibbonBuffer {
  positions: Float32Array;
  colours: Float32Array;
  /** Vertices written so far. */
  used: number;
}

/** The most quads the buffer holds, and so the most one path may use before a dashed line is drawn solid. */
export const MAX_RIBBON_QUADS = 16384;
export const QUAD_BUDGET_PER_PATH = 1024;

/** A new buffer. */
export function newRibbonBuffer(): RibbonBuffer {
  return { positions: new Float32Array(MAX_RIBBON_QUADS * 6 * 3), colours: new Float32Array(MAX_RIBBON_QUADS * 6 * 4), used: 0 };
}

/**
 * Project a path's points onto the picture, in CSS pixels from its top left, and say which can be seen (in front of the camera).
 *
 * @param view - The camera.
 * @param points - The points, three numbers each.
 * @param count - How many points.
 * @param xy - Where the screen points go (two numbers each).
 * @param ok - Where the flags go.
 * @param depth - Where each point's distance along the camera's forward goes.
 */
export function projectLine(view: RibbonView, points: ArrayLike<number>, count: number, xy: Float64Array, ok: Uint8Array, depth: Float64Array): void {
  const scale = view.height / 2 / view.half;
  for (let i = 0; i < count; i += 1) {
    const rx = points[i * 3]! - view.eye[0];
    const ry = points[i * 3 + 1]! - view.eye[1];
    const rz = points[i * 3 + 2]! - view.eye[2];
    const d = rx * view.forward[0] + ry * view.forward[1] + rz * view.forward[2];
    depth[i] = d;
    if (!(d > 1e-12)) {
      ok[i] = 0;
      xy[i * 2] = 0;
      xy[i * 2 + 1] = 0;
      continue;
    }
    const x = rx * view.right[0] + ry * view.right[1] + rz * view.right[2];
    const y = rx * view.up[0] + ry * view.up[1] + rz * view.up[2];
    const sx = view.width / 2 + (x / d) * scale;
    const sy = view.height / 2 - (y / d) * scale;
    ok[i] = Number.isFinite(sx) && Number.isFinite(sy) && Math.abs(sx) < 1e7 && Math.abs(sy) < 1e7 ? 1 : 0;
    xy[i * 2] = sx;
    xy[i * 2 + 1] = sy;
  }
}

const MARGIN = 96;

/**
 * Write one path's quads into the buffer: the segments between points that can be seen, solid or in dashes laid along the line's length on the screen. A segment wholly off the picture is skipped (its length still
 * counts, so a dash keeps its place). A dashed line that would take more than {@link QUAD_BUDGET_PER_PATH} quads is drawn solid.
 *
 * @param view - The camera.
 * @param input - The path.
 * @param line - Its screen points from {@link projectLine}.
 * @param depth - Each point's depth from {@link projectLine}.
 * @param out - The buffer.
 * @returns How many quads were written, and whether a dashed line was drawn solid.
 */
export function writeRibbon(view: RibbonView, input: RibbonInput, line: ScreenLine, depth: ArrayLike<number>, out: RibbonBuffer): { quads: number; solidified: boolean } {
  const { xy, ok, count } = line;
  const quadBudget = Math.min(QUAD_BUDGET_PER_PATH, Math.floor((MAX_RIBBON_QUADS * 6 - out.used) / 6));
  let dash = input.dash;
  if (dash !== null) {
    let length = 0;
    for (let i = 0; i + 1 < count; i += 1) if (ok[i] && ok[i + 1]) length += Math.hypot(xy[i * 2 + 2]! - xy[i * 2]!, xy[i * 2 + 3]! - xy[i * 2 + 1]!);
    if ((length / (dash[0] + dash[1]) + count) * 1 > quadBudget) dash = null;
  }
  const solidified = input.dash !== null && dash === null;
  const [cr, cg, cb] = input.colour;
  const perPixel = (2 * view.half) / Math.max(1, view.height);
  const startVertices = out.used;
  let arc = 0;
  let quads = 0;
  const emit = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, da: number, db: number, nx: number, ny: number, fa: number, fb: number): void => {
    if (quads >= quadBudget) return;
    const wa = input.width * 0.5 * da * perPixel;
    const wb = input.width * 0.5 * db * perPixel;
    // the screen's perpendicular, laid across the scene: right with the picture's x, down with its y
    const oax = (view.right[0] * nx - view.up[0] * ny) * wa;
    const oay = (view.right[1] * nx - view.up[1] * ny) * wa;
    const oaz = (view.right[2] * nx - view.up[2] * ny) * wa;
    const obx = (view.right[0] * nx - view.up[0] * ny) * wb;
    const oby = (view.right[1] * nx - view.up[1] * ny) * wb;
    const obz = (view.right[2] * nx - view.up[2] * ny) * wb;
    const corners: [number, number, number, number][] = [
      [ax - oax, ay - oay, az - oaz, fa],
      [ax + oax, ay + oay, az + oaz, fa],
      [bx - obx, by - oby, bz - obz, fb],
      [bx + obx, by + oby, bz + obz, fb],
    ];
    for (const k of [0, 1, 2, 1, 3, 2]) {
      const c = corners[k]!;
      const v = out.used;
      out.positions[v * 3] = c[0];
      out.positions[v * 3 + 1] = c[1];
      out.positions[v * 3 + 2] = c[2];
      out.colours[v * 4] = cr;
      out.colours[v * 4 + 1] = cg;
      out.colours[v * 4 + 2] = cb;
      out.colours[v * 4 + 3] = input.opacity * c[3];
      out.used += 1;
    }
    quads += 1;
  };
  for (let i = 0; i + 1 < count; i += 1) {
    if (!ok[i] || !ok[i + 1]) continue;
    const x0 = xy[i * 2]!;
    const y0 = xy[i * 2 + 1]!;
    const x1 = xy[i * 2 + 2]!;
    const y1 = xy[i * 2 + 3]!;
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length < 1e-6) continue;
    const start = arc;
    arc += length;
    // wholly off the picture on one side: nothing to draw, but the length above has counted
    if ((x0 < -MARGIN && x1 < -MARGIN) || (x0 > view.width + MARGIN && x1 > view.width + MARGIN) || (y0 < -MARGIN && y1 < -MARGIN) || (y0 > view.height + MARGIN && y1 > view.height + MARGIN)) continue;
    const nx = -(y1 - y0) / length;
    const ny = (x1 - x0) / length;
    const p0 = i * 3;
    const p1 = i * 3 + 3;
    const f0 = input.fade ? input.fade[i]! : 1;
    const f1 = input.fade ? input.fade[i + 1]! : 1;
    const piece = (t0: number, t1: number): void => {
      const ax = input.points[p0]! + (input.points[p1]! - input.points[p0]!) * t0;
      const ay = input.points[p0 + 1]! + (input.points[p1 + 1]! - input.points[p0 + 1]!) * t0;
      const az = input.points[p0 + 2]! + (input.points[p1 + 2]! - input.points[p0 + 2]!) * t0;
      const bx = input.points[p0]! + (input.points[p1]! - input.points[p0]!) * t1;
      const by = input.points[p0 + 1]! + (input.points[p1 + 1]! - input.points[p0 + 1]!) * t1;
      const bz = input.points[p0 + 2]! + (input.points[p1 + 2]! - input.points[p0 + 2]!) * t1;
      emit(ax, ay, az, bx, by, bz, depth[i]! + (depth[i + 1]! - depth[i]!) * t0, depth[i]! + (depth[i + 1]! - depth[i]!) * t1, nx, ny, f0 + (f1 - f0) * t0, f0 + (f1 - f0) * t1);
    };
    if (dash === null) {
      piece(0, 1);
      continue;
    }
    const period = dash[0] + dash[1];
    for (let k = Math.floor(start / period); k * period < start + length; k += 1) {
      const a = Math.max(start, k * period);
      const b = Math.min(start + length, k * period + dash[0]);
      if (b > a) piece((a - start) / length, (b - start) / length);
    }
  }
  if (quads === 0) out.used = startVertices;
  return { quads, solidified };
}
