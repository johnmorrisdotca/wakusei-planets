// The small bodies of a record source as points in the space view, in one instanced draw: a quad for each body, billboarded in the vertex shader, whose place the graphics card works out from the body's orbital elements and the
// date (Kepler's equation, a few steps), so a change of date costs one number and no work on the processor. The shader mirrors `smallBodyAt` and the space view's own scale (`placeAround`): the same body is in the same place
// as the lines and the planets. three.js is handed in; nothing here imports it as a value. Needs `InstancedBufferGeometry` and `InstancedBufferAttribute` from it (a page's own subset of three must hold them for this).
import type * as THREE from "three";
import { OBLIQUITY, RAD, type Vec3 } from "../vec.ts";
import { AU_IN_EARTH_RADII } from "../space/frame.ts";
import { placeAround, type ScaleMode } from "../space/scale.ts";
import { MAX_POINTS, packSmallBodies, smallBodyAt, type SmallBody } from "./small-bodies.ts";

/** The parts of three.js the points use, over and above the ones every body needs. A page's own subset of three that lacks the two instanced classes cannot draw them. */
export type PointsThree = Pick<typeof THREE, "BufferAttribute" | "Group" | "InstancedBufferAttribute" | "InstancedBufferGeometry" | "Mesh" | "ShaderMaterial" | "Vector2" | "Vector3">;

/** How the view places a body round the Sun in a compressed view: its distance in astronomical units to the power `SPREAD`, times `SUN_COMPRESSED` Earth radii (the same two numbers as `space/scale.ts`). */
export const POINT_SCALE = { sunCompressed: 70, spread: 0.45 } as const;

/**
 * Where the space view draws a small body: its place on the date (`smallBodyAt`, ecliptic of J2000) turned into the view's axes (equatorial, y north) and placed round the Sun by the same mapping as the planets (`placeAround`). The
 * point's shader does the same sum on the graphics card; this is the one a test or a page can check it against.
 *
 * @param mode - The scale of the view.
 * @param sun - Where the Sun is drawn, in Earth radii.
 * @param body - The small body.
 * @param jd - The date, as a Julian date (TT).
 * @returns Where to draw it, in Earth radii.
 *
 * @example
 * ```ts
 * import { smallBodyPlace } from "@johnmorrisdotca/wakusei-planets/door";
 *
 * const place = smallBodyPlace("compressed", [70, 0, 0], { name: "T", a: 2, e: 0, i: 0, node: 0, peri: 0, M0: 0, epoch: 2461000.5, H: 9 }, 2461000.5);
 * console.log(place.map(Math.round));
 * ```
 */
export function smallBodyPlace(mode: ScaleMode, sun: Vec3, body: SmallBody, jd: number): Vec3 {
  const [x, y, z] = smallBodyAt(body, jd);
  const c = Math.cos(OBLIQUITY * RAD);
  const s = Math.sin(OBLIQUITY * RAD);
  return placeAround(mode, sun, [x, y * s + z * c, -(y * c - z * s)]);
}

/** What the points need to know at each draw. */
export interface PointsState {
  /** The date, as a Julian date (TT). */
  jd: number;
  /** `true` or `compressed`, as the space view's scale. */
  mode: "compressed" | "true";
  /** Where the Sun is drawn, in the view's units (Earth radii from the Earth's centre). */
  sun: Vec3;
  /** The view's size in device pixels, and the pixels of a CSS pixel. */
  width: number;
  height: number;
  ratio: number;
}

/** The points of a view's small bodies. */
export interface SmallBodyPoints {
  readonly object: THREE.Object3D;
  /** The bodies drawn: the records of every record source in use, as many as `MAX_POINTS`. Packs them for the graphics card. A body with a `belt` is drawn with the others of its belt in one instanced draw of its colour; the rest are drawn together. */
  set(bodies: readonly SmallBody[]): void;
  /** Called at each draw. */
  update(state: PointsState): void;
  /** How many bodies are drawn in all. */
  readonly count: number;
  /** How many instanced draws there are: one for each belt that has a body, and one for the bodies with no belt. */
  readonly draws: number;
  /** How many bodies each belt has (the bodies with no belt are under `""`). */
  countOf(belt: string): number;
  dispose(): void;
}

/** What `createSmallBodyPoints` is told: the colour of each belt's points (`#rrggbb`, by belt name), where a belt has none the points are the plain pale colour. */
export interface PointsOptions {
  colours?: Readonly<Record<string, string>>;
}

/** The days from the date the bodies were packed at after which they are packed again, so the mean anomaly a float holds keeps its digits. */
const REPACK_DAYS = 3000;

const VERTEX = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aA;
attribute vec4 aB;
uniform float uDays;
uniform float uTrue;
uniform vec3 uSun;
uniform vec2 uViewport;
uniform float uRatio;
uniform float uAu;
uniform float uSunCompressed;
uniform float uSpread;
uniform vec2 uObliquity;
varying vec2 vCorner;
varying float vFade;

const float K = 0.01720209895;
const float TAU = 6.28318530718;

void main() {
  float a = aA.x;
  float e = aA.y;
  float n = K / (a * sqrt(a));
  float M = aB.y + n * (aB.z + uDays);
  M = M - TAU * floor(M / TAU + 0.5);
  float E = e < 0.8 ? M : 3.14159265;
  for (int k = 0; k < 8; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));
  float px = a * (cos(E) - e);
  float py = a * sqrt(1.0 - e * e) * sin(E);
  float cw = cos(aB.x); float sw = sin(aB.x);
  float co = cos(aA.w); float so = sin(aA.w);
  float ci = cos(aA.z); float si = sin(aA.z);
  float qx = cw * px - sw * py;
  float qy = sw * px + cw * py;
  vec3 ecl = vec3(co * qx - so * ci * qy, so * qx + co * ci * qy, si * qy);
  // the ecliptic of J2000 in the scene's axes (equatorial, y north), as frame.ts does it
  vec3 helio = vec3(ecl.x, ecl.y * uObliquity.x + ecl.z * uObliquity.y, -(ecl.y * uObliquity.y - ecl.z * uObliquity.x));
  float l = length(helio);
  float k = uTrue > 0.5 ? uAu : (l > 0.0 ? uSunCompressed * pow(l, uSpread) / l : 0.0);
  vec3 world = uSun + helio * k;
  vec4 clip = projectionMatrix * viewMatrix * vec4(world, 1.0);
  // a brighter body (a lower H) is a larger point, two to five device pixels across
  float size = clamp(4.6 - 0.28 * (aB.w - 6.0), 2.0, 5.0) * uRatio;
  clip.xy += aCorner * (size / uViewport) * clip.w;
  vCorner = aCorner;
  vFade = clip.w > 0.0 ? 1.0 : 0.0;
  gl_Position = clip;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uColour;
varying vec2 vCorner;
varying float vFade;
void main() {
  float d = length(vCorner);
  if (d > 1.0 || vFade < 0.5) discard;
  gl_FragColor = vec4(uColour, 0.9 * smoothstep(1.0, 0.45, d));
}
`;

/**
 * Makes the points: one instanced draw of a quad for each small body, one draw for each belt.
 *
 * @param T - The parts of three.js.
 * @param options - The colour of each belt's points.
 * @returns The points, with no bodies yet.
 */
export function createSmallBodyPoints(T: PointsThree, options: PointsOptions = {}): SmallBodyPoints {
  const fresh = (count: number, data?: Float32Array): THREE.InstancedBufferGeometry => {
    const made = new T.InstancedBufferGeometry();
    made.setAttribute("position", new T.BufferAttribute(new Float32Array(12), 3));
    made.setAttribute("aCorner", new T.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
    made.setIndex([0, 1, 2, 0, 2, 3]);
    const a = new Float32Array(count * 4);
    const b = new Float32Array(count * 4);
    for (let k = 0; data !== undefined && k < count; k += 1) {
      a.set(data.subarray(k * 8, k * 8 + 4), k * 4);
      b.set(data.subarray(k * 8 + 4, k * 8 + 8), k * 4);
    }
    made.setAttribute("aA", new T.InstancedBufferAttribute(a, 4));
    made.setAttribute("aB", new T.InstancedBufferAttribute(b, 4));
    made.instanceCount = count;
    return made;
  };
  const colourOf = (belt: string): [number, number, number] => {
    const hex = options.colours?.[belt];
    if (hex === undefined || !/^#[0-9a-f]{6}$/i.test(hex)) return [0.86, 0.84, 0.78];
    return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
  };
  const material = (belt: string): THREE.ShaderMaterial =>
    new T.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uDays: { value: 0 },
        uTrue: { value: 0 },
        uSun: { value: new T.Vector3() },
        uViewport: { value: new T.Vector2(1, 1) },
        uRatio: { value: 1 },
        uAu: { value: AU_IN_EARTH_RADII },
        uSunCompressed: { value: POINT_SCALE.sunCompressed },
        uSpread: { value: POINT_SCALE.spread },
        uObliquity: { value: new T.Vector2(Math.sin(OBLIQUITY * RAD), Math.cos(OBLIQUITY * RAD)) },
        uColour: { value: new T.Vector3(...colourOf(belt)) },
      },
    });
  const group = new T.Group();
  group.visible = false;
  // one instanced draw for each belt
  const draws = new Map<string, { mesh: THREE.Mesh; material: THREE.ShaderMaterial; count: number }>();
  let jd0 = 0;
  let count = 0;
  let bodies: readonly SmallBody[] = [];
  let packed = false;
  const beltOf = (body: SmallBody): string => (body as SmallBody & { belt?: string }).belt ?? "";
  const pack = (jd: number): void => {
    // the shader counts days from the date the bodies were packed at: close to the one being drawn, so a float has the digits
    jd0 = jd;
    const by = new Map<string, SmallBody[]>();
    for (const body of bodies) {
      const belt = beltOf(body);
      const list = by.get(belt);
      if (list === undefined) by.set(belt, [body]);
      else list.push(body);
    }
    for (const [belt, held] of draws) {
      if (by.has(belt)) continue;
      group.remove(held.mesh);
      held.mesh.geometry.dispose();
      held.material.dispose();
      draws.delete(belt);
    }
    count = 0;
    for (const [belt, list] of by) {
      const data = packSmallBodies(list, jd0);
      let held = draws.get(belt);
      if (held === undefined) {
        const m = material(belt);
        const mesh = new T.Mesh(fresh(0), m);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;
        group.add(mesh);
        draws.set(belt, (held = { mesh, material: m, count: 0 }));
      }
      const old = held.mesh.geometry;
      held.count = data.length / 8;
      held.mesh.geometry = fresh(held.count, data);
      old.dispose();
      held.mesh.visible = held.count > 0;
      count += held.count;
    }
    group.visible = count > 0;
    packed = true;
  };
  return {
    object: group,
    set(next) {
      // the cap is of all the bodies together; the order is the sources' order, so the package's own come first
      bodies = next.length > MAX_POINTS ? next.slice(0, MAX_POINTS) : next;
      packed = false;
    },
    update(now) {
      if (!packed || Math.abs(now.jd - jd0) > REPACK_DAYS) pack(now.jd);
      for (const held of draws.values()) {
        const u = held.material.uniforms;
        u.uDays!.value = now.jd - jd0;
        u.uTrue!.value = now.mode === "true" ? 1 : 0;
        (u.uSun!.value as THREE.Vector3).set(now.sun[0], now.sun[1], now.sun[2]);
        (u.uViewport!.value as THREE.Vector2).set(Math.max(1, now.width), Math.max(1, now.height));
        u.uRatio!.value = now.ratio;
      }
    },
    get count() {
      return count;
    },
    get draws() {
      return [...draws.values()].filter((held) => held.count > 0).length;
    },
    countOf: (belt) => draws.get(belt)?.count ?? 0,
    dispose() {
      for (const held of draws.values()) {
        held.mesh.geometry.dispose();
        held.material.dispose();
      }
      draws.clear();
      group.visible = false;
    },
  };
}
