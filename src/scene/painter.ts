// The bodies as objects for someone else's three.js scene: a radius-1 `Object3D` for the Sun, a planet, Pluto or a moon, in the realistic or the painted look, lit in the scene's own axes so a
// perspective camera can look at it from anywhere. It is made for chikyu-earth's space view (its `BodyPainter` seam) and holds nothing of its own: no renderer, no loop, no clock.
// The caller places, sizes and lights the object and calls `update` when something changed; a picture that arrives later asks for a redraw through `context.invalidate`.
import type * as THREE from "three";
import "../bodies/all.ts";
import { BODIES, MOONS_OF, type BodyId, type MoonId, type HostId } from "../facts.ts";
import { writeBasis } from "./basis.ts";
import { TEXTURE_BASE, TEXTURE_FAR_BASE, TILES_BASE, slash, loadImage, MAP_ANISOTROPY, mapSourceFor, tilesAllowed } from "./textures.ts";
import { createSourceBook, type SourceBook } from "../door/book.ts";
import { OWN_BY_ID } from "../door/own.ts";
import { mercuryTilesCredit, PICTURE_CREDITS, picturesCredit } from "../picture-credits.ts";
import { cross, type Vec3 } from "../vec.ts";
import { silhouette } from "../pose.ts";
import { starBrightness, type StarLook } from "../star.ts";
import type { ThreeParts } from "./body.ts";
import { bodyFragment, PAINTED_SURFACE, PAINTED_SURFACE_WINDOWED, RING_FRAGMENT_WORLD, RING_VERTEX_WORLD, VERTEX_WORLD } from "./glsl.ts";
import { makeGlowMaterial } from "./glow.ts";
import { prominenceFrame } from "./prominence.ts";
import { fallbackLook } from "./fallback.ts";
import { createDetail, type Detail, type DetailStats } from "./detail.ts";
import { moonPolarRelief, moonPolarUniforms } from "./moon-polar.ts";
import { atmosphereTint, detailOf, lookOf } from "./look.ts";
import { craftGeometry, craftMaterial, craftPicture } from "./craft.ts";
import { shapeGeometry } from "./shape.ts";
import { seenRegion, type Sight, type TileLevel } from "./tiles.ts";
import { moonOffset, orientation } from "./orient.ts";
import { ringStrip } from "./rings.ts";
import { createNameLabel, nameLabelColour, nameLabelText, shapeReach, type NameLabel, type NameLabelOptions } from "./name-label.ts";
import { roundShape } from "./round.ts";

let pictureLoads = 0;

/**
 * How many surface pictures are still being fetched. A view draws once more when one arrives, so a rest test waits for this to be 0.
 *
 * @returns The number of picture fetches that have not finished.
 *
 * @example
 * ```ts
 * import { picturesPending } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * console.log(picturesPending());
 * ```
 */
export function picturesPending(): number {
  return pictureLoads;
}

function trackPicture<T>(load: Promise<T>): Promise<T> {
  pictureLoads += 1;
  return load.finally(() => {
    pictureLoads -= 1;
  });
}
export { moonOffset, orientation };
export { nameLabelLook, nameLabelText, nameTone, readNameLabel, setBodyLabelFontUrl, type NameLabelOptions, type NameLabelTone } from "./name-label.ts";
export { mercuryTilesCredit, PICTURE_CREDITS, picturesCredit, type PictureCredit } from "../picture-credits.ts";

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
  /** A star drawn from its numbers, in place of the built-in Sun. */
  star?: StarLook;
  /** True to draw every body that has a surface picture from it, in any look (the space view does: a planet or a moon with a real map never shows the shaded look instead). A body with no picture is still shaded. */
  mapped?: boolean;
  /** Ask for a new draw: a sharper picture has arrived. */
  invalidate?(): void;
  /** Device pixels to a CSS pixel; default 1. */
  ratio?: number;
  /** The widest picture the GPU should be given, in pixels; default 2048. */
  maxTexture?: number;
  /** Told when the finer map tiles' levels for this body are known (`undefined` when it has none), so a view can raise its zoom range. Only called for a painter that has a tile set and a view in `PaintInfo`. */
  onLevels?(levels: readonly TileLevel[] | undefined): void;
  /** The body's name written on its globe (see `PaintLabel`), or none. `setLabel` on the painting changes it later. */
  label?: PaintLabel | null;
}

/**
 * The name on a body the painter makes: the family's `NameLabelOptions`, with the language the name is written in (`en`, in capitals, by default) or a `text` of your own instead of the body's name.
 *
 * @example
 * ```ts no-run
 * import type { PaintLabel } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const label: PaintLabel = { look: "painted", lang: "ja" };
 * console.log(label.lang);
 * ```
 */
export interface PaintLabel extends NameLabelOptions {
  /** The language of the name: `en` (capitals) or `ja`. Default `en`. */
  lang?: "en" | "ja";
  /** Written instead of the body's name. */
  text?: string;
}

/**
 * The camera that draws a body and the size of its view, so the painter can tell which part of the body's surface is in view and lay finer map tiles over it. The camera's world and projection matrices must be
 * current. Without it a body is drawn from its own pictures, as it always was.
 *
 * @example
 * ```ts no-run
 * import type { PaintView } from "@johnmorrisdotca/wakusei-planets/painter";
 * import * as THREE from "three";
 *
 * const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000);
 * const view: PaintView = { camera, width: 420, height: 420 };
 * console.log(view.width);
 * ```
 */
export interface PaintView {
  camera: THREE.Camera;
  /** The view's width and height in CSS pixels. */
  width: number;
  height: number;
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
  /** Seconds of motion in a scene, for a star's surface and glow. Defaults to 0. */
  seconds?: number;
  /** The pole and the prime meridian to draw instead of the body's real ones at `ms` (a portrait's own pose), in the scene's axes. */
  pose?: { pole: Vec3; meridian: Vec3 };
  /** Spheres that may shade this body from the Sun: x, y, z (from this body's centre) and radius, all in this body's radii, in the scene's axes. At most six are used. */
  occluders?: readonly (readonly [number, number, number, number])[];
  /** The camera, so that a body big in the view gets finer map tiles for the part in view (see `PaintView`), and so that the body is drawn round wherever it is in the picture (see `round`). Left out, none are used. */
  view?: PaintView;
  /**
   * Draw the body round wherever it is in the picture. A perspective camera draws a sphere near the picture's edge as an ellipse (long along the line to the middle, by 1 / cos of the angle off the line of sight: a quarter
   * as long again 37 degrees out, which is the edge of a wide window); with `view` given, a body is drawn as the ellipsoid that projects to a circle, its colours, light and map unchanged, a ring and a name squeezed with it. `false` leaves
   * the camera's own stretch. Default `true`; it takes effect only for a perspective camera given in `view`.
   */
  round?: boolean;
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
  /** True to have the caller turn the whole object to face the camera. No body asks for it now: the Sun is a globe that turns with its own spin and the view, and its glow turns itself to the camera in `update` (from `PaintInfo.view`). */
  billboard?: boolean;
  /** Call at each draw, after the object has been placed and scaled. */
  update(info: PaintInfo): void;
  /** What the window of finer map tiles on this body is doing, or `undefined` for a body with none (a glowing one, one with no painted map, or a painter with no tile set). */
  readonly tiles?: DetailStats;
  /** Write the body's name on its globe, change how, or take it off (`null`). The name is drawn when the font is in, and `context.invalidate` is called then. */
  setLabel(label: PaintLabel | null): void;
  /** The name on the globe now: whether one is drawn (made and big enough on the screen at the last `update`), the text, and the group's turn about the pole in radians (for `facing`), and `shell`, the radius of the shell the name is written on in the mesh's units (1 on a smooth globe, more on a lumpy moon). */
  readonly label: { shown: boolean; text: string; turn: number; look: string; shell: number } | null;
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
 * Where the pictures are, if not on jsDelivr: a folder address that ends in a slash. `farBase` holds the widest pictures (2048), which the npm package leaves out. A page that gives its own
 * `textureBase` (the package's `dist/textures/`, say) and no `farBase` is never asked for those: the painter stops at the widest the package ships (1024). Give `farBase` too when the 2048s are served.
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
  /** Where the finer map tiles are (a folder address that ends in a slash; `off` for none). Left out, the demo site's (`TILES_BASE`) unless `textureBase` is given, in which case there are none. They are laid over a body that is big in the view, when the caller gives `PaintInfo.view`. */
  tiles?: string;
  /** The sources of the view that owns the painter (the data door): a map source in it takes the place of the folder of tiles for its body. Left out, the painter has a book of its own and draws from the folder alone. */
  book?: SourceBook;
}

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

/** A body whose disc is at least this many device pixels across its radius is worked out for tiles; a smaller one cannot want them, and is not looked at. */
const TILES_FROM_PX = 150;

/** A three.js camera as the region maths sees it. */
function sightOf(T: PainterThree, view: PaintView): Sight {
  const { camera, width, height } = view;
  camera.updateMatrixWorld();
  const a = new T.Vector3();
  const b = new T.Vector3();
  const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true;
  const eye = perspective ? camera.getWorldPosition(new T.Vector3()) : undefined;
  const forward = camera.getWorldDirection(new T.Vector3());
  return {
    eye: eye === undefined ? null : [eye.x, eye.y, eye.z],
    forward: [forward.x, forward.y, forward.z],
    width,
    height,
    ray(x, y) {
      a.set(x, y, -1).unproject(camera);
      b.set(x, y, 1).unproject(camera);
      b.sub(a).normalize();
      return { origin: [a.x, a.y, a.z], direction: [b.x, b.y, b.z] };
    },
    project(point) {
      a.set(point[0], point[1], point[2]).project(camera);
      return a.z < -1 || a.z > 1 ? undefined : { x: a.x, y: a.y };
    },
  };
}

/** One body a painter is holding, so the credit can read which picture and which tile window are on it now. */
interface CreditBody {
  id: BodyId;
  picture: boolean;
  tiles(): boolean;
}

function paint(T: PainterThree, id: BodyId, context: PaintContext, bases: { near: string; far: string | undefined; tiles: string | undefined; book: SourceBook; shared: boolean }, hold?: (body: CreditBody) => () => void): Painting {
  const star = id === "sun" ? context.star : undefined;
  const facts = star?.facts ?? BODIES[id];
  const look = star?.look ?? lookOf(id) ?? fallbackLook(facts);
  const wantPainted = (context.look === "painted" || look.mapped === true || context.mapped === true) && look.painted !== undefined;
  const ratio = context.ratio ?? 1;
  const maxWidth = context.maxTexture ?? 2048;
  const redraw = (): void => context.invalidate?.();
  const releases: (() => void)[] = [];
  const disposables: { dispose(): void }[] = [];

  const sphere = acquire(T, "sphere", () => new T.SphereGeometry(1, 96, 48));
  releases.push(sphere.release);

  const group = new T.Group();
  group.name = facts.name.en;

  // a glowing body (the Sun) is drawn as it always was: no window of finer map and no generic detail
  const generic = look.emissive !== true;
  const fine = detailOf(look);
  // the squeeze that makes the body look round (see `round.ts`), written at each draw and shared by the globe, the rings and the name: one object each, so that a material made later holds the same
  const squeeze = { uRoundAxis: { value: new T.Vector3(1, 0, 0) }, uRoundK: { value: 1 } };
  const uniforms = (painted: boolean): Record<string, THREE.IUniform> => {
    const a = look.atmosphere;
    return {
      ...squeeze,
      ...(painted && id === "moon" ? moonPolarUniforms() : {}),
      ...(generic
        ? {
            uTexel: { value: painted ? (2 * Math.PI) / (look.painted?.widths[0] ?? 2048) : 0.005 },
            uDetailAmp: { value: fine.amount },
            uDetailStretch: { value: fine.stretch },
            ...(painted ? { uDetail: { value: null }, uDetailRect: { value: [0, 1, 1, 1] }, uDetailFade: { value: new T.Vector2(0, 0) }, uDetailOn: { value: 0 }, uDetailTexel: { value: 0.003 } } : {}),
          }
        : {}),
      uLight: { value: new T.Vector3(1, 0, 0) },
      uRelief: { value: painted ? (look.painted?.relief ?? 0) : (look.relief ?? 0.6) },
      uAmbient: { value: look.ambient ?? 0.04 },
      uLimb: { value: look.limb ?? 0 },
      uWrap: { value: look.wrap ?? (a === undefined ? 0.04 : 0.3) },
      uAtmos: { value: new T.Vector3(...atmosphereTint(a)) },
      uAtmosPow: { value: a?.power ?? 3 },
      uRimBase: { value: 0.12 },
      uEmissive: { value: look.emissive === true ? 1 : 0 },
      uRingN: { value: new T.Vector3(0, 1, 0) },
      uRingR: { value: new T.Vector2(1, 2) },
      uRingOn: { value: 0 },
      uRingTex: { value: null },
      uMap: { value: null },
      ...(star === undefined ? {} : { uTime: { value: 0 }, uPulse: { value: 1 } }),
      uScale: { value: 1 },
      uOccN: { value: 0 },
      uOcc: { value: new Float32Array(24) },
    };
  };
  const material = (painted: boolean): THREE.ShaderMaterial => {
    const m = new T.ShaderMaterial({ vertexShader: VERTEX_WORLD, fragmentShader: bodyFragment(painted ? (generic ? PAINTED_SURFACE_WINDOWED : PAINTED_SURFACE) : look.surface, painted, true, look.limbTint, generic, painted && id === "moon"), uniforms: uniforms(painted) });
    disposables.push(m);
    return m;
  };
  const shader = material(false);
  const paintedMaterial = wantPainted ? material(true) : undefined;
  const materials = paintedMaterial ? [shader, paintedMaterial] : [shader];

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
  let gone = false;
  // the mesh picture of a body drawn from a mission's model: it is this painting's own, and it is given back with the painting
  let craftMap: THREE.Texture | undefined;
  let craftMat: THREE.ShaderMaterial | undefined;
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
      premultipliedAlpha: true,
      depthWrite: false,
      uniforms: { ...squeeze, uRingTex: { value: strip }, uRingR: { value: new T.Vector2(ringInner, ringOuter) }, uLight: { value: new T.Vector3(1, 0, 0) }, uRingN: { value: new T.Vector3(0, 1, 0) }, uScale: { value: 1 } },
    });
    disposables.push(ringMaterial);
    ringMesh = new T.Mesh(ringGeometry, ringMaterial);
    ringMesh.matrixAutoUpdate = false;
    ringMesh.renderOrder = 1;
    group.add(ringMesh);
    const photo = wantPainted ? look.painted?.rings : undefined;
    if (photo !== undefined) {
      void loadImage(T, `${bases.near}${photo.map}-${photo.width}.webp`).then(
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
          const stripGeometry = ringMesh!.geometry;
          const stripAt = disposables.indexOf(stripGeometry);
          if (stripAt >= 0) disposables.splice(stripAt, 1);
          stripGeometry.dispose();
          ringMesh!.geometry = new T.RingGeometry(ringInner, ringOuter, 256, 1);
          disposables.push(ringMesh!.geometry);
          // the picture is not premultiplied and the strip was. three.js keeps every program a material has compiled, so changing the flag would leave the strip's program and its vertex array on the card: the strip's material is let go and a new one is made
          const stripMaterial = ringMaterial!;
          stripMaterial.uniforms.uRingTex!.value = t;
          stripMaterial.uniforms.uRingR!.value.set(ringInner, ringOuter);
          const photoMaterial = new T.ShaderMaterial({
            vertexShader: RING_VERTEX_WORLD,
            fragmentShader: RING_FRAGMENT_WORLD,
            side: T.DoubleSide,
            transparent: true,
            premultipliedAlpha: false,
            depthWrite: false,
            uniforms: stripMaterial.uniforms,
          });
          ringMesh!.material = photoMaterial;
          const materialAt = disposables.indexOf(stripMaterial);
          if (materialAt >= 0) disposables.splice(materialAt, 1);
          stripMaterial.dispose();
          disposables.push(photoMaterial);
          ringMaterial = photoMaterial;
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

  // the glow of a star: a plane through its centre that `update` turns to the camera, so the globe inside it keeps its own orientation
  let glowMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined;
  if (look.emissive === true) {
    const glowGeometry = acquire(T, "glow", () => new T.PlaneGeometry(6, 6));
    releases.push(glowGeometry.release);
    const glowMaterial = makeGlowMaterial(T, look.glow);
    disposables.push(glowMaterial);
    const glow = new T.Mesh(glowGeometry.value, glowMaterial);
    glow.renderOrder = 4;
    glow.frustumCulled = false;
    group.add(glow);
    glowMesh = glow;
  }

  // the painted map: the smallest width at once, a sharper one when the body is big on the screen, back to the small one when it is not
  // a width the far base holds (the sharpest, which the npm package leaves out) only when there is a far base: a page that gave its own textureBase and no farBase has only the package's widths
  const farFrom = look.painted?.far;
  const widths = (look.painted?.widths ?? []).filter((w, i) => i === 0 || (w <= maxWidth && (bases.far !== undefined || farFrom === undefined || w < farFrom)));
  let small: THREE.Texture | undefined;
  let sharp: THREE.Texture | undefined;
  let sharpWidth = 0;
  let loading = false;
  let failed = false;
  let tooBigSince = 0;
  const tried = new Set<number>();
  const urlOf = (w: number): string => `${look.painted!.far !== undefined && w >= look.painted!.far && bases.far !== undefined ? bases.far : bases.near}${look.painted!.map}-${w}.webp`;
  const prepare = (t: THREE.Texture): THREE.Texture => {
    t.anisotropy = MAP_ANISOTROPY;
    t.wrapS = T.RepeatWrapping;
    t.colorSpace = T.NoColorSpace;
    return t;
  };
  const show = (t: THREE.Texture, w: number): void => {
    paintedMaterial!.uniforms.uMap!.value = t;
    if (paintedMaterial!.uniforms.uTexel !== undefined) paintedMaterial!.uniforms.uTexel.value = (2 * Math.PI) / w;
    mesh.material = paintedMaterial!;
    // the shaded look was drawn only until the picture came: if it was drawn at all, its program is let go now, so what a body holds does not depend on which came first
    shader.dispose();
    redraw();
  };
  if (wantPainted && paintedMaterial !== undefined && widths[0] !== undefined) {
    void trackPicture(loadImage(T, urlOf(widths[0]))).then(
      (t) => {
        if (gone) {
          t.dispose();
          return;
        }
        small = prepare(t);
        if (sharp === undefined) show(small, widths[0]!);
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
      void trackPicture(loadImage(T, urlOf(next))).then(
        (t) => {
          loading = false;
          if (gone) {
            t.dispose();
            return;
          }
          const old = sharp;
          sharp = prepare(t);
          sharpWidth = next;
          show(sharp, next);
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
        show(small, widths[0]!);
        sharp.dispose();
        sharp = undefined;
        sharpWidth = 0;
        tried.clear();
        tooBigSince = 0;
      }
    } else tooBigSince = 0;
  };

  // the window of finer map tiles for a close view, laid over the painted map by the painted material (see `scene/detail.ts`); only for a body that is told which camera sees it
  const windowUniforms = wantPainted && paintedMaterial !== undefined && generic && (bases.tiles !== undefined || bases.shared) && look.painted !== undefined ? paintedMaterial.uniforms : undefined;
  const detail: Detail | undefined =
    windowUniforms === undefined
      ? undefined
      : createDetail(T, {
          source: () => mapSourceFor(bases.book, bases.tiles, look.painted!.map),
          book: bases.book,
          body: look.painted!.map,
          ratio: () => ratio,
          allowed: tilesAllowed,
          redraw,
          ...(id === "moon" && bases.tiles !== undefined ? { moonPolar: moonPolarRelief(T, windowUniforms, () => bases.tiles, redraw) } : {}),
          ...(context.onLevels === undefined ? {} : { onLevels: (levels: readonly TileLevel[] | undefined) => context.onLevels!(levels) }),
          apply: (shown) => {
            if (shown === null) {
              windowUniforms.uDetailOn!.value = 0;
              windowUniforms.uDetail!.value = null;
              return;
            }
            windowUniforms.uDetail!.value = shown.texture;
            windowUniforms.uDetailRect!.value = [shown.rect.u0, shown.rect.vTop, shown.rect.du, shown.rect.dv];
            (windowUniforms.uDetailFade!.value as THREE.Vector2).set(shown.fade.u, shown.fade.v);
            windowUniforms.uDetailTexel!.value = shown.texel;
            windowUniforms.uDetailOn!.value = 1;
          },
        });

  const axes = facts.axesKm;
  let scaleX = axes ? axes[1] / facts.radiusKm : 1;
  let scaleY = axes ? axes[2] / facts.radiusKm : 1 - facts.flattening;
  let scaleZ = axes ? axes[0] / facts.radiusKm : 1;
  // a moon with a published shape model: the globe moved to its radii takes the ellipsoid's place when its table (a chunk of its own) arrives, and needs no stretching
  if (look.shape !== undefined) {
    look.shape().then(
      (table) => {
        if (gone) return;
        const shaped = acquire(T, `shape:${id}`, () => shapeGeometry(T, table, facts.radiusKm, { lon: 96, lat: 48 }));
        releases.push(shaped.release);
        (mesh as unknown as THREE.Mesh).geometry = shaped.value;
        scaleX = 1;
        scaleY = 1;
        scaleZ = 1;
        redraw();
      },
      () => undefined,
    );
  }
  // a body whose picture is the mesh a mission published: the faces carry that model's own picture, not a map wrapped on a globe
  if (look.craft !== undefined) {
    look.craft().then(
      (table) => {
        if (gone) return;
        const shaped = acquire(T, `craft:${id}`, () => craftGeometry(T, table));
        releases.push(shaped.release);
        const material = acquire(T, `craftmat:${id}`, () => craftMaterial(T, look.ambient ?? 0.08));
        releases.push(material.release);
        materials.push(material.value);
        craftMat = material.value;
        (mesh as unknown as THREE.Mesh).geometry = shaped.value;
        mesh.material = material.value;
        scaleX = 1;
        scaleY = 1;
        scaleZ = 1;
        void trackPicture(loadImage(T, `${bases.near}${table.map}`)).then(
          (picture) => {
            if (gone) {
              picture.dispose();
              return;
            }
            // the painted maps do this too: a colour conversion would leave a second texture the painting does not own
            picture.colorSpace = T.NoColorSpace;
            craftPicture(picture);
            craftMap = picture;
            material.value.uniforms.uMap!.value = picture;
            redraw();
          },
          () => undefined,
        );
        redraw();
      },
      () => undefined,
    );
  }
  const light = new T.Vector3();
  const poleVec = new T.Vector3();

  // the name on the globe: a child of the mesh, so it turns with the body; made when asked, drawn once its font is in
  let label: NameLabel | undefined;
  let labelText = "";
  let labelShown = false;
  // what `label` reports: one object, written at each draw (it is read for every body at every frame)
  const labelReport = { shown: false, text: "", turn: 0, look: "", shell: 1 };
  const setLabel = (next: PaintLabel | null): void => {
    if (next === null || next === undefined || gone) {
      if (label !== undefined) {
        mesh.remove(label.object);
        label.dispose();
        label = undefined;
        labelShown = false;
        labelReport.shown = false;
      }
      return;
    }
    const { lang, text, ...options } = next;
    labelText = text ?? nameLabelText(facts.name, lang ?? "en");
    labelReport.text = labelText;
    if (label === undefined) {
      label = createNameLabel(T, labelText, options, look.emissive === true, redraw, nameLabelColour(id, facts.colour, wantPainted), squeeze);
      labelReport.look = label.look;
      mesh.add(label.object);
    } else {
      label.set(labelText, options);
      labelReport.look = label.look;
      redraw();
    }
  };
  if (context.label) setLabel(context.label);

  const drop = hold?.({ id, picture: wantPainted, tiles: () => detail?.stats.shown != null });
  const glowAxis = new T.Vector3();

  return {
    object: group,
    setLabel,
    get label() {
      return label === undefined ? null : labelReport;
    },
    get tiles() {
      return detail?.stats;
    },
    update(info) {
      light.set(info.toSun[0], info.toSun[1], info.toSun[2]);
      const scale = group.scale.x || 1;
      // a star's glow faces the camera, when `update` is given the camera (`info.view`): without it the glow keeps its last turn, so a caller that used to turn the Sun's object itself passes `view` now. The group is
      // never turned, so `camera.quaternion` (the camera's local turn, which is its world turn for a camera with no parent, as the views here have) is the glow's own; the globe inside it has the body's own
      // pole and prime meridian like every other body
      if (glowMesh !== undefined && info.view !== undefined) glowMesh.quaternion.copy(info.view.camera.quaternion);
      // round wherever it is in the picture: a perspective camera given to us, the body not squeezed when it was asked not to be (the glow is a disc facing the camera, which a perspective camera draws round already)
      {
        const camera = info.view?.camera as THREE.PerspectiveCamera | undefined;
        if (camera !== undefined && camera.isPerspectiveCamera === true && info.round !== false) {
          const e = camera.matrixWorld.elements;
          const shape = roundShape([e[12]!, e[13]!, e[14]!], [-e[8]!, -e[9]!, -e[10]!], [group.position.x, group.position.y, group.position.z], scale);
          squeeze.uRoundAxis.value.set(shape.axis[0], shape.axis[1], shape.axis[2]);
          squeeze.uRoundK.value = shape.k;
        } else squeeze.uRoundK.value = 1;
      }
      const { pole, meridian } = info.pose ?? orientation(id, info.ms);
      {
        const east = cross(pole, meridian);
        if (look.emissive !== true && detail !== undefined) {
          // a body big enough in the view, seen by a camera we were told of, is worked out for a window of finer map; any other keeps the pictures it has
          if (info.view === undefined || mesh.material !== paintedMaterial || info.radiusPx * ratio < TILES_FROM_PX) detail.rest();
          else detail.follow(seenRegion(sightOf(T, info.view), { centre: [group.position.x, group.position.y, group.position.z], radius: scale, axes: { east, pole, meridian, scale: [scaleX, scaleY, scaleZ] } }));
        }
        writeBasis(mesh.matrix, east, pole, meridian, scaleX, scaleY, scaleZ);
        if (ringMesh !== undefined) writeBasis(ringMesh.matrix, meridian, east, pole);
        poleVec.set(pole[0], pole[1], pole[2]);
      }
      const occluders = info.occluders ?? [];
      const shaded = Math.min(6, occluders.length);
      const seconds = info.seconds ?? 0;
      const variable = look.glow?.variable;
      const pulse = variable === undefined ? 1 : starBrightness(variable.periodDays, variable.amplitude, seconds);
      if (glowMesh !== undefined && look.glow !== undefined) {
        const inView = (axis: Vec3): Vec3 => {
          glowAxis.set(...axis);
          if (info.view !== undefined) glowAxis.transformDirection(info.view.camera.matrixWorldInverse);
          return [glowAxis.x, glowAxis.y, glowAxis.z];
        };
        const viewPole = inView(pole);
        const viewMeridian = inView(meridian);
        const { b, angle } = silhouette({ pole: viewPole, meridian: viewMeridian, light: info.toSun }, facts.flattening);
        const rotation = (-angle * Math.PI) / 180;
        if (info.view === undefined) glowMesh.rotation.set(0, 0, rotation);
        else glowMesh.rotateZ(rotation);
        glowMesh.scale.set(1, b, 1);
        const frame = prominenceFrame(viewPole, viewMeridian, rotation);
        const u = glowMesh.material.uniforms;
        u.uTime!.value = seconds;
        u.uPulse!.value = pulse;
        u.uSpin!.value = frame.spin;
        u.uPole!.value = frame.pole;
        u.uTilt!.value = frame.tilt;
      }
      for (const m of materials) {
        if (star !== undefined) {
          m.uniforms.uTime!.value = seconds;
          m.uniforms.uPulse!.value = pulse;
        }
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
      if (label !== undefined) {
        // a lumpy shape stands out past the sphere the name is written on: the shell clears its highest point
        labelReport.shell = shapeReach((mesh as unknown as THREE.Mesh).geometry);
        if (labelReport.shell > 1.002 || label.object.scale.x !== 1) label.object.scale.setScalar(Math.max(1, labelReport.shell));
        label.update(info.view?.camera, info.radiusPx, info.toSun);
        const inner = label.object.children[0] as THREE.Object3D | undefined;
        labelShown = inner !== undefined && inner.visible;
        labelReport.shown = labelShown;
        labelReport.text = labelText;
        labelReport.turn = inner?.rotation.y ?? 0;
      }
    },
    dispose() {
      gone = true;
      drop?.();
      setLabel(null);
      if (windowUniforms !== undefined) {
        windowUniforms.uDetailOn!.value = 0;
        windowUniforms.uDetail!.value = null;
      }
      detail?.dispose();
      small?.dispose();
      sharp?.dispose();
      ringTexture?.dispose();
      const mat = craftMat;
      const map = craftMap;
      if (mat !== undefined && mat.uniforms.uMap !== undefined && mat.uniforms.uMap.value === map) mat.uniforms.uMap.value = null;
      map?.dispose();
      craftMap = undefined;
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
  /**
   * The credit for the pictures this painter is drawing, in English and Japanese, written from `PICTURE_CREDITS` and from `OWN_SOURCES`.
   * Until `make` has been called it names every surface picture the painter can draw, because it does not yet know which a page will show. After `make` it names only the bodies it has made in a look that draws the map
   * (`painted`, or a body whose look is mapped). A shaded body with no map is left out, so the Moon and Mars name no CC BY 4.0 source. While a window of finer map tiles is on a body, the `wakusei-tiles` credit is added;
   * Mercury's tiles also say that their colour is the CC BY 4.0 map.
   */
  readonly credit: { readonly en: string; readonly ja: string };
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
  // the widest pictures are not in the npm package: a page with its own textureBase has them only where it says so with farBase (no far base, and the painter stops at the package's widths)
  const far = options.farBase !== undefined ? slash(options.farBase) : options.textureBase !== undefined ? undefined : TEXTURE_FAR_BASE;
  const own = options.tiles;
  const tiles = own === "off" || own === "none" || own === "" ? undefined : own !== undefined ? slash(own) : options.textureBase !== undefined ? undefined : TILES_BASE;
  const book = options.book ?? createSourceBook({ kinds: ["tiles"] });
  let made = false;
  const live = new Set<CreditBody>();
  const creditLine = (lang: "en" | "ja"): string => {
    const ids = made ? [...live].filter((body) => body.picture).map((body) => body.id) : PICTURE_CREDITS.map((row) => row.id);
    const parts = [picturesCredit(ids, lang)];
    const tiled = [...live].filter((body) => body.tiles());
    if (tiled.length > 0) {
      parts.push(OWN_BY_ID.get("wakusei-tiles")!.credit[lang]);
      if (tiled.some((body) => body.id === "mercury")) parts.push(mercuryTilesCredit(lang));
    }
    return parts.filter((part) => part !== "").join(" ");
  };
  return {
    looks: LOOKS,
    get credit() {
      return { en: creditLine("en"), ja: creditLine("ja") };
    },
    make: (three, name, context = {}) => {
      const id = idOf(name);
      made = true;
      return paint(three as PainterThree, id, context, { near, far, tiles, book, shared: options.book !== undefined }, (body) => {
        live.add(body);
        return () => live.delete(body);
      });
    },
    moons(planet, ms) {
      const radius = BODIES[idOf(planet) as HostId]?.radiusKm;
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
