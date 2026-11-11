// The bodies as objects for someone else's three.js scene: a radius-1 `Object3D` for the Sun, a planet, Pluto or a moon, in the realistic or the painted look, lit in the scene's own axes so a
// perspective camera can look at it from anywhere. It is made for chikyu-earth's space view (its `BodyPainter` seam) and holds nothing of its own: no renderer, no loop, no clock.
// The caller places, sizes and lights the object and calls `update` when something changed; a picture that arrives later asks for a redraw through `context.invalidate`.
import type * as THREE from "three";
import "../bodies/all.ts";
import { BODIES, MOONS_OF, type BodyId, type MoonId, type HostId } from "../facts.ts";
import { writeBasis } from "./basis.ts";
import { TEXTURE_BASE, TEXTURE_FAR_BASE, TILES_BASE, slash, loadImage, mapSourceFor, tilesAllowed } from "./textures.ts";
import { createSourceBook, type SourceBook } from "../door/book.ts";
import { cross, type Vec3 } from "../vec.ts";
import type { ThreeParts } from "./body.ts";
import { bodyFragment, GLOW_FRAGMENT, GLOW_VERTEX, PAINTED_SURFACE, PAINTED_SURFACE_WINDOWED, RING_FRAGMENT_WORLD, RING_VERTEX_WORLD, VERTEX_WORLD } from "./glsl.ts";
import { fallbackLook } from "./fallback.ts";
import { createDetail, type Detail, type DetailStats } from "./detail.ts";
import { detailOf, lookOf } from "./look.ts";
import { seenRegion, type Sight, type TileLevel } from "./tiles.ts";
import { moonOffset, orientation } from "./orient.ts";
import { ringStrip } from "./rings.ts";
import { createNameLabel, nameLabelText, type NameLabel, type NameLabelOptions } from "./name-label.ts";

export { moonOffset, orientation };
export { nameLabelText, readNameLabel, setBodyLabelFontUrl, type NameLabelOptions } from "./name-label.ts";

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
  /** The pole and the prime meridian to draw instead of the body's real ones at `ms` (a portrait's own pose), in the scene's axes. */
  pose?: { pole: Vec3; meridian: Vec3 };
  /** Spheres that may shade this body from the Sun: x, y, z (from this body's centre) and radius, all in this body's radii, in the scene's axes. At most six are used. */
  occluders?: readonly (readonly [number, number, number, number])[];
  /** The camera, so that a body big in the view gets finer map tiles for the part in view (see `PaintView`). Left out, none are used. */
  view?: PaintView;
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
  /** The name on the globe now: whether one is drawn (made and big enough on the screen at the last `update`), the text, and the group's turn about the pole in radians (for `facing`). */
  readonly label: { shown: boolean; text: string; turn: number } | null;
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

function paint(T: PainterThree, id: BodyId, context: PaintContext, bases: { near: string; far: string; tiles: string | undefined; book: SourceBook; shared: boolean }): Painting {
  const facts = BODIES[id];
  const look = lookOf(id) ?? fallbackLook(facts);
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
  const uniforms = (painted: boolean): Record<string, THREE.IUniform> => {
    const a = look.atmosphere;
    return {
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
    const m = new T.ShaderMaterial({ vertexShader: VERTEX_WORLD, fragmentShader: bodyFragment(painted ? (generic ? PAINTED_SURFACE_WINDOWED : PAINTED_SURFACE) : look.surface, painted, true, undefined, generic), uniforms: uniforms(painted) });
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
      uniforms: { uRingTex: { value: strip }, uRingR: { value: new T.Vector2(ringInner, ringOuter) }, uLight: { value: new T.Vector3(1, 0, 0) }, uRingN: { value: new T.Vector3(0, 1, 0) }, uScale: { value: 1 } },
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
          ringMesh!.geometry.dispose();
          ringMesh!.geometry = new T.RingGeometry(ringInner, ringOuter, 256, 1);
          disposables.push(ringMesh!.geometry);
          ringMaterial!.premultipliedAlpha = false;
          ringMaterial!.needsUpdate = true;
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

  // the glow of a star: a plane through its centre that `update` turns to the camera, so the globe inside it keeps its own orientation
  let glowMesh: THREE.Mesh | undefined;
  if (look.emissive === true) {
    const glowGeometry = acquire(T, "glow", () => new T.PlaneGeometry(6, 6));
    releases.push(glowGeometry.release);
    const glowMaterial = new T.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColour: { value: new T.Vector3(1, 0.7, 0.3) } } });
    disposables.push(glowMaterial);
    const glow = new T.Mesh(glowGeometry.value, glowMaterial);
    glow.renderOrder = 4;
    glow.frustumCulled = false;
    group.add(glow);
    glowMesh = glow;
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
  const show = (t: THREE.Texture, w: number): void => {
    paintedMaterial!.uniforms.uMap!.value = t;
    if (paintedMaterial!.uniforms.uTexel !== undefined) paintedMaterial!.uniforms.uTexel.value = (2 * Math.PI) / w;
    mesh.material = paintedMaterial!;
    // the shaded look was drawn only until the picture came: if it was drawn at all, its program is let go now, so what a body holds does not depend on which came first
    shader.dispose();
    redraw();
  };
  if (wantPainted && paintedMaterial !== undefined && widths[0] !== undefined) {
    void loadImage(T, urlOf(widths[0])).then(
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
      void loadImage(T, urlOf(next)).then(
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
  const scaleX = axes ? axes[1] / facts.radiusKm : 1;
  const scaleY = axes ? axes[2] / facts.radiusKm : 1 - facts.flattening;
  const scaleZ = axes ? axes[0] / facts.radiusKm : 1;
  const light = new T.Vector3();
  const poleVec = new T.Vector3();

  // the name on the globe: a child of the mesh, so it turns with the body; made when asked, drawn once its font is in
  let label: NameLabel | undefined;
  let labelText = "";
  let labelShown = false;
  const setLabel = (next: PaintLabel | null): void => {
    if (next === null || next === undefined || gone) {
      if (label !== undefined) {
        mesh.remove(label.object);
        label.dispose();
        label = undefined;
        labelShown = false;
      }
      return;
    }
    const { lang, text, ...options } = next;
    labelText = text ?? nameLabelText(facts.name, lang ?? "en");
    if (label === undefined) {
      label = createNameLabel(T, labelText, options, look.emissive === true, redraw);
      mesh.add(label.object);
    } else {
      label.set(labelText, options);
      redraw();
    }
  };
  if (context.label) setLabel(context.label);

  return {
    object: group,
    setLabel,
    get label() {
      return label === undefined ? null : { shown: labelShown, text: labelText, turn: label.object.children[0] !== undefined ? (label.object.children[0] as THREE.Object3D).rotation.y : 0 };
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
      {
        const { pole, meridian } = info.pose ?? orientation(id, info.ms);
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
      if (label !== undefined) {
        label.update(info.view?.camera, info.radiusPx, info.toSun);
        labelShown = label.object.children[0] !== undefined && (label.object.children[0] as THREE.Object3D).visible;
      }
    },
    dispose() {
      gone = true;
      setLabel(null);
      if (windowUniforms !== undefined) {
        windowUniforms.uDetailOn!.value = 0;
        windowUniforms.uDetail!.value = null;
      }
      detail?.dispose();
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
  const own = options.tiles;
  const tiles = own === "off" || own === "none" || own === "" ? undefined : own !== undefined ? slash(own) : options.textureBase !== undefined ? undefined : TILES_BASE;
  const book = options.book ?? createSourceBook({ kinds: ["tiles"] });
  return {
    looks: LOOKS,
    make: (three, name, context = {}) => paint(three as PainterThree, idOf(name), context, { near, far, tiles, book, shared: options.book !== undefined }),
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
