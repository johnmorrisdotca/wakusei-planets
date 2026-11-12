// The painted trail as one transparent sphere just over a body's surface. The scene shows it only while paint is on, and uploads the buffer only when a frame changed it.
import type * as THREE from "three";
import type { ThreeParts } from "../scene/body.ts";
import { PAINT_H, PAINT_W } from "../paint/trail.ts";

const VERTEX = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform float uNow;
uniform float uSpan;
varying vec3 vLocal;
void main() {
  float lat = asin(clamp(vLocal.y, -1.0, 1.0));
  float lon = atan(vLocal.x, vLocal.z);
  vec2 uv = vec2(lon / 6.2831853 + 0.5, 0.5 - lat / 3.14159265);
  vec4 stamp = texture2D(uMap, uv);
  float then = floor(stamp.r * 255.0 + 0.5) * 256.0 + floor(stamp.g * 255.0 + 0.5);
  float age = uNow - then;
  if (age < -32768.0) age += 65536.0;
  if (age > 32768.0) age -= 65536.0;
  float show = stamp.a * step(-1.0, age) * (1.0 - smoothstep(uSpan * 0.82, uSpan, max(age, 0.0)));
  if (show < 0.04) discard;
  gl_FragColor = vec4(1.0, 0.55, 0.12, clamp(show, 0.0, 0.9));
}
`;

/**
 * The trail drawn on a body. `show` parents it to that body's oriented mesh. `hide` draws nothing and gives the picture's and the sphere's copies on the graphics card back, so a view with paint off
 * holds none of it. `dispose` frees the geometry, the material and the texture for good.
 */
export function createPaintOverlay(three: ThreeParts, data: Uint8Array) {
  const texture = new three.DataTexture(data, PAINT_W, PAINT_H, three.RGBAFormat);
  texture.flipY = false;
  texture.magFilter = three.LinearFilter;
  texture.minFilter = three.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = three.NoColorSpace;
  texture.needsUpdate = false;
  const geometry = new three.SphereGeometry(1.004, 64, 32);
  const material = new three.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    uniforms: { uMap: { value: texture }, uNow: { value: 0 }, uSpan: { value: 1440 } },
  });
  const mesh = new three.Mesh(geometry, material);
  mesh.name = "ground-track";
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.visible = false;
  /** Whether the texture or the sphere may be on the graphics card. */
  let held = false;
  return {
    show(host: THREE.Object3D, nowMinute: number, spanMinutes: number, upload: boolean): void {
      if (mesh.parent !== host) host.add(mesh);
      mesh.visible = true;
      if (!held) {
        held = true;
        texture.needsUpdate = true;
      }
      material.uniforms.uNow!.value = nowMinute;
      material.uniforms.uSpan!.value = spanMinutes;
      if (upload) texture.needsUpdate = true;
    },
    hide(): void {
      mesh.visible = false;
      if (held) {
        held = false;
        texture.dispose();
        geometry.dispose();
      }
    },
    dispose(): void {
      mesh.parent?.remove(mesh);
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
