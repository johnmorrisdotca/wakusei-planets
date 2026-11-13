// The standing view as three.js draws it through kazoku-ui's shared renderer: the ground (one mesh round the viewer's feet, shaded from the measured heights), the Sun and the Earth as discs in
// a black sky. Nothing here draws by itself: the element hands over a state and asks. Only the parts of three.js the package's other views use are needed (no camera of its own is used: the
// shaders take a view and projection matrix, so a page that hands over a subset of three.js does not have to add a perspective camera).
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { ThreeParts } from "../scene/body.ts";
import { rocksAround } from "./detail.ts";
import { DISC_FRAGMENT, DISC_VERTEX, GROUND_FRAGMENT, GROUND_VERTEX, ROCK_FRAGMENT, ROCK_VERTEX, SHADOW_FRAGMENT, SHADOW_VERTEX, TRACK_FRAGMENT, TRACK_VERTEX } from "./glsl.ts";
import { KEEP_OUT, objectParts, partShadows, type Part, type SiteObject } from "./objects.ts";
import type { HeightLevel, TerrainManifest } from "./height.ts";
import type { MoonSky } from "./sky.ts";
import { rockMesh } from "./rocks.ts";
import { cameraAxes, viewProjection, type Look } from "./view.ts";

/** Everything that changes how the view looks. The element fills one in and hands it over; the scene holds no clock of its own. */
export interface SurfaceState {
  /** The eyes: metres east and north of the site, and metres over the site's ground (the site's own height is the origin). */
  eye: { east: number; north: number; up: number };
  look: Look;
  sky: MoonSky;
  /** Brightness: the sunlit ground of an albedo of 0.14 comes out as this share of white times the Sun's height factor (default 4.5). */
  exposure?: number;
  /** The ground's own brightness, 0 to 1 (default 0.14, a grey a little lighter than the Moon's mean). */
  albedo?: number;
  /** Whether the ground shadows itself (default true; false is a try-out, a lit slope with no shadow). */
  shadows?: boolean;
  /** Whether the made detail (craters, roughness) is there (default true). */
  detail?: boolean;
  /** How much the draw spends on shadows: `full` (the default), `medium` or `fast` (the near march shortened, the made craters left out of it): a draw while the view moves is `fast`. */
  quality?: "full" | "medium" | "fast";
  /** The share of the canvas's width and height the ground is drawn at, 1 (the default) to 0.25: below 1 it is drawn to a smaller target and stretched, which is what a draw while the view moves does on a machine that is slow. It needs `WebGLRenderTarget` in the three.js module (a page's own cut-down module may not have it; the draw is then at full size). */
  scale?: number;
  /** Whether the things at the site (the lander, the rover, the flag, the station) and the rover's tracks are drawn (default true; the made ground keeps away from them while they are). */
  objects?: boolean;
  /** Time the next draw to the end of the graphics queue (it waits for the card, so it is for a few draws, not every one). */
  measure?: boolean;
}

/** The scene the shared renderer draws, with the one call that moves it. */
export interface SurfaceScene extends Scene3D {
  apply(state: SurfaceState): void;
  /** Send what changed to the card: the names of the levels (`h5`), picture levels (`a5`) and horizon maps (`horizon:h5`) whose bytes have changed since. The rocks are made again on the next `apply`. */
  refresh(ids: Iterable<string>): void;
  /** The rocks made round the eyes now. */
  readonly rocks: number;
  /** How long the last measured draw took, in milliseconds, the card finished (asked for with `measure` in the state: a pixel is read back to wait for the card), or `undefined` before one. */
  readonly drawMs: number | undefined;
  /** The mesh's size, for a test or a status line. */
  readonly mesh: { rings: number; rays: number; triangles: number };
}

export interface SurfaceItemOptions {
  /** The pyramid's levels, finest first, filled with their heights. */
  levels: readonly HeightLevel[];
  /** The ground picture's levels, where the site has them. */
  pictures?: readonly HeightLevel[];
  /** The baked horizons (see the manifest's `horizon`), where the site has them. */
  horizons?: readonly { id: string; width: number; height: number; data: Uint8Array }[];
  /** The ground's height at a point, metres east and north of the site, for the rocks to stand on: the measured heights, the made craters, the Moon's curve taken off. */
  groundY?(east: number, north: number): number;
  manifest: TerrainManifest;
  /** The things at the site, at their published places, and the rover's traverses as lines (east, north, east, north, ...). */
  objects?: readonly SiteObject[];
  traverse?: readonly (readonly number[])[];
  /** A key that changes whenever the picture would: the renderer keeps one still for each key. */
  key: string;
}

const RINGS = 480;
const RAYS = 600;
const R_MIN = 0.1;
const R_MAX = 300_000;
/** The distances out to which each level is read, finest first (the coarsest reads to the end): a level's own samples are about this far from being finer than a pixel. */
const BANDS = [4_000, 16_000, 60_000, Infinity] as const;

/** The ground's mesh: rings spaced out geometrically (a share of the distance apart) and rays across the view; its positions are not positions but where to look in the polar grid. */
function groundGeometry(T: ThreeParts): { geometry: InstanceType<ThreeParts["BufferGeometry"]>; triangles: number } {
  const positions = new Float32Array((RINGS + 1) * (RAYS + 1) * 3);
  let at = 0;
  for (let i = 0; i <= RINGS; i += 1) {
    for (let j = 0; j <= RAYS; j += 1) {
      positions[at++] = i / RINGS;
      positions[at++] = (j / RAYS) * 2 - 1;
      positions[at++] = 0;
    }
  }
  const indices = new Uint32Array(RINGS * RAYS * 6);
  let k = 0;
  for (let i = 0; i < RINGS; i += 1) {
    for (let j = 0; j < RAYS; j += 1) {
      const a = i * (RAYS + 1) + j;
      const b = a + 1;
      const c = a + RAYS + 1;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  return { geometry, triangles: indices.length / 3 };
}

function squareGeometry(T: ThreeParts): InstanceType<ThreeParts["BufferGeometry"]> {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geometry.setIndex(new T.BufferAttribute(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
  return geometry;
}

/** The Moon's standing view for one site as an item of the shared renderer. */
export function createSurfaceItem(options: SurfaceItemOptions): Item3D<ThreeParts> {
  return {
    key: options.key,
    build(context: BuildContext<ThreeParts>): SurfaceScene {
      const T = context.three;
      const { manifest } = options;
      const textures = options.levels.map((level) =>
        context.assets.acquire(
          `surface:${manifest.site}:${level.id}`,
          () => {
            const texture = new T.DataTexture(level.data, level.size, level.size, T.RGBAFormat);
            texture.minFilter = 1003; // NearestFilter: the two bytes of a height must not be blended
            texture.magFilter = 1003;
            texture.wrapS = T.ClampToEdgeWrapping;
            texture.wrapT = T.ClampToEdgeWrapping;
            texture.generateMipmaps = false;
            texture.flipY = false;
            texture.needsUpdate = true;
            return texture;
          },
          (texture) => texture.dispose(),
        ),
      );
      const pictures = (options.pictures ?? []).map((level) =>
        context.assets.acquire(
          `surface:${manifest.site}:picture:${level.id}`,
          () => {
            const texture = new T.DataTexture(level.data, level.size, level.size, T.RGBAFormat);
            texture.minFilter = 1008; // LinearMipmapLinearFilter: a picture seen from far is averaged, not sparkling
            texture.magFilter = T.LinearFilter;
            texture.wrapS = T.ClampToEdgeWrapping;
            texture.wrapT = T.ClampToEdgeWrapping;
            texture.generateMipmaps = true;
            texture.flipY = false;
            texture.needsUpdate = true;
            return texture;
          },
          (texture) => texture.dispose(),
        ),
      );
      const horizons = (options.horizons ?? []).map((h) =>
        context.assets.acquire(
          `surface:${manifest.site}:horizon:${h.id}`,
          () => {
            const texture = new T.DataTexture(h.data, h.width, h.height, T.RGBAFormat);
            texture.minFilter = T.LinearFilter; // a smooth horizon between the cells; each colour is its own direction, so blending them is blending the same direction's neighbours
            texture.magFilter = T.LinearFilter;
            texture.wrapS = T.ClampToEdgeWrapping;
            texture.wrapT = T.ClampToEdgeWrapping;
            texture.generateMipmaps = false;
            texture.flipY = false;
            texture.needsUpdate = true;
            return texture;
          },
          (texture) => texture.dispose(),
        ),
      );
      const hz = manifest.horizon;
      const level = (i: number): { value: [number, number, number, number] } => {
        const l = options.levels[i]!;
        return { value: [l.half, l.res, l.size, BANDS[i] ?? Infinity] };
      };
      const maxY = Math.max(...options.levels.map((l) => (l as HeightLevel & { max?: number }).max ?? manifest.height.min + manifest.height.range)) - manifest.ground;
      const uniforms = {
        uVP: { value: new Float32Array(16) },
        uEyeEN: { value: new T.Vector2(0, 0) },
        uEye: { value: new T.Vector3(0, 1.7, 0) },
        uYaw: { value: 0 },
        uSpan: { value: 0.6 },
        uRMin: { value: R_MIN },
        uRMax: { value: R_MAX },
        uSun: { value: new T.Vector3(0, 0.5, 0.8) },
        uExposure: { value: 4.5 },
        uAlbedo: { value: 0.14 },
        uMaxY: { value: maxY },
        uEarthshine: { value: 0.05 },
        uShadows: { value: 1 },
        uHmin: { value: manifest.height.min },
        uHrange: { value: manifest.height.range },
        uFarHeight: { value: new T.Vector2(options.levels[3]?.height?.min ?? manifest.height.min, options.levels[3]?.height?.range ?? manifest.height.range) },
        uGround: { value: manifest.ground },
        uRadius: { value: manifest.radius },
        uH0: { value: textures[0] },
        uH1: { value: textures[1] ?? textures[0] },
        uH2: { value: textures[2] ?? textures[0] },
        uH3: { value: textures[3] ?? textures[0] },
        uA0: { value: pictures[0] ?? textures[0] },
        uA1: { value: pictures[1] ?? textures[0] },
        uA2: { value: pictures[2] ?? textures[0] },
        uPicture: { value: pictures.length >= 3 ? 1 : 0 },
        uZ0: { value: horizons[0] ?? textures[0] },
        uZ1: { value: horizons[1] ?? textures[0] },
        uZ2: { value: horizons[2] ?? textures[0] },
        uHzOn: { value: horizons.length >= 3 && hz !== null && hz !== undefined ? 1 : 0 },
        uHzSun: { value: new T.Vector3(0, 1, 0) },
        uHzRange: { value: new T.Vector2(hz?.from ?? -10, hz?.to ?? 60) },
        uSunDegrees: { value: 13 },
        uKeep: { value: Array.from({ length: 6 }, (_, i) => { const o = (options.objects ?? [])[i]; const k = o === undefined ? undefined : KEEP_OUT[o.kind]; return [o?.east ?? 0, o?.north ?? 0, k?.inner ?? 1, k?.outer ?? 2]; }).flat() },
        uKeepCount: { value: Math.min(6, options.objects?.length ?? 0) },
        uNear: { value: new T.Vector3(56, 80, 36) },
        uPixel: { value: 0.0024 },
        uDetail: { value: 1 },
        uL0: level(0),
        uL1: level(1),
        uL2: level(2),
        uL3: level(3),
      };
      const { geometry, triangles } = groundGeometry(T);
      const groundMaterial = new T.ShaderMaterial({ vertexShader: GROUND_VERTEX, fragmentShader: GROUND_FRAGMENT, uniforms });
      const ground = new T.Mesh(geometry as never, groundMaterial);
      ground.frustumCulled = false;
      ground.renderOrder = 0;
      const square = squareGeometry(T);
      const disc = (kind: number, half: number): { mesh: InstanceType<ThreeParts["Mesh"]>; material: InstanceType<ThreeParts["ShaderMaterial"]>; uniforms: Record<string, { value: unknown }> } => {
        const u = {
          uVP: uniforms.uVP,
          uEyeWorld: { value: new T.Vector3() },
          uDirWorld: { value: new T.Vector3(0, 1, 0) },
          uRightWorld: { value: new T.Vector3(1, 0, 0) },
          uUpWorld: { value: new T.Vector3(0, 0, -1) },
          uHalf: { value: half },
          uKind: { value: kind },
          uSunEnu: { value: new T.Vector3() },
          uDirEnu: { value: new T.Vector3() },
          uRightEnu: { value: new T.Vector3(1, 0, 0) },
          uUpEnu: { value: new T.Vector3(0, 1, 0) },
          uExposure: uniforms.uExposure,
        };
        const material = new T.ShaderMaterial({ vertexShader: DISC_VERTEX, fragmentShader: DISC_FRAGMENT, uniforms: u, depthTest: false, depthWrite: false });
        const mesh = new T.Mesh(square as never, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = -10 + kind;
        return { mesh, material, uniforms: u };
      };
      const sun = disc(0, Math.tan((0.533 * Math.PI) / 360));
      const earth = disc(1, Math.tan((1.9 * Math.PI) / 360));
      const scene = new T.Scene();
      scene.add(sun.mesh, earth.mesh, ground);
      // the rocks and their shadows, made again when the eyes have walked a while or the Sun has moved
      const rockMaterial = new T.ShaderMaterial({ vertexShader: ROCK_VERTEX, fragmentShader: ROCK_FRAGMENT, uniforms });
      const shadowMaterial = new T.ShaderMaterial({ vertexShader: SHADOW_VERTEX, fragmentShader: SHADOW_FRAGMENT, uniforms: { uVP: uniforms.uVP }, transparent: true, depthWrite: false });
      shadowMaterial.polygonOffset = true;
      shadowMaterial.polygonOffsetFactor = -2;
      shadowMaterial.polygonOffsetUnits = -2;
      let rockGeometry: InstanceType<ThreeParts["BufferGeometry"]> | undefined;
      let shadowGeometry: InstanceType<ThreeParts["BufferGeometry"]> | undefined;
      let rockMeshObject: InstanceType<ThreeParts["Mesh"]> | undefined;
      let shadowMeshObject: InstanceType<ThreeParts["Mesh"]> | undefined;
      let rockKey = "";
      let rockCount = 0;
      const makeRocks = (state: SurfaceState): void => {
        const ground = options.groundY;
        if (ground === undefined || state.detail === false) return;
        const pixel = fullPixel;
        const key = `${Math.round(state.eye.east / 8)}|${Math.round(state.eye.north / 8)}|${state.sky.sun.azimuth.toFixed(0)}|${state.sky.sun.altitude.toFixed(0)}|${pixel.toFixed(4)}`;
        if (key === rockKey) return;
        rockKey = key;
        const rocks = rocksAround(state.eye.east, state.eye.north, 55, pixel);
        const mesh = rockMesh(rocks, ground, { azimuth: state.sky.sun.azimuth, altitude: state.sky.sun.altitude });
        rockCount = mesh.count;
        rockGeometry?.dispose();
        shadowGeometry?.dispose();
        rockGeometry = new T.BufferGeometry();
        rockGeometry.setAttribute("position", new T.BufferAttribute(mesh.position, 3));
        rockGeometry.setAttribute("normal", new T.BufferAttribute(mesh.normal, 3));
        rockGeometry.setAttribute("tone", new T.BufferAttribute(mesh.tone, 1));
        shadowGeometry = new T.BufferGeometry();
        shadowGeometry.setAttribute("position", new T.BufferAttribute(mesh.shadowPosition, 3));
        shadowGeometry.setAttribute("uv", new T.BufferAttribute(mesh.shadowUv, 2));
        shadowGeometry.setIndex(new T.BufferAttribute(mesh.shadowIndex, 1));
        if (rockMeshObject === undefined) {
          rockMeshObject = new T.Mesh(rockGeometry as never, rockMaterial);
          rockMeshObject.frustumCulled = false;
          rockMeshObject.renderOrder = 1;
          shadowMeshObject = new T.Mesh(shadowGeometry as never, shadowMaterial);
          shadowMeshObject.frustumCulled = false;
          shadowMeshObject.renderOrder = 2;
          scene.add(rockMeshObject, shadowMeshObject);
        } else {
          rockMeshObject.geometry = rockGeometry as never;
          shadowMeshObject!.geometry = shadowGeometry as never;
        }
      };
      // the things at the site: their parts as one mesh (the rocks' shader and light), their shadows (the rocks' shadow material) and the rover's traverse as a strip along the line. The parts are built where the ground
      // is (from the callback), so they are made again when the ground has changed or the Sun has moved.
      const objectMaterial = rockMaterial;
      let objectMesh: InstanceType<ThreeParts["Mesh"]> | undefined;
      let objectShadowMesh: InstanceType<ThreeParts["Mesh"]> | undefined;
      let objectKey = "";
      const makeObjects = (state: SurfaceState): void => {
        const list = options.objects ?? [];
        const ground = options.groundY;
        const on = state.objects !== false && list.length > 0 && ground !== undefined;
        if (objectMesh !== undefined) objectMesh.visible = on;
        if (objectShadowMesh !== undefined) objectShadowMesh.visible = on;
        if (trackMesh !== undefined) trackMesh.visible = on;
        if (!on || ground === undefined) return;
        const key = `${state.sky.sun.azimuth.toFixed(1)}|${state.sky.sun.altitude.toFixed(1)}|${objectVersion}`;
        if (key === objectKey) return;
        objectKey = key;
        const position: number[] = [];
        const normal: number[] = [];
        const tone: number[] = [];
        const shadow: number[] = [];
        for (const object of list) {
          const base = ground(object.east, object.north);
          const parts: Part[] = objectParts(object, base);
          for (const part of parts) {
            position.push(...part.position);
            normal.push(...part.normal);
            for (let i = 0; i < part.position.length / 3; i += 1) tone.push(part.tone);
          }
          shadow.push(...partShadows(parts, base, state.sky.sun.azimuth, state.sky.sun.altitude));
        }
        const geometry = new T.BufferGeometry();
        geometry.setAttribute("position", new T.BufferAttribute(new Float32Array(position), 3));
        geometry.setAttribute("normal", new T.BufferAttribute(new Float32Array(normal), 3));
        geometry.setAttribute("tone", new T.BufferAttribute(new Float32Array(tone), 1));
        const shadowGeometry = new T.BufferGeometry();
        shadowGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(shadow), 3));
        shadowGeometry.setAttribute("uv", new T.BufferAttribute(new Float32Array((shadow.length / 3) * 2).fill(0.5).map((v, i) => (i % 2 === 1 ? 0 : v)), 2));
        if (objectMesh === undefined) {
          objectMesh = new T.Mesh(geometry as never, objectMaterial);
          objectMesh.frustumCulled = false;
          objectMesh.renderOrder = 1;
          objectShadowMesh = new T.Mesh(shadowGeometry as never, shadowMaterial);
          objectShadowMesh.frustumCulled = false;
          objectShadowMesh.renderOrder = 2;
          scene.add(objectMesh, objectShadowMesh);
        } else {
          objectMesh.geometry.dispose();
          objectShadowMesh!.geometry.dispose();
          objectMesh.geometry = geometry as never;
          objectShadowMesh!.geometry = shadowGeometry as never;
        }
        objectMesh.visible = true;
        objectShadowMesh!.visible = true;
      };
      let objectVersion = 0;
      // the traverse: a strip 2.8 m wide along each line, points about 2 m apart, with its distance along and its side as the texture coordinates
      let trackMesh: InstanceType<ThreeParts["Mesh"]> | undefined;
      let trackMaterial: InstanceType<ThreeParts["ShaderMaterial"]> | undefined;
      let trackGeometry: InstanceType<ThreeParts["BufferGeometry"]> | undefined;
      if (options.traverse !== undefined && options.traverse.length > 0) {
        const positions: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        let along = 0;
        for (const line of options.traverse) {
          // densified: a point at least every 2 m
          const pts: [number, number][] = [];
          for (let i = 0; i + 1 < line.length / 2; i += 1) {
            const [x0, y0, x1, y1] = [line[2 * i]!, line[2 * i + 1]!, line[2 * i + 2]!, line[2 * i + 3]!];
            const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
            for (let k = 0; k < steps; k += 1) pts.push([x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps]);
          }
          pts.push([line[line.length - 2]!, line[line.length - 1]!]);
          const first = positions.length / 3;
          for (let i = 0; i < pts.length; i += 1) {
            const a = pts[Math.max(0, i - 1)]!;
            const b = pts[Math.min(pts.length - 1, i + 1)]!;
            const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
            const [nx, ny] = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
            if (i > 0) along += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
            for (const side of [-1, 1]) {
              positions.push(pts[i]![0] + nx * 1.4 * side, pts[i]![1] + ny * 1.4 * side, 0);
              uvs.push(along, side);
            }
            if (i > 0) {
              const v = first + 2 * i;
              indices.push(v - 2, v - 1, v, v - 1, v + 1, v);
            }
          }
        }
        trackGeometry = new T.BufferGeometry();
        trackGeometry.setAttribute("position", new T.BufferAttribute(new Float32Array(positions), 3));
        trackGeometry.setAttribute("uv", new T.BufferAttribute(new Float32Array(uvs), 2));
        trackGeometry.setIndex(new T.BufferAttribute(new Uint32Array(indices), 1));
        trackMaterial = new T.ShaderMaterial({ vertexShader: TRACK_VERTEX, fragmentShader: TRACK_FRAGMENT, uniforms, transparent: true, depthWrite: false, side: 2 });
        trackMaterial.polygonOffset = true;
        trackMaterial.polygonOffsetFactor = -3;
        trackMaterial.polygonOffsetUnits = -3;
        trackMesh = new T.Mesh(trackGeometry as never, trackMaterial);
        trackMesh.frustumCulled = false;
        trackMesh.renderOrder = 0.5;
        scene.add(trackMesh);
      }
      let measuring = false;
      let drawMs: number | undefined;
      let aspect = context.width / Math.max(1, context.height);
      let pixelHeight = Math.max(1, context.height);
      let fullPixel = 0.0024;
      let scale = 1;
      let last: SurfaceState | undefined;
      const place = (state: SurfaceState): void => {
        last = state;
        const { eye, look, sky } = state;
        fullPixel = (2 * Math.tan((look.fov * Math.PI) / 360)) / pixelHeight;
        makeRocks(state);
        makeObjects(state);
        measuring = state.measure === true;
        const world = new T.Vector3(eye.east, eye.up, -eye.north);
        const vp = viewProjection([world.x, world.y, world.z], look, aspect);
        (uniforms.uVP.value as Float32Array).set(vp);
        uniforms.uEyeEN.value.set(eye.east, eye.north);
        uniforms.uEye.value.set(eye.east, eye.up, eye.north);
        uniforms.uYaw.value = (look.azimuth * Math.PI) / 180;
        const halfV = Math.tan((look.fov * Math.PI) / 360);
        const halfH = Math.atan(halfV * aspect);
        const tilt = Math.abs(look.pitch) + look.fov / 2;
        uniforms.uSpan.value = tilt > 78 ? Math.PI : Math.min(Math.PI, halfH / Math.cos((tilt * Math.PI) / 180) + 0.06);
        uniforms.uSun.value.set(sky.sun.enu[0], sky.sun.enu[2], sky.sun.enu[1]);
        uniforms.uExposure.value = state.exposure ?? 4.5;
        uniforms.uAlbedo.value = state.albedo ?? 0.14;
        uniforms.uShadows.value = state.shadows === false ? 0 : 1;
        uniforms.uDetail.value = state.detail === false ? 0 : 1;
        uniforms.uSunDegrees.value = sky.sun.altitude;
        // the sector pair the Sun's azimuth lies between, in the baked horizon's eighteen directions
        const sectors = hz?.sectors ?? 18;
        const f = (((sky.sun.azimuth % 360) + 360) % 360) / (360 / sectors);
        const a = Math.floor(f);
        uniforms.uHzSun.value.set(a % sectors, (a + 1) % sectors, f - a);
        const q = state.quality ?? "full";
        const near = q === "full" ? [56, 80, 36] : q === "medium" ? [28, 40, 16] : [10, 14, 0];
        uniforms.uNear.value.set(near[0]!, near[1]!, near[2]!);
        scale = Math.min(1, Math.max(0.25, state.scale ?? 1));
        // a pixel of a smaller target is wider by the share it is drawn at
        uniforms.uPixel.value = fullPixel / (T.WebGLRenderTarget === undefined ? 1 : scale);
        const axes = cameraAxes(look);
        const toEnu = (v: readonly [number, number, number]): [number, number, number] => [v[0], -v[2], v[1]];
        const sunWorld: [number, number, number] = [sky.sun.enu[0], sky.sun.enu[2], -sky.sun.enu[1]];
        const earthWorld: [number, number, number] = [sky.earth.enu[0], sky.earth.enu[2], -sky.earth.enu[1]];
        for (const [d, dir] of [[sun, sunWorld], [earth, earthWorld]] as const) {
          d.uniforms.uEyeWorld!.value = world;
          (d.uniforms.uDirWorld!.value as InstanceType<ThreeParts["Vector3"]>).set(dir[0], dir[1], dir[2]);
          (d.uniforms.uRightWorld!.value as InstanceType<ThreeParts["Vector3"]>).set(axes.right[0], axes.right[1], axes.right[2]);
          (d.uniforms.uUpWorld!.value as InstanceType<ThreeParts["Vector3"]>).set(axes.up[0], axes.up[1], axes.up[2]);
          const de = toEnu(dir);
          (d.uniforms.uDirEnu!.value as InstanceType<ThreeParts["Vector3"]>).set(de[0], de[1], de[2]);
          const re = toEnu(axes.right);
          (d.uniforms.uRightEnu!.value as InstanceType<ThreeParts["Vector3"]>).set(re[0], re[1], re[2]);
          const ue = toEnu(axes.up);
          (d.uniforms.uUpEnu!.value as InstanceType<ThreeParts["Vector3"]>).set(ue[0], ue[1], ue[2]);
          (d.uniforms.uSunEnu!.value as InstanceType<ThreeParts["Vector3"]>).set(sky.sun.enu[0], sky.sun.enu[1], sky.sun.enu[2]);
        }
        (earth.uniforms.uHalf as { value: number }).value = Math.tan((sky.earthDiameter * Math.PI) / 360);
        (sun.uniforms.uHalf as { value: number }).value = Math.tan((sky.sunDiameter * Math.PI) / 360);
        sun.mesh.visible = sky.sun.altitude > -1;
        earth.mesh.visible = sky.earth.altitude > -1;
      };
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      // the stretch of a smaller draw to the canvas: one square with the target as its texture (made when first needed)
      let target: InstanceType<NonNullable<ThreeParts["WebGLRenderTarget"]>> | undefined;
      const blitUniforms = { uMap: { value: null as unknown } };
      const blitMaterial = new T.ShaderMaterial({
        vertexShader: "varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }",
        fragmentShader: "precision highp float; uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(uMap, vUv); }",
        uniforms: blitUniforms,
        depthTest: false,
        depthWrite: false,
      });
      const blitMesh = new T.Mesh(square as never, blitMaterial);
      blitMesh.frustumCulled = false;
      const blitScene = new T.Scene();
      blitScene.add(blitMesh);
      return {
        scene,
        camera,
        mesh: { rings: RINGS, rays: RAYS, triangles },
        get rocks() {
          return rockCount;
        },
        get drawMs() {
          return drawMs;
        },
        render(gl) {
          const t0 = performance.now();
          if (scale < 1 && T.WebGLRenderTarget !== undefined) {
            // the ground at a smaller size, stretched to the canvas by one textured square
            const w = Math.max(1, Math.round(gl.domElement.width * scale));
            const h = Math.max(1, Math.round(gl.domElement.height * scale));
            const three = gl as unknown as { setRenderTarget(target: unknown): void };
            if (target === undefined) {
              target = new T.WebGLRenderTarget(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true });
              blitUniforms.uMap.value = target.texture;
            } else if (target.width !== w || target.height !== h) target.setSize(w, h);
            three.setRenderTarget(target);
            gl.render(scene, camera);
            three.setRenderTarget(null);
            gl.render(blitScene, camera);
          } else gl.render(scene, camera);
          if (measuring) {
            const canvas = gl.domElement;
            // reading one pixel back waits for the card to finish the draw (`finish` returns at once in a browser that draws in another process)
            const g = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGL2RenderingContext | null;
            g?.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array(4));
            drawMs = performance.now() - t0;
          }
        },
        apply: place,
        refresh(ids) {
          const wanted = new Set(ids);
          options.levels.forEach((level, i) => wanted.has(level.id) && (textures[i]!.needsUpdate = true));
          (options.pictures ?? []).forEach((level, i) => wanted.has(level.id) && (pictures[i]!.needsUpdate = true));
          (options.horizons ?? []).forEach((h, i) => wanted.has(`horizon:${h.id}`) && (horizons[i]!.needsUpdate = true));
          rockKey = "";
          objectVersion += 1;
        },
        resize(width, height) {
          aspect = width / Math.max(1, height);
          pixelHeight = Math.max(1, height);
          if (last !== undefined) place(last);
        },
        dispose() {
          geometry.dispose();
          square.dispose();
          groundMaterial.dispose();
          rockGeometry?.dispose();
          shadowGeometry?.dispose();
          rockMaterial.dispose();
          shadowMaterial.dispose();
          sun.material.dispose();
          earth.material.dispose();
          target?.dispose();
          objectMesh?.geometry.dispose();
          objectShadowMesh?.geometry.dispose();
          trackGeometry?.dispose();
          trackMaterial?.dispose();
          blitMaterial.dispose();
        },
      };
    },
  };
}
