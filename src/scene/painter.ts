// The bodies as objects for someone else's three.js scene: a radius-1 `Object3D` for the Sun, a planet, Pluto or a moon, in the realistic or the painted look, lit in the scene's own axes so a
// perspective camera can look at it from anywhere. It is made for chikyu-earth's space view (its `BodyPainter` seam) and holds nothing of its own: no renderer, no loop, no clock.
// The caller places, sizes and lights the object and calls `update` when something changed; a picture that arrives later asks for a redraw through `context.invalidate`.
import type * as THREE from "three";
import "../bodies/all.ts";
import { BODIES, MOONS_OF, type BodyId, type MoonId, type PlanetId } from "../facts.ts";
import { VERSION } from "../version.ts";
import { cross, type Vec3 } from "../vec.ts";
import type { ThreeParts } from "./body.ts";
import { bodyFragment, GLOW_FRAGMENT, GLOW_VERTEX, PAINTED_SURFACE, RING_FRAGMENT_WORLD, RING_VERTEX_WORLD, VERTEX_WORLD } from "./glsl.ts";
import { lookOf, type BodyLook } from "./look.ts";
import { moonOffset, orientation } from "./orient.ts";
import { ringStrip } from "./rings.ts";

export { moonOffset, orientation };

// The parts of three.js the painter uses: the ones the bodies use, and `Group`.
type PainterThree = ThreeParts & Pick<typeof THREE, "Group">;

/**
 * The looks the painter draws: `realistic` (shaded from the body's real colours and features) and `painted` (a public-domain surface map, with the shaded look until it arrives).
 *
 * @example
 * ```ts no-run
 * import { LOOKS, type PainterLook } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const first: PainterLook = LOOKS[0];
 * console.log(first);
 * ```
 */
export const LOOKS = ["realistic", "painted"] as const;

/**
 * One of the looks in `LOOKS`: `realistic` or `painted`.
 *
 * @example
 * ```ts no-run
 * import type { PainterLook } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const look: PainterLook = "painted";
 * console.log(look);
 * ```
 */
export type PainterLook = (typeof LOOKS)[number];

/**
 * What the caller gives the painter when it makes a body.
 *
 * @example
 * ```ts no-run
 * import type { PaintContext } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const context: PaintContext = { look: "painted", invalidate: () => undefined, ratio: 2 };
 * console.log(context.look);
 * ```
 */
export interface PaintContext {
  /** `realistic` (the default) or `painted`. */
  look?: string;
  /** Ask for a new draw: a sharper picture has arrived. */
  invalidate?(): void;
  /** Device pixels to a CSS pixel; default 1. */
  ratio?: number;
  /** The widest picture the GPU should be given, in pixels; default 2048. */
  maxTexture?: number;
}

/**
 * What the caller tells a painted body at each draw: the direction to the Sun (a unit vector in the scene's axes), the time, and how many CSS pixels across its radius the body is on the screen.
 *
 * @example
 * ```ts no-run
 * import type { PaintInfo } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const info: PaintInfo = { toSun: [1, 0, 0], ms: Date.UTC(2026, 10, 2), radiusPx: 80 };
 * console.log(info.radiusPx);
 * ```
 */
export interface PaintInfo {
  toSun: Vec3;
  ms: number;
  radiusPx: number;
  /** The pole and the prime meridian to draw instead of the body's real ones at `ms` (a portrait's own pose), in the scene's axes. */
  pose?: { pole: Vec3; meridian: Vec3 };
  /** Spheres that may shade this body from the Sun: x, y, z (from this body's centre) and radius, all in this body's radii, in the scene's axes. At most six are used. */
  occluders?: readonly (readonly [number, number, number, number])[];
}

/**
 * One body made by the painter: an object of radius 1 at the origin for the caller to move and scale.
 *
 * @example
 * ```ts no-run
 * import type { Painting } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const stop = (painting: Painting): void => painting.dispose();
 * console.log(typeof stop);
 * ```
 */
export interface Painting {
  object: THREE.Object3D;
  /** True to have the caller turn the object to face the camera (the Sun, which carries a glow). */
  billboard?: boolean;
  /** Call at each draw, after the object has been placed and scaled. */
  update(info: PaintInfo): void;
  dispose(): void;
}

/**
 * One moon of a planet at a time: where it is from the planet's centre and how big it is, both in radii of the planet, in the scene's axes.
 *
 * @example
 * ```ts no-run
 * import { painter } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const io = painter.moons("Jupiter", Date.UTC(2026, 10, 2))[0];
 * console.log(io?.name, io?.radius.toFixed(3));
 * ```
 */
export interface MoonSite {
  /** The moon's name as `make` takes it, for example `Io`. */
  name: string;
  offset: Vec3;
  radius: number;
}

/**
 * Where the pictures are, if not on jsDelivr: a folder address that ends in a slash. `farBase` holds the widest pictures (2048), which the npm package leaves out.
 *
 * @example
 * ```ts no-run
 * import { createPainter, type PainterOptions } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const options: PainterOptions = { textureBase: "/textures/", farBase: "/textures/" };
 * console.log(createPainter(options).looks);
 * ```
 */
export interface PainterOptions {
  textureBase?: string;
  farBase?: string;
}

const TEXTURE_BASE = `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets@${VERSION}/dist/textures/`;
const TEXTURE_FAR_BASE = `https://cdn.jsdelivr.net/gh/johnmorrisdotca/wakusei-planets@v${VERSION}/textures/`;
const slash = (base: string): string => (base.endsWith("/") ? base : `${base}/`);
const titled = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1);

// Geometry shared by every body of one three.js module, counted so the last one to leave frees it.
interface Held<T> {
  value: T;
  users: number;
}
const pools = new WeakMap<object, Map<string, Held<{ dispose(): void }>>>();
function acquire<T extends { dispose(): void }>(three: object, key: string, make: () => T): { value: T; release(): void } {
  let pool = pools.get(three);
  if (pool === undefined) pools.set(three, (pool = new Map()));
  let held = pool.get(key) as Held<T> | undefined;
  if (held === undefined) pool.set(key, (held = { value: make(), users: 0 }));
  held.users += 1;
  const mine = held;
  const owner = pool;
  let released = false;
  return {
    value: mine.value,
    release() {
      if (released) return;
      released = true;
      mine.users -= 1;
      if (mine.users <= 0) {
        mine.value.dispose();
        owner.delete(key);
      }
    },
  };
}

const fallbackLook = (id: BodyId): BodyLook => {
  const c = [1, 3, 5].map((i) => (parseInt(BODIES[id].colour.slice(i, i + 2), 16) / 255).toFixed(3)).join(", ");
  return { id, surface: `vec4 surface(vec3 p) { float n = fbm(p * 5.0); return vec4(vec3(${c}) * (0.85 + 0.3 * n), 0.0); }` };
};

/** The name of a body as the painter takes it: any case, `Sun`, a planet or Pluto, or a moon such as `Io`. */
function idOf(name: string): BodyId {
  const id = name.toLowerCase();
  if (!(id in BODIES)) throw new Error(`wakusei-planets: no body called ${name}`);
  return id as BodyId;
}

const moonsOf = (planet: string): readonly MoonId[] => {
  const id = planet.toLowerCase();
  return id === "earth" ? [] : id in MOONS_OF ? MOONS_OF[id as keyof typeof MOONS_OF] : [];
};

function paint(T: PainterThree, id: BodyId, context: PaintContext, bases: { near: string; far: string }): Painting {
  const facts = BODIES[id];
  const look = lookOf(id) ?? fallbackLook(id);
  const wantPainted = (context.look === "painted" || look.mapped === true) && look.painted !== undefined;
  const ratio = context.ratio ?? 1;
  const maxWidth = context.maxTexture ?? 2048;
  const redraw = (): void => context.invalidate?.();
  const releases: (() => void)[] = [];
  const disposables: { dispose(): void }[] = [];

  const sphere = acquire(T, "sphere", () => new T.SphereGeometry(1, 96, 48));
  releases.push(sphere.release);

  const group = new T.Group();
  group.name = facts.name.en;

  const uniforms = (painted: boolean): Record<string, THREE.IUniform> => {
    const a = look.atmosphere;
    return {
      uLight: { value: new T.Vector3(1, 0, 0) },
      uRelief: { value: painted ? (look.painted?.relief ?? 0) : (look.relief ?? 0.6) },
      uAmbient: { value: look.ambient ?? 0.04 },
      uLimb: { value: look.limb ?? 0 },
      uWrap: { value: look.wrap ?? (a === undefined ? 0.04 : 0.3) },
      uAtmos: { value: new T.Vector3(...(a?.colour ?? [0, 0, 0])) },
      uAtmosPow: { value: a?.power ?? 3 },
      uRimBase: { value: 0.12 },
      uEmissive: { value: look.emissive === true ? 1 : 0 },
      uRingN: { value: new T.Vector3(0, 1, 0) },
      uRingR: { value: new T.Vector2(1, 2) },
      uRingOn: { value: 0 },
      uRingTex: { value: null },
      uMap: { value: null },
      uScale: { value: 1 },
      uOccN: { value: 0 },
      uOcc: { value: new Float32Array(24) },
    };
  };
  const material = (painted: boolean): THREE.ShaderMaterial => {
    const m = new T.ShaderMaterial({ vertexShader: VERTEX_WORLD, fragmentShader: bodyFragment(painted ? PAINTED_SURFACE : look.surface, painted, true), uniforms: uniforms(painted) });
    disposables.push(m);
    return m;
  };
  const shader = material(false);
  const paintedMaterial = wantPainted ? material(true) : undefined;
  const materials = [shader, ...(paintedMaterial ? [paintedMaterial] : [])];

  const mesh = new T.Mesh(sphere.value, shader);
  mesh.matrixAutoUpdate = false;
  group.add(mesh);

  // rings: the table's strip at once, the picture of them (painted) when it arrives
  let ringMesh: THREE.Mesh | undefined;
  let ringMaterial: THREE.ShaderMaterial | undefined;
  let ringTexture: THREE.Texture | undefined;
  let ringInner = 1;
  let ringOuter = 2;
  const table = look.emissive === true ? null : ringStrip(facts, 1024);
  const loadImage = (url: string): Promise<THREE.Texture> =>
    new Promise((resolve, reject) => {
      const loader = new T.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(url, resolve, undefined, (e) => reject(e instanceof Error ? e : new Error("texture failed")));
    });
  let gone = false;
  if (table !== null) {
    ringInner = table.inner;
    ringOuter = table.outer;
    const strip = new T.DataTexture(table.data, table.width, 1, T.RGBAFormat);
    strip.magFilter = T.LinearFilter;
    strip.minFilter = T.LinearFilter;
    strip.wrapS = T.ClampToEdgeWrapping;
    strip.needsUpdate = true;
    ringTexture = strip;
    const ringGeometry = new T.RingGeometry(ringInner, ringOuter, 256, 1);
    disposables.push(ringGeometry);
    ringMaterial = new T.ShaderMaterial({
      vertexShader: RING_VERTEX_WORLD,
      fragmentShader: RING_FRAGMENT_WORLD,
      side: T.DoubleSide,
      transparent: true,
      depthWrite: false,
      uniforms: { uRingTex: { value: strip }, uRingR: { value: new T.Vector2(ringInner, ringOuter) }, uLight: { value: new T.Vector3(1, 0, 0) }, uRingN: { value: new T.Vector3(0, 1, 0) }, uScale: { value: 1 } },
    });
    disposables.push(ringMaterial);
    ringMesh = new T.Mesh(ringGeometry, ringMaterial);
    ringMesh.matrixAutoUpdate = false;
    ringMesh.renderOrder = 1;
    group.add(ringMesh);
    const photo = wantPainted ? look.painted?.rings : undefined;
    if (photo !== undefined) {
      void loadImage(`${bases.near}${photo.map}-${photo.width}.webp`).then(
        (t) => {
          if (gone) {
            t.dispose();
            return;
          }
          t.magFilter = T.LinearFilter;
          t.minFilter = T.LinearFilter;
          t.generateMipmaps = false;
          t.wrapS = T.ClampToEdgeWrapping;
          t.colorSpace = T.NoColorSpace;
          ringTexture?.dispose();
          ringTexture = t;
          ringInner = photo.from / facts.radiusKm;
          ringOuter = photo.to / facts.radiusKm;
          ringMesh!.geometry.dispose();
          ringMesh!.geometry = new T.RingGeometry(ringInner, ringOuter, 256, 1);
          disposables.push(ringMesh!.geometry);
          ringMaterial!.uniforms.uRingTex!.value = t;
          ringMaterial!.uniforms.uRingR!.value.set(ringInner, ringOuter);
          for (const m of materials) {
            m.uniforms.uRingTex!.value = t;
            m.uniforms.uRingR!.value.set(ringInner, ringOuter);
          }
          redraw();
        },
        () => undefined,
      );
    }
    for (const m of materials) {
      m.uniforms.uRingOn!.value = 1;
      m.uniforms.uRingTex!.value = strip;
      m.uniforms.uRingR!.value.set(ringInner, ringOuter);
    }
  }

  // the glow of a star: a plane through its centre that the caller turns to the camera
  if (look.emissive === true) {
    const glowGeometry = acquire(T, "glow", () => new T.PlaneGeometry(6, 6));
    releases.push(glowGeometry.release);
    const glowMaterial = new T.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColour: { value: new T.Vector3(1, 0.7, 0.3) } } });
    disposables.push(glowMaterial);
    const glow = new T.Mesh(glowGeometry.value, glowMaterial);
    glow.renderOrder = 4;
    glow.frustumCulled = false;
    group.add(glow);
  }

  // the painted map: the smallest width at once, a sharper one when the body is big on the screen, back to the small one when it is not
  const widths = (look.painted?.widths ?? []).filter((w, i) => i === 0 || w <= maxWidth);
  let small: THREE.Texture | undefined;
  let sharp: THREE.Texture | undefined;
  let sharpWidth = 0;
  let loading = false;
  let failed = false;
  let tooBigSince = 0;
  const tried = new Set<number>();
  const urlOf = (w: number): string => `${look.painted!.far !== undefined && w >= look.painted!.far ? bases.far : bases.near}${look.painted!.map}-${w}.webp`;
  const prepare = (t: THREE.Texture): THREE.Texture => {
    t.anisotropy = 4;
    t.wrapS = T.RepeatWrapping;
    t.colorSpace = T.NoColorSpace;
    return t;
  };
  const show = (t: THREE.Texture): void => {
    paintedMaterial!.uniforms.uMap!.value = t;
    mesh.material = paintedMaterial!;
    redraw();
  };
  if (wantPainted && paintedMaterial !== undefined && widths[0] !== undefined) {
    void loadImage(urlOf(widths[0])).then(
      (t) => {
        if (gone) {
          t.dispose();
          return;
        }
        small = prepare(t);
        if (sharp === undefined) show(small);
      },
      () => {
        failed = true;
      },
    );
  }
  const keepSized = (radiusPx: number): void => {
    if (!wantPainted || failed || small === undefined || loading) return;
    const wanted = radiusPx * 2 * ratio * 1.6;
    const next = widths.find((w) => w >= wanted) ?? widths[widths.length - 1]!;
    if (next > sharpWidth && next > widths[0]! && !tried.has(next)) {
      tried.add(next);
      loading = true;
      void loadImage(urlOf(next)).then(
        (t) => {
          loading = false;
          if (gone) {
            t.dispose();
            return;
          }
          const old = sharp;
          sharp = prepare(t);
          sharpWidth = next;
          show(sharp);
          old?.dispose();
        },
        () => {
          loading = false;
        },
      );
    } else if (sharp !== undefined && wanted * 2 < sharpWidth) {
      // much smaller on the screen than the picture it holds: after a few seconds, let the big picture go
      const now = Date.now();
      if (tooBigSince === 0) tooBigSince = now;
      else if (now - tooBigSince > 4000) {
        show(small);
        sharp.dispose();
        sharp = undefined;
        sharpWidth = 0;
        tried.clear();
        tooBigSince = 0;
      }
    } else tooBigSince = 0;
  };

  const axes = facts.axesKm;
  const scaleX = axes ? axes[1] / facts.radiusKm : 1;
  const scaleY = axes ? axes[2] / facts.radiusKm : 1 - facts.flattening;
  const scaleZ = axes ? axes[0] / facts.radiusKm : 1;
  const basis = (object: THREE.Object3D, x: Vec3, y: Vec3, z: Vec3, sx = 1, sy = 1, sz = 1): void => {
    object.matrix.makeBasis(new T.Vector3(x[0] * sx, x[1] * sx, x[2] * sx), new T.Vector3(y[0] * sy, y[1] * sy, y[2] * sy), new T.Vector3(z[0] * sz, z[1] * sz, z[2] * sz));
  };
  const light = new T.Vector3();
  const poleVec = new T.Vector3();

  return {
    object: group,
    ...(look.emissive === true ? { billboard: true } : {}),
    update(info) {
      light.set(info.toSun[0], info.toSun[1], info.toSun[2]);
      const scale = group.scale.x || 1;
      if (look.emissive !== true) {
        const { pole, meridian } = info.pose ?? orientation(id, info.ms);
        const east = cross(pole, meridian);
        basis(mesh, east, pole, meridian, scaleX, scaleY, scaleZ);
        if (ringMesh !== undefined) basis(ringMesh, meridian, east, pole);
        poleVec.set(pole[0], pole[1], pole[2]);
      }
      const occluders = info.occluders ?? [];
      const shaded = Math.min(6, occluders.length);
      for (const m of materials) {
        (m.uniforms.uLight!.value as THREE.Vector3).copy(light);
        m.uniforms.uScale!.value = scale;
        (m.uniforms.uRingN!.value as THREE.Vector3).copy(poleVec);
        m.uniforms.uOccN!.value = shaded;
        const packed = m.uniforms.uOcc!.value as Float32Array;
        for (let i = 0; i < shaded; i += 1) packed.set(occluders[i]!, i * 4);
      }
      if (ringMaterial !== undefined) {
        (ringMaterial.uniforms.uLight!.value as THREE.Vector3).copy(light);
        (ringMaterial.uniforms.uRingN!.value as THREE.Vector3).copy(poleVec);
        ringMaterial.uniforms.uScale!.value = scale;
      }
      keepSized(info.radiusPx);
    },
    dispose() {
      gone = true;
      small?.dispose();
      sharp?.dispose();
      ringTexture?.dispose();
      for (const d of disposables) d.dispose();
      for (const r of releases) r();
      group.clear();
    },
  };
}

/**
 * A painter: makes the bodies as three.js objects (`make`) and tells where a planet's moons are (`moons`). Its shape is chikyu-earth's `BodyPainter`, so `setBodyPainter(painter)` is all the wiring.
 *
 * @example
 * ```ts no-run
 * import { createPainter, type WakuseiPainter } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const mine: WakuseiPainter = createPainter({ textureBase: "/pictures/", farBase: "/pictures/" });
 * console.log(mine.looks.join(", "));
 * ```
 */
export interface WakuseiPainter {
  /** The looks `make` takes in `context.look`. */
  readonly looks: readonly PainterLook[];
  /** Make a body: `Sun`, a planet, `Pluto` or a moon, in any case. Throws for a name it does not know. */
  /** `three` is the three.js module (or a subset of it holding the parts `PainterThree` names); it is typed loosely so that another package can hand over its own subset. */
  make(three: object, name: string, context?: PaintContext): Painting;
  /** The moons the painter draws for a planet (none for the Earth: its Moon is the viewer's own), where they are at a time, nearest first. */
  moons(planet: string, ms: number): MoonSite[];
}

/**
 * Make a painter that takes its pictures from the given folders (jsDelivr's copy of this version by default).
 *
 * @param options - Where the pictures are.
 * @returns The painter.
 *
 * @example
 * ```ts no-run
 * import { createPainter } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const painter = createPainter();
 * console.log(painter.moons("Mars", Date.UTC(2026, 10, 2)).map((m) => m.name));
 * ```
 */
export function createPainter(options: PainterOptions = {}): WakuseiPainter {
  const near = slash(options.textureBase ?? TEXTURE_BASE);
  const far = slash(options.farBase ?? (options.textureBase !== undefined ? options.textureBase : TEXTURE_FAR_BASE));
  return {
    looks: LOOKS,
    make: (three, name, context = {}) => paint(three as PainterThree, idOf(name), context, { near, far }),
    moons(planet, ms) {
      const radius = BODIES[idOf(planet) as PlanetId]?.radiusKm;
      if (radius === undefined) return [];
      return moonsOf(planet)
        .map((moon) => ({ name: titled(moon), offset: moonOffset(moon, ms), radius: BODIES[moon].radiusKm / radius }))
        .sort((a, b) => Math.hypot(...a.offset) - Math.hypot(...b.offset));
    },
  };
}

/**
 * The painter with its default pictures: pass it to chikyu-earth's `setBodyPainter`.
 *
 * @example
 * ```ts no-run
 * import { painter } from "@johnmorrisdotca/wakusei-planets/painter";
 * import { setBodyPainter } from "@johnmorrisdotca/chikyu-earth/space/element";
 *
 * setBodyPainter(painter);
 * ```
 */
export const painter: WakuseiPainter = createPainter();
