// A small body drawn as the mesh a mission published, with that mesh's own picture on its faces. Not a map wrapped around a globe: the picture uses the model's own coordinates.
import type * as THREE from "three";

/**
 * A published mesh, packed so the file stays small: positions, normals and texture coordinates as base64 little-endian floats, and the triangle indices as base64 unsigned shorts.
 * Positions are in units of the body's mean radius, in the globe's frame.
 */
export interface CraftMesh {
  /** The picture's file name, in the texture folder. */
  map: string;
  vertices: number;
  positions: string;
  normals: string;
  uvs: string;
  indices: string;
}

const bytes = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

/** The mesh's arrays, from the packed text. */
export function craftArrays(mesh: CraftMesh): { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint16Array } {
  const positions = new Float32Array(bytes(mesh.positions).buffer);
  const normals = new Float32Array(bytes(mesh.normals).buffer);
  const uvs = new Float32Array(bytes(mesh.uvs).buffer);
  const indices = new Uint16Array(bytes(mesh.indices).buffer);
  if (positions.length !== mesh.vertices * 3 || normals.length !== mesh.vertices * 3 || uvs.length !== mesh.vertices * 2) throw new RangeError("craft mesh arrays do not match its vertex count");
  return { positions, normals, uvs, indices };
}

/** The globe's geometry replaced by the mesh. */
export function craftGeometry(T: Pick<typeof THREE, "BufferGeometry" | "BufferAttribute">, mesh: CraftMesh): THREE.BufferGeometry {
  const { positions, normals, uvs, indices } = craftArrays(mesh);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new T.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new T.BufferAttribute(uvs, 2));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  return geometry;
}

/** The model's picture uses its own coordinates, with v upward. A texture loader flips a picture, so this puts it back. */
export function craftPicture(texture: { flipY: boolean; needsUpdate: boolean }): void {
  texture.flipY = false;
  texture.needsUpdate = true;
}

/** The picture lit by the same sun direction as every other body. The extra uniforms are the ones the body page and the painter write on every material. */
export function craftMaterial(T: Pick<typeof THREE, "ShaderMaterial" | "Vector3">, ambient: number): THREE.ShaderMaterial {
  return new T.ShaderMaterial({
    side: 2,
    vertexShader: /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform vec3 uLight;
uniform float uAmbient;
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vN;
void main() {
  float shade = max(0.0, dot(normalize(vN), normalize(uLight)));
  vec3 colour = texture2D(uMap, vUv).rgb;
  gl_FragColor = vec4(colour * (shade * (1.0 - uAmbient) + uAmbient), 1.0);
}`,
    uniforms: {
      uMap: { value: null },
      uLight: { value: new T.Vector3(1, 0, 0) },
      uAmbient: { value: ambient },
      uWrap: { value: 0 },
      uRimBase: { value: 0 },
      uScale: { value: 1 },
      uRingN: { value: new T.Vector3(0, 1, 0) },
      uOccN: { value: 0 },
      uOcc: { value: new Float32Array(24) },
    },
  });
}
