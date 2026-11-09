// A body drawn with three.js through kazoku-ui's shared renderer: a sphere with the body's own surface shader (or its painted map), its rings, its glow if it is a star, and, for a
// planet's system view, its moons on their orbits. The camera is orthographic in the viewer's frame, so the picture is what the sky shows. Nothing here draws by itself: the element asks.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import type * as THREE from "three";
import type { Pose } from "../ephemeris.ts";
import { BODIES, type BodyFacts, type BodyId } from "../facts.ts";
import { silhouette } from "../pose.ts";
import { cross, type Vec3 } from "../vec.ts";
import { BALL_FRAGMENT, bodyFragment, GLOW_FRAGMENT, GLOW_VERTEX, PAINTED_SURFACE, PAINTED_SURFACE_WINDOWED, RING_FRAGMENT_DETAIL, RING_VERTEX, STAR_GLOW_FRAGMENT, VERTEX } from "./glsl.ts";
import { detailOf, lookOf, type BodyLook } from "./look.ts";
import { createDetail, type Detail, type DetailStats } from "./detail.ts";
import type { TileLevel } from "./tiles.ts";
import { fallbackLook } from "./fallback.ts";
import { writeBasis } from "./basis.ts";
import { loadImage } from "./textures.ts";
import { ringStrip } from "./rings.ts";

export { fallbackLook } from "./fallback.ts";

/** The parts of three.js the bodies use: a page may hand over a module with only these (see `setThreeLoader`). */
export type ThreeParts = Pick<
  typeof THREE,
  | "AdditiveBlending" | "BufferAttribute" | "BufferGeometry" | "ClampToEdgeWrapping" | "DataTexture" | "DoubleSide" | "Group" | "Line" | "LineBasicMaterial" | "LinearFilter" | "Mesh" | "NoColorSpace"
  | "OrthographicCamera" | "PlaneGeometry" | "RepeatWrapping" | "RGBAFormat" | "RingGeometry" | "Scene" | "ShaderMaterial" | "SphereGeometry" | "TextureLoader" | "Vector2" | "Vector3" | "WebGLRenderer"
>;

/** One moon in a system view: its place in planet radii (viewer's frame) and the points of its orbit, if they changed. */
export interface MoonDraw {
  id: BodyId;
  x: number;
  y: number;
  z: number;
  /** The orbit as x, y, z triples in planet radii. A new array replaces the old line. */
  orbit?: Float32Array;
}

/** Everything that changes how the scene looks. The element fills one in and hands it over; the scene holds no clock of its own. */
export interface SceneState {
  pose: Pose;
  /** Body radii from the middle to the edge of the picture, at zoom 1. */
  extent: number;
  zoom: number;
  panX: number;
  panY: number;
  moons?: readonly MoonDraw[];
  /** The body is drawn as the sky shows it at a date: its real phase, with no light on the night side from a wrapped terminator or a rim of air. */
  sky?: boolean;
  /** The smallest a moon is drawn, in CSS pixels across its radius. Default 2.5. */
  minMoonPx?: number;
  /** The colour of the orbit lines, `#rrggbb`. */
  orbitColour?: string;
}

/** The scene the shared renderer draws, with the one call that moves it. */
export interface BodyScene extends Scene3D {
  apply(state: SceneState): void;
  /** What the scene is drawing now: the texture width in use, or 0 for the shader. */
  readonly textureWidth: number;
  readonly painted: boolean;
  /** The window of finer map on the body, or `undefined` for a body with none (a glowing one, or one with no painted map). */
  readonly detail: DetailStats | undefined;
}

export interface BodyItemOptions {
  id: BodyId;
  /** The look to draw instead of the one registered for `id`: a star made from numbers (`starLook`). */
  shaded?: BodyLook;
  /** The facts to draw instead of the table's for `id` (a star's size and flattening). */
  facts?: BodyFacts;
  /** What the renderer keeps this body's materials under, instead of `id`: a star's key, so two stars do not share a program. */
  assetKey?: string;
  look: "realistic" | "painted";
  /** A key that changes whenever the picture would: the renderer keeps one still for each key. */
  key: string;
  state(): SceneState;
  /** Where the pictures are: a folder address that ends in a slash. */
  textureBase(): string;
  /** Where the widths from `painted.far` up are: a folder address that ends in a slash. */
  farBase(): string;
  /** The widest texture worth fetching for a disc this many CSS pixels across (the element's call). */
  wantedWidth(discPx: number): number;
  /** The scene asks for a redraw when a sharper picture arrives. */
  redraw(): void;
  /** The scene tells the element which way it drew (the look can fall back to the shader). */
  report?(note: { painted: boolean; width: number; failed?: boolean }): void;
  /** Finer map tiles for a close zoom (see `scene/detail.ts`): where they are (`undefined` for none), the pixel ratio, whether this device may use them, and what to do when the tile set's levels for the body are known. */
  tiles?: { base(): string | undefined; ratio(): number; allowed(): boolean; onLevels?(levels: readonly TileLevel[] | undefined): void };
}

function makeBodyMaterial(T: ThreeParts, look: BodyLook, painted: boolean): THREE.ShaderMaterial {
  const a = look.atmosphere;
  // a glowing body (the Sun, a star) is drawn as it always was: no window of finer map and no generic detail
  const generic = look.emissive !== true;
  const fine = detailOf(look);
  return new T.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: bodyFragment(painted ? (generic ? PAINTED_SURFACE_WINDOWED : PAINTED_SURFACE) : look.surface, painted, false, look.limbTint, generic),
    uniforms: {
      ...(generic
        ? {
            uTexel: { value: painted ? (2 * Math.PI) / (look.painted?.widths[0] ?? 2048) : 0.005 },
            uDetailAmp: { value: fine.amount },
            uDetailStretch: { value: fine.stretch },
            ...(painted ? { uDetail: { value: null }, uDetailRect: { value: [0, 1, 1, 1] }, uDetailFade: { value: new T.Vector2(0, 0) }, uDetailOn: { value: 0 }, uDetailTexel: { value: 0.003 } } : {}),
          }
        : {}),
      uLight: { value: new T.Vector3(-0.6, 0.2, 0.77) },
      uRelief: { value: (painted ? (look.painted?.relief ?? 0) : (look.relief ?? 0.6)) },
      uAmbient: { value: look.ambient ?? 0.04 },
      uLimb: { value: look.limb ?? 0 },
      uWrap: { value: look.wrap ?? (a === undefined ? 0.04 : 0.3) },
      uAtmos: { value: new T.Vector3(...(a?.colour ?? [0, 0, 0])) },
      uAtmosPow: { value: a?.power ?? 3 },
      uRimBase: { value: 0.12 },
      uEmissive: { value: look.emissive === true ? 1 : 0 },
      uTime: { value: 0 },
      ...(painted ? { uMark: { value: look.painted?.turn === "hexagon" ? 2 : look.painted?.turn === "bands" ? 1 : 0 } } : {}),
      uRingN: { value: new T.Vector3(0, 1, 0) },
      uRingR: { value: new T.Vector2(1, 2) },
      uRingOn: { value: 0 },
      uRingTex: { value: null },
      uMap: { value: null },
    },
  });
}

/** Set an object's matrix from three axes (columns), without letting three.js overwrite it. */
function setBasis(object: THREE.Object3D, x: Vec3, y: Vec3, z: Vec3, sx = 1, sy = 1, sz = 1): void {
  object.matrixAutoUpdate = false;
  object.matrixWorldAutoUpdate = false;
  object.matrixWorld.copy(writeBasis(object.matrix, x, y, z, sx, sy, sz));
}

/**
 * The shared-renderer item for a body: what `renderer.view(host, item)` shows. `state()` is read when the scene is built and `apply` moves it afterwards.
 *
 * @param T - The three.js module (the element passes the page's own).
 * @param options - The body, the look, the key and the callbacks.
 * @returns The item for kazoku-ui's shared renderer.
 */
export function createBodyItem(options: BodyItemOptions): Item3D<ThreeParts> {
  const facts = options.facts ?? BODIES[options.id];
  const held = options.assetKey ?? options.id;
  return {
    key: options.key,
    async build({ three: T, assets, width, height }: BuildContext<ThreeParts>): Promise<BodyScene> {
      const look = options.shaded ?? lookOf(options.id) ?? fallbackLook(facts);
      const wantPainted = (options.look === "painted" || look.mapped === true) && look.painted !== undefined;
      const geometry = assets.acquire("wk:sphere", () => new T.SphereGeometry(1, 192, 96), (g) => g.dispose());
      const shader = assets.acquire(`wk:body:${held}:r`, () => makeBodyMaterial(T, look, false), (m) => m.dispose());
      const paintedMaterial = wantPainted ? assets.acquire(`wk:body:${held}:p`, () => makeBodyMaterial(T, look, true), (m) => m.dispose()) : undefined;

      const materials = paintedMaterial === undefined ? [shader] : [shader, paintedMaterial];
      const baseWrap = look.wrap ?? (look.atmosphere === undefined ? 0.04 : 0.3);
      const baseAmbient = look.ambient ?? 0.04;
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
      camera.position.set(0, 0, 200);
      const mesh = new T.Mesh(geometry, shader);
      mesh.frustumCulled = false;
      scene.add(mesh);

      // rings: a picture of them when the look has one (painted), else the table's strip
      const table = ringStrip(facts, 1024);
      const photo = wantPainted && table !== null ? look.painted?.rings : undefined;
      let photoTexture: THREE.Texture | undefined;
      if (photo !== undefined) {
        try {
          photoTexture = await loadImage(T, `${options.textureBase()}${photo.map}-${photo.width}.webp`);
        } catch {
          photoTexture = undefined;
        }
      }
      const ringInner = photo !== undefined && photoTexture !== undefined ? photo.from / facts.radiusKm : (table?.inner ?? 1);
      const ringOuter = photo !== undefined && photoTexture !== undefined ? photo.to / facts.radiusKm : (table?.outer ?? 2);
      const ringKey = photoTexture !== undefined ? `${options.id}:p` : options.id;
      // Two halves. The near one is drawn over the disc; the far one is tested against it, so it goes behind.
      let ringHalves: { mesh: THREE.Mesh; material: THREE.ShaderMaterial }[] | undefined;
      let ringTexture: THREE.Texture | undefined;
      if (table !== null && look.emissive !== true) {
        ringTexture = assets.acquire(`wk:ringtex:${ringKey}`, () => {
          if (photoTexture !== undefined) {
            photoTexture.magFilter = T.LinearFilter;
            photoTexture.minFilter = T.LinearFilter;
            photoTexture.generateMipmaps = false;
            photoTexture.wrapS = T.ClampToEdgeWrapping;
            photoTexture.colorSpace = T.NoColorSpace;
            return photoTexture;
          }
          const tex = new T.DataTexture(table.data, table.width, 1, T.RGBAFormat);
          tex.magFilter = T.LinearFilter;
          tex.minFilter = T.LinearFilter;
          tex.wrapS = T.ClampToEdgeWrapping;
          tex.needsUpdate = true;
          return tex;
        }, (t) => t.dispose());
        if (photoTexture !== undefined && ringTexture !== photoTexture) photoTexture.dispose();
        const ringMaterial = (key: string, depthTest: boolean) => assets.acquire(`wk:ringmat:${ringKey}:${key}`, () => new T.ShaderMaterial({
          vertexShader: RING_VERTEX,
          fragmentShader: RING_FRAGMENT_DETAIL,
          side: T.DoubleSide,
          transparent: true,
          premultipliedAlpha: photoTexture === undefined,
          depthWrite: false,
          depthTest,
          uniforms: { uRingTex: { value: ringTexture }, uRingR: { value: new T.Vector2(ringInner, ringOuter) }, uLight: { value: new T.Vector3(0, 0, 1) }, uRingN: { value: new T.Vector3(0, 1, 0) }, uRingTexel: { value: 1 / (photoTexture !== undefined ? photo!.width : table.width) } },
        }), (m) => m.dispose());
        // 0..pi is the +Y half. The basis maps local +Y onto +east.
        const half = (key: string, depthTest: boolean) => {
          const geometry = assets.acquire(`wk:ring:${ringKey}:${key}`, () => new T.RingGeometry(ringInner, ringOuter, 128, 1, 0, Math.PI), (g) => g.dispose());
          const material = ringMaterial(key, depthTest);
          const piece = new T.Mesh(geometry, material);
          piece.frustumCulled = false;
          piece.renderOrder = depthTest ? 1 : 2;
          scene.add(piece);
          return { mesh: piece, material };
        };
        ringHalves = [half("e", false), half("w", true)];
      }

      // the glow of a star
      let glow: THREE.Mesh | undefined;
      let glowMaterialOf: THREE.ShaderMaterial | undefined;
      if (look.emissive === true) {
        const glowGeometry = assets.acquire("wk:glow", () => new T.PlaneGeometry(6, 6), (g) => g.dispose());
        const own = look.glow;
        const glowMaterial = own === undefined
          ? assets.acquire("wk:glowmat", () => new T.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColour: { value: new T.Vector3(1, 0.7, 0.3) } } }), (m) => m.dispose())
          : assets.acquire(`wk:glowmat:${held}`, () => new T.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: STAR_GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColour: { value: new T.Vector3(...own.colour) }, uStrength: { value: own.strength }, uSpread: { value: own.spread }, uRim: { value: own.rim ?? 0 }, uProm: { value: own.prominence ?? 0 }, uSeed: { value: own.seed ?? 0 }, uTime: { value: 0 } } }), (m) => m.dispose());
        glow = new T.Mesh(glowGeometry, glowMaterial);
        glow.position.z = -5;
        glow.scale.setScalar(1);
        glow.frustumCulled = false;
        glowMaterialOf = glowMaterial;
        scene.add(glow);
      }

      // moons, made on first use
      const moonMeshes = new Map<BodyId, THREE.Mesh>();
      const orbitLines = new Map<BodyId, { line: THREE.Line; source: Float32Array }>();
      const orbitMaterial = new T.LineBasicMaterial({ color: 0x8fa1b8, transparent: true, opacity: 0.4 });
      let viewWidth = width;
      let viewHeight = height;
      let aspect = viewWidth / Math.max(1, viewHeight);

      // the picture
      let textureWidth = 0;
      let loading = false;
      let failed = false;
      let gone = false;
      const tried = new Set<number>();
      let latest: SceneState = options.state();

      const loadTexture = (w: number): Promise<THREE.Texture> => {
        const far = look.painted!.far !== undefined && w >= look.painted!.far;
        return loadImage(T, `${far ? options.farBase() : options.textureBase()}${look.painted!.map}-${w}.webp`);
      };
      const drop = (t: THREE.Texture): void => {
        t.dispose();
        t.image = null;
      };
      const use = (t: THREE.Texture, w: number): void => {
        if (gone) {
          drop(t);
          return;
        }
        t.anisotropy = 4;
        t.wrapS = T.RepeatWrapping;
        t.colorSpace = T.NoColorSpace;
        const shared = assets.acquire(`wk:map:${options.id}:${w}`, () => t, (tex) => drop(tex));
        if (shared !== t) drop(t);
        textureWidth = w;
        paintedMaterial!.uniforms.uMap!.value = shared;
        if (paintedMaterial!.uniforms.uTexel !== undefined) paintedMaterial!.uniforms.uTexel.value = (2 * Math.PI) / w;
        mesh.material = paintedMaterial!;
        options.report?.({ painted: true, width: w });
      };
      const fail = (): void => {
        failed = true;
        mesh.material = shader;
        textureWidth = 0;
        options.report?.({ painted: false, width: 0, failed: true });
      };
      // the window of finer map for a close zoom, laid over the painted map by the painted material
      const windowUniforms = wantPainted && paintedMaterial !== undefined && look.emissive !== true && options.tiles !== undefined && look.painted !== undefined ? paintedMaterial.uniforms : undefined;
      const detail: Detail | undefined =
        windowUniforms === undefined || options.tiles === undefined
          ? undefined
          : createDetail(T, {
              base: () => options.tiles!.base(),
              body: look.painted!.map,
              ratio: () => options.tiles!.ratio(),
              allowed: () => options.tiles!.allowed(),
              redraw: () => options.redraw(),
              ...(options.tiles.onLevels === undefined ? {} : { onLevels: (levels: readonly TileLevel[] | undefined) => options.tiles!.onLevels!(levels) }),
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
      if (wantPainted && paintedMaterial !== undefined) {
        const widths = look.painted!.widths;
        try {
          use(await loadTexture(widths[0]!), widths[0]!);
        } catch {
          fail();
        }
      } else {
        options.report?.({ painted: false, width: 0 });
      }

      const orient = (state: SceneState): void => {
        const { pole, meridian } = state.pose;
        const east = cross(pole, meridian);
        const ax = facts.axesKm;
        const mean = facts.radiusKm;
        const scaleX = ax ? ax[1] / mean : 1;
        const scaleY = ax ? ax[2] / mean : 1 - facts.flattening;
        const scaleZ = ax ? ax[0] / mean : 1;
        setBasis(mesh, east, pole, meridian, scaleX, scaleY, scaleZ);
        if (ringHalves !== undefined) {
          const [near, far] = ringHalves;
          // The camera sits on +Z. The ring's near direction is +Z laid onto the ring plane, and that half is drawn over the disc.
          const zx = meridian[2];
          const zy = east[2];
          const span = Math.hypot(zx, zy) || 1;
          const toward: Vec3 = [(meridian[0] * zx + east[0] * zy) / span, (meridian[1] * zx + east[1] * zy) / span, (meridian[2] * zx + east[2] * zy) / span];
          const across = cross(toward, pole);
          setBasis(near.mesh, across, toward, pole);
          setBasis(far.mesh, [-across[0], -across[1], -across[2]], [-toward[0], -toward[1], -toward[2]], pole);
        }
      };

      const frame = (state: SceneState): void => {
        const half = state.extent / Math.max(0.05, state.zoom);
        const halfW = aspect >= 1 ? half * aspect : half;
        const halfH = aspect >= 1 ? half : half / aspect;
        // the pan is in units of the short side's half (what the element divides the pixels by), so a wide or tall view moves by the pixels asked
        const cx = state.panX * half;
        const cy = state.panY * half;
        camera.left = cx - halfW;
        camera.right = cx + halfW;
        camera.top = cy + halfH;
        camera.bottom = cy - halfH;
        camera.updateProjectionMatrix();
      };

      const moonFor = (id: BodyId): THREE.Mesh => {
        let m = moonMeshes.get(id);
        if (m !== undefined) return m;
        const f = BODIES[id];
        const c = [1, 3, 5].map((i) => parseInt(f.colour.slice(i, i + 2), 16) / 255);
        const material = assets.acquire(`wk:ball:${id}`, () => new T.ShaderMaterial({ vertexShader: VERTEX, fragmentShader: BALL_FRAGMENT, uniforms: { uLight: { value: new T.Vector3(0, 0, 1) }, uColour: { value: new T.Vector3(c[0], c[1], c[2]) } } }), (x) => x.dispose());
        m = new T.Mesh(geometry, material);
        m.frustumCulled = false;
        moonMeshes.set(id, m);
        scene.add(m);
        return m;
      };

      const place = (state: SceneState): void => {
        const moons = state.moons ?? [];
        const half = state.extent / Math.max(0.05, state.zoom);
        const unitsPerPx = (2 * half) / Math.max(1, aspect >= 1 ? viewHeight : viewWidth);
        const minR = (state.minMoonPx ?? 2.5) * unitsPerPx;
        const live = new Set(moons.map((m) => m.id));
        for (const [id, m] of moonMeshes) if (!live.has(id)) { scene.remove(m); moonMeshes.delete(id); }
        for (const [id, o] of orbitLines) if (!live.has(id)) { scene.remove(o.line); o.line.geometry.dispose(); orbitLines.delete(id); }
        for (const moon of moons) {
          const f = BODIES[moon.id];
          const mesh2 = moonFor(moon.id);
          const r = Math.max(f.radiusKm / facts.radiusKm, minR);
          mesh2.position.set(moon.x, moon.y, moon.z);
          mesh2.scale.setScalar(r);
          mesh2.updateMatrix();
          mesh2.updateMatrixWorld(true);
          const mat = mesh2.material as THREE.ShaderMaterial;
          (mat.uniforms.uLight!.value as THREE.Vector3).set(...state.pose.light);
          if (moon.orbit !== undefined) {
            const held = orbitLines.get(moon.id);
            if (held === undefined || held.source !== moon.orbit) {
              if (held !== undefined) { scene.remove(held.line); held.line.geometry.dispose(); }
              const g = new T.BufferGeometry();
              g.setAttribute("position", new T.BufferAttribute(moon.orbit, 3));
              const line = new T.Line(g, orbitMaterial);
              line.frustumCulled = false;
              scene.add(line);
              orbitLines.set(moon.id, { line, source: moon.orbit });
            }
          }
        }
        if (state.orbitColour !== undefined) orbitMaterial.color.set(state.orbitColour);
      };

      const requestSharperTexture = (state: SceneState): void => {
        // a sharper picture, when the disc is big enough to show it
        if (wantPainted && !failed && !loading && look.painted !== undefined) {
          const discPx = (aspect >= 1 ? viewHeight : viewWidth) * (state.zoom / state.extent);
          const wanted = options.wantedWidth(discPx);
          const next = look.painted.widths.find((w) => w >= wanted) ?? look.painted.widths[look.painted.widths.length - 1]!;
          if (next > textureWidth && !tried.has(next)) {
            tried.add(next);
            loading = true;
            void loadTexture(next).then(
              (t) => {
                loading = false;
                if (gone) {
                  drop(t);
                  return;
                }
                use(t, next);
                options.redraw();
              },
              () => {
                loading = false;
              },
            );
          }
        }
      };

      const light = new T.Vector3();
      const pole = new T.Vector3();
      const apply = (state: SceneState): void => {
        latest = state;
        orient(state);
        frame(state);
        place(state);
        light.set(...state.pose.light);
        if (ringHalves !== undefined) {
          pole.set(...state.pose.pole);
          for (const piece of ringHalves) {
            piece.material.uniforms.uLight!.value.copy(light);
            piece.material.uniforms.uRingN!.value.copy(pole);
          }
          for (const mat of materials) {
            mat.uniforms.uRingOn!.value = 1;
            mat.uniforms.uRingN!.value.copy(pole);
            mat.uniforms.uRingR!.value.set(ringInner, ringOuter);
            mat.uniforms.uRingTex!.value = ringTexture;
          }
        }
        const sky = state.sky === true;
        for (const mat of materials) {
          mat.uniforms.uLight!.value.copy(light);
          mat.uniforms.uWrap!.value = sky ? 0.02 : baseWrap;
          mat.uniforms.uAmbient!.value = sky ? 0.012 : baseAmbient;
          mat.uniforms.uRimBase!.value = sky ? 0.02 : 0.12;
        }
        if (look.glow !== undefined) {
          // the star's surface boils and its prominences move with the clock, but only when a frame is asked for: a star at rest draws nothing
          const seconds = (performance.now() / 1000) % 100_000;
          for (const mat of materials) mat.uniforms.uTime!.value = seconds;
          if (glowMaterialOf !== undefined) glowMaterialOf.uniforms.uTime!.value = seconds;
        }
        if (glow !== undefined) {
          // a flattened star is squeezed along its pole: the glow starts at its edge, not at a round one
          if (look.glow !== undefined && facts.flattening > 0) {
            const { b, angle } = silhouette(state.pose, facts.flattening);
            glow.rotation.z = (-angle * Math.PI) / 180;
            glow.scale.set(1, b, 1);
          } else glow.scale.setScalar(1);
        }
        requestSharperTexture(state);
        if (detail !== undefined && textureWidth > 0) {
          const east = cross(state.pose.pole, state.pose.meridian);
          const ax = facts.axesKm;
          const mean = facts.radiusKm;
          detail.sync(
            { left: camera.left, right: camera.right, bottom: camera.bottom, top: camera.top },
            { east, pole: state.pose.pole, meridian: state.pose.meridian, scale: [ax ? ax[1] / mean : 1, ax ? ax[2] / mean : 1 - facts.flattening, ax ? ax[0] / mean : 1] },
            viewWidth,
          );
        }
      };

      apply(latest);

      return {
        scene,
        camera,
        apply,
        get textureWidth() {
          return textureWidth;
        },
        get painted() {
          return textureWidth > 0;
        },
        get detail() {
          return detail?.stats;
        },
        resize(w: number, h: number) {
          viewWidth = w;
          viewHeight = h;
          aspect = viewWidth / Math.max(1, viewHeight);
          frame(latest);
          place(latest);
        },
        update() {
          return false;
        },
        dispose() {
          gone = true;
          if (windowUniforms !== undefined) {
            windowUniforms.uDetailOn!.value = 0;
            windowUniforms.uDetail!.value = null;
          }
          detail?.dispose();
          for (const o of orbitLines.values()) o.line.geometry.dispose();
          orbitMaterial.dispose();
          scene.clear();
        },
      };
    },
  };
}
