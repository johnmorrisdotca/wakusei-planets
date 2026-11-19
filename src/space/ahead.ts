// A move worked out before the press that starts it has counted as a click, so the first draw of the move finds its path made. Pure: it reads the numbers it is given, moves nothing and draws nothing.
import { BODIES, type BodyId, type MoonId } from "../facts.ts";
import { moonOffset } from "../scene/orient.ts";
import { cross, length, sub, unit, type Vec3 } from "../vec.ts";
import { hostOf } from "./bodies.ts";
import { frameAt, type SpaceDwarf, type SpacePlanet } from "./frame.ts";
import { moonDistance, placeBodies, radiusIn, type ScaleMode } from "./scale.ts";
import { TRAVEL_BUDGET_MS, travelPlan, type TravelBody, type TravelInput, type TravelKind, type TravelPlan } from "./travel.ts";

/** A move planned ahead: the body it goes to, and the input and plan the draw would make for it. */
export interface Ahead {
  id: BodyId;
  input: TravelInput;
  plan: TravelPlan;
}

/** What a move planned ahead is worked out from: the camera as the last draw left it, and the view the move ends in, from the body gone to. */
export interface AheadMove {
  id: BodyId;
  leaving: BodyId;
  kind: Exclude<TravelKind, "cut">;
  pace: number;
  mode: ScaleMode;
  time: number;
  aspect: number;
  bodies: readonly BodyId[];
  pose: { p: Vec3; q: readonly [number, number, number, number]; fov: number };
  /** The unit vector from the body gone to out to the camera at the end, how far off the camera stands, the picture's up and its field of view. */
  end: { aim: Vec3; distance: number; up: Vec3; fov: number };
}

/** The vector turned by a quaternion (x, y, z, w). */
function turned(q: readonly [number, number, number, number], v: Vec3): Vec3 {
  const axis: Vec3 = [q[0], q[1], q[2]];
  const half = cross(axis, v);
  const t: Vec3 = [2 * half[0], 2 * half[1], 2 * half[2]];
  const u = cross(axis, t);
  return [v[0] + q[3] * t[0] + u[0], v[1] + q[3] * t[1] + u[1], v[2] + q[3] * t[2] + u[2]];
}

/**
 * The plan of a move to a body, worked out for the clock held, in the places relative to the body gone to as the draw takes them, or null when the end view has no up (the camera straight over a pole). The same
 * numbers as the draw's own, so `closeEnough` finds them the same at the draw; any that differ are worked out again there.
 */
export function planAhead(move: AheadMove): Ahead | null {
  const placed = placeBodies(move.mode, frameAt(move.time)) as Record<string, Vec3>;
  const own = (id: BodyId): boolean => move.bodies.includes(id);
  const radiusOf = (id: BodyId): number => radiusIn(id as never, move.mode);
  const site = (id: BodyId): Vec3 => {
    if (own(id)) return placed[id]!;
    const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
    const real = moonOffset(id as MoonId, move.time);
    const d = Math.hypot(real[0], real[1], real[2]);
    const k = (d === 0 ? 1 : moonDistance(move.mode, host, d) / d) * radiusOf(host);
    return [placed[host]![0] + real[0] * k, placed[host]![1] + real[1] * k, placed[host]![2] + real[2] * k];
  };
  const origin = site(move.id);
  const bodyOf = (id: BodyId): TravelBody => {
    const at = sub(site(id), origin);
    const host = (hostOf(id) ?? "earth") as SpacePlanet | SpaceDwarf;
    return { from: at, to: at, radius: own(id) ? radiusOf(id) : Math.max(1e-6, (BODIES[id].radiusKm / BODIES[host].radiusKm) * radiusOf(host)) };
  };
  const z = unit(move.end.aim);
  const x = cross(move.end.up, z);
  if (length(x) < 1e-9) return null;
  const y = cross(z, unit(x));
  const [px, py, pz] = sub(move.pose.p, origin);
  const start = { position: [px, py, pz] as Vec3, forward: turned(move.pose.q, [0, 0, -1]), up: turned(move.pose.q, [0, 1, 0]), fov: move.pose.fov };
  const end = { position: [z[0] * move.end.distance, z[1] * move.end.distance, z[2] * move.end.distance] as Vec3, forward: [-z[0], -z[1], -z[2]] as Vec3, up: y, fov: move.end.fov };
  const familyOf = (id: BodyId): BodyId => (id === "moon" ? "earth" : ((hostOf(id) as BodyId | undefined) ?? id));
  const family = familyOf(move.leaving);
  const around = family === familyOf(move.id) && move.leaving !== move.id && (move.leaving !== family || move.id !== family) ? family : null;
  const input: TravelInput = {
    start,
    end,
    leaving: bodyOf(move.leaving),
    destination: bodyOf(move.id),
    others: move.bodies.filter((id) => id !== move.leaving && id !== move.id && id !== family).map(bodyOf),
    aspect: move.aspect,
    kind: move.kind,
    pace: move.pace,
    budget: { now: () => performance.now(), ms: TRAVEL_BUDGET_MS },
  };
  if (around !== null) input.around = bodyOf(around);
  return { id: move.id, input, plan: travelPlan(input) };
}

/** Whether two inputs are the same move: every number within a millionth of an Earth radius (and a billionth of itself), the budget's clock ignored. */
export function closeEnough(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(a);
  if (typeof a === "function" && typeof b === "function") return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => key in b && closeEnough((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
