// A rover model for the standing view: a GLB (glTF binary) loaded on demand, its wheels rolled and steered from the drive state and drawn over the ground with its own materials, lit by the Sun of the place.
// It is drawn in a pass of its own after the ground, with a camera whose projection is the ground's own view-projection matrix, so it sits in the same depth and the same picture. The loader, the meshopt decoder and three.js
// come from the page's `three` (the model option needs the whole of it, not the small part the bodies use), and arrive when a model is first asked for, so a page that does not use it loads none of it.
import type * as THREE from "three";
import { toWorld, type DriveState } from "./drive.ts";
import type { V3 } from "./shapes.ts";
import { MODEL_NODES, fromModelFrame, modelPose, rigOf, type ModelNodes, type Rig } from "./rig.ts";

/**
 * A rover model that has been loaded: its rig for the drive step and the calls the scene makes. Made by `loadVehicleModel`.
 *
 * @example
 * ```ts no-run
 * import { loadVehicleModel, type VehicleModel } from "@johnmorrisdotca/wakusei-planets/surface/model";
 *
 * const model: VehicleModel = await loadVehicleModel("/models/perseverance.glb");
 * console.log(model.rig.wheelbase, model.nodes.length);
 * model.dispose();
 * ```
 */
export interface VehicleModel {
  /** What a drive step and the seat view take from the model. */
  readonly rig: Rig;
  /** The names of the nodes the model has that this package uses (`wheel-fl`, `steer-fr`, `eye`, ...). */
  readonly nodes: readonly string[];
  /** The model's height over the ground, metres. */
  readonly height: number;
  /** Triangles of each mesh, in the drive frame at rest. Each casts on its own, so the shadow follows the rover. */
  readonly shadowClouds: readonly (readonly V3[])[];
  /** Put the model where the drive state is, with the wheels rolled and steered, lit from `sun` (a direction in the scene's frame, east, up, minus north) at `strength` (0 to 1). */
  place(state: DriveState, sun: readonly [number, number, number], strength: number): void;
  /** Draw it with the page's renderer over what is drawn, with the ground's view-projection matrix. */
  render(gl: { render(scene: unknown, camera: unknown): void; autoClear: boolean }, viewProjection: Float32Array): void;
  /** The roll and steer angles each named node has been set to by the last `place`, for a test. */
  readonly angles: Readonly<Record<string, number>>;
  /** How many times it has been drawn, for a test. */
  readonly renders: number;
  /** Let go of the geometry, the materials and the textures. */
  dispose(): void;
}




/**
 * Load a rover model from a GLB and read its rig. The nodes it must give are in `MODEL_NODES`: `wheel-xx` (rolled about X), `steer-xx` (turned about Y) and `eye` or `seat-commander`; a model with no corner wheel is refused.
 * The loader and the meshopt decoder are three.js's own add-ons, imported when this is first called. Each call makes its own copy (the loaded file is read again from the browser's cache), which `dispose()` frees.
 *
 * @param url - Where the GLB is served from.
 * @param options - `signal` to cancel the request.
 * @returns The model, or a rejection when the file cannot be read or has no corner wheel.
 *
 * @example
 * ```ts no-run
 * import { loadVehicleModel } from "@johnmorrisdotca/wakusei-planets/surface/model";
 *
 * const model = await loadVehicleModel("https://johnmorrisdotca.github.io/wakusei-planets/models/perseverance.glb");
 * console.log(model.rig.track.toFixed(2), "m between the wheels");
 * ```
 */
export async function loadVehicleModel(url: string, options: { signal?: AbortSignal } = {}): Promise<VehicleModel> {
  const [three, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import("three"), import("three/addons/loaders/GLTFLoader.js"), import("three/addons/libs/meshopt_decoder.module.js")]);
  options.signal?.throwIfAborted();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  options.signal?.throwIfAborted();
  return makeModel(three, gltf.scene);
}

function makeModel(T: typeof THREE, root: THREE.Object3D): VehicleModel {
  root.matrixAutoUpdate = false;
  root.updateMatrixWorld(true);
  const found = new Map<string, THREE.Object3D>();
  root.traverse((node) => {
    if (node.name !== "" && !found.has(node.name)) found.set(node.name, node);
  });
  const names = [...MODEL_NODES.wheels, ...MODEL_NODES.steers, ...MODEL_NODES.eyes].filter((name) => found.has(name));
  const at: Record<string, [number, number, number]> = {};
  const here = new T.Vector3();
  for (const name of names) {
    found.get(name)!.getWorldPosition(here);
    at[name] = fromModelFrame([here.x, here.y, here.z]);
  }
  const box = new T.Box3().setFromObject(root);
  const size = box.getSize(new T.Vector3());
  // a wheel's radius: half the height of the biggest wheel node
  let wheelRadius = 0;
  const wheelBox = new T.Box3();
  for (const name of MODEL_NODES.wheels) {
    const node = found.get(name);
    if (node === undefined) continue;
    wheelBox.setFromObject(node);
    wheelRadius = Math.max(wheelRadius, (wheelBox.max.y - wheelBox.min.y) / 2);
  }
  const nodes: ModelNodes = { at, wheelRadius, length: size.z };
  const rig = rigOf(nodes);
  if (rig === undefined) {
    disposeAll(root);
    throw new Error("the model has no wheel-fl, wheel-fr, wheel-rl and wheel-rr nodes");
  }
  // the nodes that move, with the turn they were loaded with
  const moving = new Map<string, { node: THREE.Object3D; base: THREE.Quaternion }>();
  for (const name of [...MODEL_NODES.wheels, ...MODEL_NODES.steers]) {
    const node = found.get(name);
    if (node !== undefined) moving.set(name, { node, base: node.quaternion.clone() });
  }
  root.traverse((node) => {
    node.frustumCulled = false;
  });
  const scene = new T.Scene();
  const sunLight = new T.DirectionalLight(0xffffff, 3);
  const fill = new T.AmbientLight(0xffffff, 0.35);
  scene.add(root, sunLight, fill, sunLight.target);
  const camera = new T.Camera();
  camera.matrixAutoUpdate = false;
  const angles: Record<string, number> = {};
  let renders = 0;
  const [ax, ay] = [new T.Vector3(1, 0, 0), new T.Vector3(0, 1, 0)];
  const turn = new T.Quaternion();
  const shadowClouds = shadowCloudsOf(T, root);
  return {
    rig,
    nodes: names,
    height: size.y,
    shadowClouds,
    angles,
    get renders() {
      return renders;
    },
    place(state, sun, strength) {
      const pose = modelPose(state);
      // a positive roll is forward (the top moving toward +Z, a turn about +X); the model's +X is the left, so a steer to the right is a turn about +Y the other way
      for (const [name, entry] of moving) {
        const roll = pose.roll[name];
        const steer = pose.steer[name];
        if (roll !== undefined) {
          angles[name] = roll;
          entry.node.quaternion.copy(entry.base).multiply(turn.setFromAxisAngle(ax, roll));
        } else if (steer !== undefined) {
          angles[name] = -steer;
          entry.node.quaternion.copy(entry.base).multiply(turn.setFromAxisAngle(ay, -steer));
        }
        entry.node.matrixWorldNeedsUpdate = true;
        entry.node.updateMatrix();
      }
      // the model's frame in the scene's (x east, y up, z minus north): the drive frame's axes, with left and right swapped for the model's
      const o = toWorld(state, [0, 0, 0]);
      const axis = (v: [number, number, number]): [number, number, number] => {
        const p = toWorld(state, v);
        return [p[0] - o[0], p[1] - o[1], -(p[2] - o[2])];
      };
      const [cx, cy, cz] = [axis([-1, 0, 0]), axis([0, 1, 0]), axis([0, 0, 1])];
      root.matrix.set(cx[0], cy[0], cz[0], o[0], cx[1], cy[1], cz[1], o[1], cx[2], cy[2], cz[2], -o[2], 0, 0, 0, 1);
      root.updateMatrixWorld(true);
      sunLight.position.set(sun[0] * 100, sun[1] * 100, sun[2] * 100).add(here.set(o[0], o[1], -o[2]));
      sunLight.target.position.set(o[0], o[1], -o[2]);
      sunLight.target.updateMatrixWorld();
      sunLight.intensity = 3 * strength;
    },
    render(gl, viewProjection) {
      camera.projectionMatrix.fromArray(viewProjection);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      renders += 1;
      const was = gl.autoClear;
      gl.autoClear = false;
      gl.render(scene, camera);
      gl.autoClear = was;
    },
    dispose() {
      disposeAll(root);
    },
  };
}

/**
 * Triangles of each mesh, strided so a dense file stays a few hundred. One hull of a whole mesh is the body's box, which is the slab. A triangle casts on its own.
 */
function shadowCloudsOf(T: typeof THREE, root: THREE.Object3D): V3[][] {
  root.updateMatrixWorld(true);
  const v = new T.Vector3();
  const clouds: V3[][] = [];
  const cap = 500;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.isMesh !== true) return;
    const geom = mesh.geometry;
    const attr = geom?.getAttribute?.("position");
    if (attr === undefined || attr.count < 3) return;
    const index = geom.getIndex?.() ?? null;
    const triCount = index === null ? Math.floor(attr.count / 3) : Math.floor(index.count / 3);
    if (triCount < 1) return;
    const step = Math.max(1, Math.ceil(triCount / cap));
    const at = (i: number): V3 => {
      v.fromBufferAttribute(attr as THREE.BufferAttribute, i).applyMatrix4(mesh.matrixWorld);
      return fromModelFrame([v.x, v.y, v.z]);
    };
    for (let t = 0; t < triCount; t += step) {
      const base = t * 3;
      const pa = at(index === null ? base : index.getX(base));
      const pb = at(index === null ? base + 1 : index.getX(base + 1));
      const pc = at(index === null ? base + 2 : index.getX(base + 2));
      const abx = pb[0] - pa[0];
      const aby = pb[1] - pa[1];
      const abz = pb[2] - pa[2];
      const acx = pc[0] - pa[0];
      const acy = pc[1] - pa[1];
      const acz = pc[2] - pa[2];
      const cx = aby * acz - abz * acy;
      const cy = abz * acx - abx * acz;
      const cz = abx * acy - aby * acx;
      if (cx * cx + cy * cy + cz * cz < 1e-6) continue;
      clouds.push([pa, pb, pc]);
    }
  });
  return clouds;
}

function disposeAll(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry === undefined) return;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      for (const value of Object.values(material)) if (value !== null && typeof value === "object" && "isTexture" in value) (value as THREE.Texture).dispose();
      material.dispose();
    }
  });
}
