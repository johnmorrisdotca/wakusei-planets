// The browser side of round-bodies.demo.ts, bundled by that spec: the painter's own bodies in a three.js scene of its own, under a perspective camera of the space view's field of view, drawn in a canvas the size of
// the window asked for. One body at a place in the picture (a point of the window from -1 to 1 each way) is drawn lit from the camera, and what is drawn is measured from its pixels. Not a test file.
import { AdditiveBlending, BufferAttribute, BufferGeometry, ClampToEdgeWrapping, DataTexture, DoubleSide, Group, Line, LineBasicMaterial, LineSegments, LinearFilter, Mesh, NoColorSpace, OrthographicCamera, PerspectiveCamera, PlaneGeometry, RepeatWrapping, RGBAFormat, RingGeometry, Scene, ShaderMaterial, SphereGeometry, TextureLoader, Vector2, Vector3, WebGLRenderer } from "three";
import { createPainter } from "../src/scene/painter.ts";

const THREE = { AdditiveBlending, BufferAttribute, BufferGeometry, ClampToEdgeWrapping, DataTexture, DoubleSide, Group, Line, LineBasicMaterial, LineSegments, LinearFilter, Mesh, NoColorSpace, OrthographicCamera, PerspectiveCamera, PlaneGeometry, RepeatWrapping, RGBAFormat, RingGeometry, Scene, ShaderMaterial, SphereGeometry, TextureLoader, Vector2, Vector3, WebGLRenderer };

export interface RoundAsk {
  width: number;
  height: number;
  body: string;
  /** Where the body is in the picture: -1, 0 or 1 across and up, 0 the middle and 1 as near that edge as the whole disc fits (a margin of one and a half radii, three and a quarter for the glow). */
  at: [number, number];
  /** The body's radius on the screen if it stood in the middle, as a share of the picture's shorter side. */
  share: number;
  /** The camera's vertical field of view in degrees (the space view's is 35). */
  fov: number;
  /** What is measured: the globe, or everything drawn, the Sun's glow too. */
  what: "globe" | "all";
}

export interface RoundSeen {
  /** The drawn shape's width and height (its box, in pixels). */
  width: number;
  height: number;
  /** The long axis over the short axis, from the shape's own second moments: 1 for a circle, whatever way up it is. */
  axes: number;
  /** The shape's middle in the window, in pixels from the top left. */
  x: number;
  y: number;
  pixels: number;
}

const painter = createPainter({ tiles: "off" });
let canvas: HTMLCanvasElement | undefined;
let renderer: InstanceType<typeof WebGLRenderer> | undefined;

function measure(width: number, height: number, mask: (x: number, y: number) => boolean): RoundSeen {
  let n = 0;
  let sx = 0;
  let sy = 0;
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask(x, y)) continue;
      n += 1;
      sx += x;
      sy += y;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (n === 0) return { width: 0, height: 0, axes: Number.NaN, x: 0, y: 0, pixels: 0 };
  const mx = sx / n;
  const my = sy / n;
  let a = 0;
  let b = 0;
  let c = 0;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (!mask(x, y)) continue;
      a += (x - mx) ** 2;
      b += (x - mx) * (y - my);
      c += (y - my) ** 2;
    }
  }
  const mean = (a + c) / 2;
  const spread = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  return { width: right - left + 1, height: bottom - top + 1, axes: Math.sqrt((mean + spread) / Math.max(1e-9, mean - spread)), x: mx, y: my, pixels: n };
}

function draw(ask: RoundAsk): RoundSeen {
  const { width, height } = ask;
  if (canvas === undefined || renderer === undefined) {
    canvas = document.createElement("canvas");
    document.body.append(canvas);
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);
  }
  renderer.setSize(width, height, false);
  const scene = new Scene();
  const camera = new PerspectiveCamera(ask.fov, width / height, 0.5, 5000);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  // the body a distance out along the ray through the place, a radius of 1 that is `share` of the shorter side across on the axis
  const tan = ask.share * 2 * (Math.min(width, height) / height) * Math.tan((ask.fov / 2) * (Math.PI / 180));
  const across = ask.share * Math.min(width, height);
  // the glow reaches out to about twice the globe's radius, and wider off the middle of the picture: it gets room for that
  const margin = (ask.what === "globe" ? 1.5 : 3.2) * across;
  const px = (ask.at[0] * (width / 2 - margin)) / (width / 2);
  const py = (ask.at[1] * (height / 2 - margin)) / (height / 2);
  const ray = new Vector3(px, py, 0.5).unproject(camera).normalize();
  const distance = Math.sqrt(1 + 1 / (tan * tan));
  const drawing = painter.make(THREE, ask.body, { look: "realistic", mapped: false });
  scene.add(drawing.object);
  drawing.object.position.copy(ray).multiplyScalar(distance);
  drawing.object.scale.setScalar(1);
  if (ask.what === "globe") drawing.object.traverse((o) => {
    const material = (o as { material?: { blending?: number } }).material;
    if (material?.blending === AdditiveBlending) o.visible = false;
  });
  const toCamera = ray.clone().multiplyScalar(-1);
  drawing.update({ toSun: [toCamera.x, toCamera.y, toCamera.z], ms: Date.UTC(2026, 10, 20, 17, 19), radiusPx: (height / 2) * tan * 0.5, view: { camera, width, height } });
  renderer.render(scene, camera);
  const gl = renderer.getContext();
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const threshold = ask.what === "globe" ? 128 : 20;
  // readPixels counts rows from the bottom
  const seen = measure(width, height, (x, y) => pixels[((height - 1 - y) * width + x) * 4 + 3]! > threshold);
  drawing.dispose();
  return seen;
}

Reflect.set(globalThis, "roundHarness", { draw });
