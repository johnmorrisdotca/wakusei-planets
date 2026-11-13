// The standing view as three.js draws it through kazoku-ui's shared renderer: the ground (one mesh round the viewer's feet, shaded from the measured heights), the Sun and the Earth as discs in
// a black sky. Nothing here draws by itself: the element hands over a state and asks. Only the parts of three.js the package's other views use are needed (no camera of its own is used: the
// shaders take a view and projection matrix, so a page that hands over a subset of three.js does not have to add a perspective camera).
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { ThreeParts } from "../scene/body.ts";
import { rocksAround } from "./detail.ts";
import { DISC_FRAGMENT, DISC_VERTEX, GROUND_FRAGMENT, GROUND_VERTEX, ROCK_FRAGMENT, ROCK_VERTEX, SHADOW_FRAGMENT, SHADOW_VERTEX } from "./glsl.ts";
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
}

/** The scene the shared renderer draws, with the one call that moves it. */
export interface SurfaceScene extends Scene3D {
  apply(state: SurfaceState): void;
  /** The rocks made round the eyes now. */
  readonly rocks: number;
  /** The mesh's size, for a test or a status line. */
  readonly mesh: { rings: number; rays: number; triangles: number };
}

export interface SurfaceItemOptions {
  /** The pyramid's levels, finest first, filled with their heights. */
  levels: readonly HeightLevel[];
  /** The ground picture's levels, where the site has them. */
  pictures?: readonly HeightLevel[];
  /** The ground's height at a point, metres east and north of the site, for the rocks to stand on: the measured heights, the made craters, the Moon's curve taken off. */
  groundY?(east: number, north: number): number;
  manifest: TerrainManifest;
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
        const pixel = uniforms.uPixel.value as number;
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
      let aspect = context.width / Math.max(1, context.height);
      let pixelHeight = Math.max(1, context.height);
      let last: SurfaceState | undefined;
      const place = (state: SurfaceState): void => {
        last = state;
        const { eye, look, sky } = state;
        makeRocks(state);
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
        uniforms.uPixel.value = (2 * Math.tan((look.fov * Math.PI) / 360)) / pixelHeight;
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
      return {
        scene,
        camera: new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
        mesh: { rings: RINGS, rays: RAYS, triangles },
        get rocks() {
          return rockCount;
        },
        apply: place,
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
        },
      };
    },
  };
}
