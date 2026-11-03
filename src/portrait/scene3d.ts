// The portrait's 3D scene: every body of the portrait in ONE three.js scene, drawn through kazoku-ui's shared renderer (one WebGL context for the page). The bodies are the painter's
// (`scene/painter.ts`), seen through an orthographic camera that looks straight down the page; each sits at its own depth so the order in the list is the order they are drawn in.
// Nothing here draws by itself: the element hands the scene a state and asks for a draw.
import type { Item3D, Scene3D } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { BodyId } from "../facts.ts";
import type { ThreeParts } from "../scene/body.ts";
import { createPainter, type Painting } from "../scene/painter.ts";
import "../bodies/all.ts";
import { lightVector, type Placed, type Resolved } from "./model.ts";
import { poseOf } from "./pose.ts";

/** Everything that decides how the scene looks at one draw. */
export interface PortraitDraw {
  placed: readonly Placed[];
  camera: Resolved["camera"];
  light: { az: number; el: number };
  look: "realistic" | "painted";
  /** The moment the sky is shown at, in milliseconds since 1970, or `undefined` for a portrait. */
  ms: number | undefined;
  /** Seconds of each body's own turning so far. */
  seconds: number;
  shadows: boolean;
}

export interface PortraitScene extends Scene3D {
  apply(state: PortraitDraw): void;
  /** Call `fn` right after the next draw, in the same task, while the canvas still holds the picture (it does not keep it after). */
  afterDraw(fn: () => void): void;
  /** The paintings the scene holds now. */
  readonly bodies: number;
}

export interface PortraitItemOptions {
  /** A key that changes whenever the picture would: the renderer keeps one still for each key. */
  key: string;
  state(): PortraitDraw;
  textureBase(): string;
  farBase(): string;
  redraw(): void;
}

/** The smallest a body is drawn, in CSS pixels across its radius, so a body at true scale is still a dot you can see. */
const MIN_RADIUS_PX = 1.2;

const occludersFor = (placed: readonly Placed[], index: number): [number, number, number, number][] => {
  const me = placed[index]!;
  const list: { d2: number; angle: number; o: [number, number, number, number] }[] = [];
  placed.forEach((other, j) => {
    if (j === index || other.body === "sun" || other.r <= 0) return;
    const dx = (other.x - me.x) / me.r;
    const dy = (other.y - me.y) / me.r;
    const rr = other.r / me.r;
    const d2 = dx * dx + dy * dy;
    if (d2 > 3600 || rr < 0.01) return;
    list.push({ d2, angle: (rr * rr) / Math.max(d2, 1e-6), o: [dx, dy, 0, rr] });
  });
  return list.sort((a, b) => b.angle - a.angle).slice(0, 6).map((l) => l.o);
};

/**
 * The item the shared renderer shows for a portrait: its `build` makes the scene, whose `apply` is handed each state.
 */
export function createPortraitItem(options: PortraitItemOptions): Item3D<ThreeParts> {
  return {
    key: options.key,
    build({ three: T, width, height }): PortraitScene {
      const painter = createPainter({ textureBase: options.textureBase(), farBase: options.farBase() });
      const scene = new T.Scene();
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      const held = new Map<BodyId, { painting: Painting; look: string }>();
      let viewWidth = width;
      let viewHeight = height;
      let latest: PortraitDraw = options.state();
      let after: (() => void)[] = [];
      const ratio = (): number => Math.min(2, globalThis.devicePixelRatio || 1);

      const drop = (id: BodyId): void => {
        const one = held.get(id);
        if (one === undefined) return;
        scene.remove(one.painting.object);
        one.painting.dispose();
        held.delete(id);
      };

      const apply = (state: PortraitDraw): void => {
        latest = state;
        const { placed, camera: cam } = state;
        const present = new Set(placed.map((p) => p.body));
        for (const id of [...held.keys()]) if (!present.has(id) || held.get(id)!.look !== state.look) drop(id);
        const aspect = viewWidth / Math.max(1, viewHeight);
        const halfH = cam.h;
        const halfW = halfH * aspect;
        const pxPerUnit = viewHeight / (2 * halfH);
        const slot = 7 * Math.max(1e-6, ...placed.map((p) => Math.max(p.r, MIN_RADIUS_PX / pxPerUnit)));
        const far = (placed.length + 1) * slot;
        const distance = far + 300 * Math.max(halfW, halfH);
        camera.left = cam.x - halfW;
        camera.right = cam.x + halfW;
        camera.top = cam.y + halfH;
        camera.bottom = cam.y - halfH;
        camera.near = Math.max(1e-6, distance - far - slot);
        camera.far = distance + slot;
        camera.position.set(cam.x, cam.y, distance);
        camera.updateProjectionMatrix();
        const toSun = lightVector(state.light);
        placed.forEach((p, i) => {
          let one = held.get(p.body);
          if (one === undefined) {
            const painting = painter.make(T, p.body, { look: state.look, invalidate: () => options.redraw(), ratio: ratio(), maxTexture: placed.length > 6 ? 1024 : 2048 });
            scene.add(painting.object);
            one = { painting, look: state.look };
            held.set(p.body, one);
          }
          const r = Math.max(p.r, MIN_RADIUS_PX / pxPerUnit);
          one.painting.object.position.set(p.x, p.y, i * slot);
          one.painting.object.scale.setScalar(r);
          const pose = poseOf(p, state.ms, state.seconds, state.light);
          one.painting.update({
            toSun,
            ms: state.ms ?? 0,
            radiusPx: r * pxPerUnit,
            pose: { pole: pose.pole, meridian: pose.meridian },
            ...(state.shadows ? { occluders: occludersFor(placed, i) } : {}),
          });
        });
      };

      apply(latest);
      return {
        scene,
        camera,
        apply,
        get bodies() {
          return held.size;
        },
        afterDraw(fn: () => void) {
          after.push(fn);
        },
        resize(w: number, h: number) {
          viewWidth = w;
          viewHeight = h;
          apply(latest);
        },
        update() {
          if (after.length > 0) {
            const run = after;
            after = [];
            queueMicrotask(() => run.forEach((fn) => fn()));
          }
          return false;
        },
        dispose() {
          for (const id of [...held.keys()]) drop(id);
          scene.clear();
        },
      } satisfies PortraitScene;
    },
  };
}
