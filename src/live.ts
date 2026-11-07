// The moving picture's maths, at a low rate: the pose and the moons are worked out in full about once a second, and in between the body's turn and each moon's walk round its
// planet are carried forward from there. A frame costs a few turns of vectors, never an ephemeris. Pure, no DOM.
import { ORBITS } from "./data/orbits.ts";
import { apparent, system, type MoonPlace, type Pose } from "./ephemeris.ts";
import { BODIES, MOONS_OF, type BodyId, type HostId } from "./facts.ts";
import { portrait, type PortraitOptions } from "./pose.ts";
import { turn, unit, cross, type Vec3 } from "./vec.ts";

/** What a live picture is asked for. */
export interface LiveRequest {
  id: BodyId;
  /** The moment at the start of the clock, in milliseconds since 1970; `undefined` for a portrait with no date. */
  start: number | undefined;
  /** When the clock started, in the real milliseconds of `at()`'s `now`. */
  startedAt: number;
  /** Simulated seconds for each real second. */
  rate: number;
  /** Draw the planet's moons. Needs a date; the start is taken as the real time when none is given. */
  moons: boolean;
  portrait: PortraitOptions;
  /** A portrait turns eastward by this many degrees a second. */
  turn: number;
}

/** A moon in the system, carried forward. */
export interface LiveMoon {
  id: BodyId;
  x: number;
  y: number;
  z: number;
  distance: number;
}

/** The picture at one moment. */
export interface LiveFrame {
  pose: Pose;
  moons: readonly LiveMoon[];
  /** The simulated moment in milliseconds since 1970, or `undefined` in a portrait. */
  time: number | undefined;
  /** How many full workings-out have been made so far. */
  anchors: number;
}

interface Anchor {
  real: number;
  sim: number | undefined;
  pose: Pose;
  place: readonly MoonPlace[];
  axes: readonly Vec3[];
  signature: string;
}

const ANCHOR_MS = 1000;

/** Degrees a second a portrait turns when the page does not set `turn`. Slow enough to watch. */
export const DEFAULT_TURN = 12;

/** The share of that turn kept when the reader prefers reduced motion. `turn="0"` is the only stop. */
export const REDUCED_TURN = 0.25;

/** The portrait turn when none is set: `DEFAULT_TURN` degrees a second, and backwards when the body turns backwards. `turn="0"` stays still. */
export function defaultTurn(id: BodyId): number {
  return (BODIES[id].rotationHours < 0 ? -1 : 1) * DEFAULT_TURN;
}

/** The degrees a second a body's own turn advances its prime meridian (a moon that keeps one face to its planet turns once a trip). */
export function turnRate(id: BodyId): number {
  const f = BODIES[id];
  return (f.synchronous === true && ORBITS[id] !== undefined ? Math.sign(f.prime.rate) * Math.abs(ORBITS[id].sid) : f.prime.rate) / 86400;
}

/** The pictured moon-planet's moons, or none. */
const moonsOfPlanet = (id: BodyId): boolean => id in MOONS_OF;

/** A live picture's maths: ask `at(request, now)` as often as you like; it works out the sky about once a second. */
export function createLive(): { at(request: LiveRequest, now: number): LiveFrame; readonly anchors: number } {
  let anchor: Anchor | undefined;
  let count = 0;
  return {
    get anchors() {
      return count;
    },
    at(r, now) {
      const wantMoons = r.moons && moonsOfPlanet(r.id);
      const timed = r.start !== undefined || wantMoons;
      const sim = timed ? (r.start ?? r.startedAt) + (now - r.startedAt) * r.rate : undefined;
      const signature = `${r.id}|${r.start}|${r.startedAt}|${r.rate}|${wantMoons}|${JSON.stringify(r.portrait)}`;
      if (anchor === undefined || anchor.signature !== signature || now - anchor.real >= ANCHOR_MS || now < anchor.real) {
        count += 1;
        const pose = timed ? (wantMoons ? system(r.id as HostId, sim!).planet : apparent(r.id, sim!)) : portrait(r.id, r.portrait);
        let place: readonly MoonPlace[] = [];
        let axes: Vec3[] = [];
        if (wantMoons) {
          place = system(r.id as HostId, sim!).moons;
          const later = system(r.id as HostId, sim! + 3_600_000).moons;
          axes = place.map((m) => {
            const n = later.find((l) => l.id === m.id)!;
            return unit(cross([m.x, m.y, m.z], [n.x, n.y, n.z]));
          });
        }
        anchor = { real: now, sim, pose, place, axes, signature };
      }
      const a = anchor;
      const seconds = a.sim === undefined || sim === undefined ? (now - r.startedAt) / 1000 : (sim - a.sim) / 1000;
      let pose = a.pose;
      if (a.sim === undefined) {
        if (r.turn !== 0) pose = { ...pose, meridian: turn(pose.meridian, pose.pole, r.turn * seconds) };
      } else {
        // The date's own spin is already in the anchor, so only the bit since then is added. The portrait turn is from the start of the clock: folding it into the one-second window made a dated picture jump back every second.
        const spin = turnRate(r.id) * seconds + r.turn * ((now - r.startedAt) / 1000);
        if (spin !== 0) pose = { ...pose, meridian: turn(pose.meridian, pose.pole, spin) };
      }
      const moons = a.place.map((m, i): LiveMoon => {
        const rate = Math.abs(ORBITS[m.id]?.sid ?? 0) / 86400;
        const p = turn([m.x, m.y, m.z], a.axes[i]!, rate * seconds);
        return { id: m.id, x: p[0], y: p[1], z: p[2], distance: m.distance };
      });
      return { pose, moons, time: sim, anchors: count };
    },
  };
}
