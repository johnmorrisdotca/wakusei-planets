// The line-up's 3D scene: every star (drawn from its numbers, with wakusei's star look) and planet in ONE three.js scene, drawn through kazoku-ui's shared renderer (one WebGL context for the page). The camera is
// orthographic and looks straight down the line; the bodies are at true relative size in Suns, so the camera's window is `2 * h` Suns tall. Nothing here draws by itself: the element hands the scene a state and asks for a
// draw, and the scene keeps asking for the next frame only while the bodies are turning by themselves.
import type { BuildContext, Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import type * as THREE from "three";
import { makeBodyMaterial, type ThreeParts } from "../scene/body.ts";
import { STAR_GLOW_FRAGMENT, GLOW_VERTEX } from "../scene/glsl.ts";
import { createPainter, type Painting } from "../scene/painter.ts";
import type { StarLook } from "../star.ts";
import "../bodies/earth.ts";
import "../bodies/jupiter.ts";
import type { LineupBody } from "./data.ts";
import type { LineupPlace, LineupView } from "./layout.ts";

/** How a body is turned by hand: yaw about its pole, pitch toward the viewer, both in degrees. */
export interface LineupHand {
  yaw: number;
  pitch: number;
}

/** Everything that decides how the scene looks at one draw. */
export interface LineupDraw {
  places: readonly LineupPlace[];
  view: LineupView;
  /** What a hand has turned each body by. */
  hands: ReadonlyMap<string, LineupHand>;
  /** The bodies turn by themselves. */
  spin: boolean;
  /** The body a hand holds: it does not turn by itself while it is held. */
  holding?: string;
}

export interface LineupScene extends Scene3D {
  apply(state: LineupDraw): void;
  /** Call `fn` right after the next draw, in the same task, while the canvas still holds the picture (it does not keep it after). */
  afterDraw(fn: () => void): void;
  /** The ids of the bodies drawn at the last draw: in the picture and at least a fifth of a pixel across. */
  readonly drawn: readonly string[];
}

export interface LineupItemOptions {
  /** A key that changes whenever the picture would: the renderer keeps one still for each key. */
  key: string;
  bodies: readonly LineupBody[];
  /** The star look of each star, by id. */
  stars: ReadonlyMap<string, StarLook>;
  /** The planets' look: `realistic` or `painted`. */
  look: "realistic" | "painted";
  state(): LineupDraw;
  textureBase(): string;
  farBase(): string;
  redraw(): void;
}

/** A body smaller than this many pixels across its radius is not drawn at all: it would be nothing but noise. */
const MIN_RADIUS_PX = 0.2;
/** How fast a body turns on the page, in degrees a second: slow, so it is easy to see and easy to take hold of. A planet is the same for every planet. */
const PLANET_TURN = 8;
const turnOf = (star: StarLook): number => Math.min(10, Math.max(2, Math.abs(star.turn.degreesPerSecond) * 0.5)) * Math.sign(star.turn.degreesPerSecond || 1);

/**
 * The item the shared renderer shows for a line-up: its `build` makes the scene, whose `apply` is handed each state.
 */
export function createLineupItem(options: LineupItemOptions): Item3D<ThreeParts> {
  return {
    key: options.key,
    build({ three: T, assets, width, height }: BuildContext<ThreeParts>): LineupScene {
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      const painter = createPainter({ textureBase: options.textureBase(), farBase: options.farBase() });
      const sphere = assets.acquire("lu:sphere", () => new T.SphereGeometry(1, 128, 64), (g) => g.dispose());
      const glowGeometry = assets.acquire("wk:glow", () => new T.PlaneGeometry(6, 6), (g) => g.dispose());

      interface Item {
        place: LineupBody;
        group: THREE.Group;
        mesh?: THREE.Mesh;
        glow?: THREE.Mesh;
        glowMaterial?: THREE.ShaderMaterial;
        material?: THREE.ShaderMaterial;
        painting?: Painting;
        look?: StarLook;
        /** The turn so far by itself, in degrees. */
        angle: number;
        rate: number;
      }
      const items = new Map<string, Item>();
      for (const body of options.bodies) {
        const group = new T.Group();
        group.name = body.name.en;
        const item: Item = { place: body, group, angle: 0, rate: PLANET_TURN };
        if (body.kind === "star") {
          const star = options.stars.get(body.id)!;
          item.look = star;
          item.rate = turnOf(star);
          item.material = assets.acquire(`lu:star:${star.key}`, () => makeBodyMaterial(T, star.look, false), (m) => m.dispose());
          item.mesh = new T.Mesh(sphere, item.material);
          item.mesh.frustumCulled = false;
          group.add(item.mesh);
          const own = star.look.glow;
          if (own !== undefined) {
            item.glowMaterial = assets.acquire(
              `lu:glow:${star.key}`,
              () => new T.ShaderMaterial({ vertexShader: GLOW_VERTEX, fragmentShader: STAR_GLOW_FRAGMENT, transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { uColour: { value: new T.Vector3(...own.colour) }, uStrength: { value: own.strength }, uSpread: { value: own.spread }, uRim: { value: own.rim ?? 0 }, uProm: { value: own.prominence ?? 0 }, uSeed: { value: own.seed ?? 0 }, uTime: { value: 0 } } }),
              (m) => m.dispose(),
            );
            item.glow = new T.Mesh(glowGeometry, item.glowMaterial);
            item.glow.position.z = -5;
            item.glow.frustumCulled = false;
            group.add(item.glow);
          }
        } else {
          item.painting = painter.make(T, body.body!, { look: options.look, invalidate: () => options.redraw(), ratio: Math.min(2, globalThis.devicePixelRatio || 1), maxTexture: 2048 });
          group.add(item.painting.object);
        }
        group.visible = false;
        scene.add(group);
        items.set(body.id, item);
      }

      let viewWidth = width;
      let viewHeight = height;
      let latest: LineupDraw = options.state();
      let after: (() => void)[] = [];
      let shown: string[] = [];
      let moving = false;
      const light = [-0.6, 0.2, 0.77] as const;
      const norm = Math.hypot(...light);
      const toSun: [number, number, number] = [light[0] / norm, light[1] / norm, light[2] / norm];

      /** Put every body where it is, turn it, and fit the camera's depth to the biggest one in the picture. */
      const apply = (state: LineupDraw): void => {
        latest = state;
        const aspect = viewWidth / Math.max(1, viewHeight);
        const halfH = state.view.h;
        const halfW = halfH * aspect;
        const pxPerUnit = viewHeight / (2 * halfH);
        shown = [];
        let biggest = 0;
        for (const place of state.places) {
          const item = items.get(place.body.id);
          if (item === undefined) continue;
          const r = place.r;
          const inPicture = Math.abs(place.x - state.view.x) - r < halfW && Math.abs(place.y - state.view.y) - r < halfH && r * pxPerUnit >= MIN_RADIUS_PX;
          item.group.visible = inPicture;
          if (!inPicture) continue;
          shown.push(place.body.id);
          biggest = Math.max(biggest, r);
          const hand = state.hands.get(place.body.id) ?? { yaw: 0, pitch: 0 };
          const yaw = ((item.angle + hand.yaw) * Math.PI) / 180;
          const pitch = (hand.pitch * Math.PI) / 180;
          item.group.position.set(place.x - state.view.x, place.y - state.view.y, 0);
          item.group.scale.setScalar(r);
          if (item.mesh !== undefined && item.look !== undefined) {
            const squash = 1 - item.look.oblateness;
            item.mesh.rotation.set(pitch, yaw, 0, "XYZ");
            item.mesh.scale.set(1, squash, 1);
            if (item.glow !== undefined && item.look.oblateness > 0) item.glow.scale.set(1, Math.sqrt(squash * squash * Math.cos(pitch) ** 2 + Math.sin(pitch) ** 2), 1);
            const seconds = (performance.now() / 1000) % 100_000;
            item.material!.uniforms.uTime!.value = seconds;
            if (item.glowMaterial !== undefined) item.glowMaterial.uniforms.uTime!.value = seconds;
          } else if (item.painting !== undefined) {
            const pole: [number, number, number] = [0, Math.cos(pitch), Math.sin(pitch)];
            // the prime meridian faces the viewer at yaw 0 and goes round the pole with the turn
            const meridian: [number, number, number] = [Math.sin(yaw), -Math.sin(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.cos(yaw)];
            item.painting.update({ toSun, ms: 0, radiusPx: r * pxPerUnit, pose: { pole, meridian } });
          }
        }
        // the camera sits at the middle of the picture; everything is drawn round it, and its depth holds the biggest body and its glow
        const R = Math.max(1e-9, biggest);
        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.position.set(0, 0, 4 * R);
        camera.near = 4 * R - 1.5 * R;
        camera.far = 4 * R + 6 * R;
        camera.updateProjectionMatrix();
        moving = state.spin && shown.length > 0;
      };

      apply(latest);
      return {
        scene,
        camera,
        apply,
        get drawn() {
          return shown;
        },
        afterDraw(fn: () => void) {
          after.push(fn);
        },
        resize(w: number, h: number) {
          viewWidth = w;
          viewHeight = h;
          apply(latest);
        },
        update(dt: number) {
          if (after.length > 0) {
            const run = after;
            after = [];
            queueMicrotask(() => run.forEach((fn) => fn()));
          }
          if (!moving) return false;
          for (const [id, item] of items) if (item.group.visible && id !== latest.holding) item.angle = (item.angle + item.rate * dt) % 360;
          apply(latest);
          return true;
        },
        dispose() {
          for (const item of items.values()) item.painting?.dispose();
          scene.clear();
        },
      } satisfies LineupScene;
    },
  };
}
