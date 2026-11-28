import type * as THREE from "three";
import type { ThreeParts } from "./body.ts";
import type { BodyLook } from "./look.ts";

const OUTER_RADIUS = 1.29;

/** Light on the opaque disc when the haze above it is drawn separately. */
export function titanDisc(look: BodyLook): BodyLook {
  return { ...look, ambient: 0.008, limb: 0.12, wrap: 0.12, atmosphere: { colour: [0.92, 0.66, 0.3], strength: 0, power: 2.3 } };
}

/** Titan's main and detached haze. The projected tangent radius separates the layers along the limb. */
export function titanHaze(T: ThreeParts, geometry: THREE.BufferGeometry, light: THREE.IUniform): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uLight: light, uOuterRadius: { value: OUTER_RADIUS } },
    vertexShader: /* glsl */ `
varying vec3 vNormal;
varying vec3 vPosition;
varying float vLatitude;
void main() {
  vec4 eye = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vPosition = eye.xyz;
  vLatitude = position.y;
  gl_Position = projectionMatrix * eye;
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uLight;
uniform float uOuterRadius;
varying vec3 vNormal;
varying vec3 vPosition;
varying float vLatitude;

float band(float r, float peak, float width, float pixel) {
  float resolved = max(width, pixel);
  float d = (r - peak) / resolved;
  return exp(-d * d) * width / resolved;
}

void main() {
  vec3 sight = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(-vPosition);
  vec3 normal = normalize(vNormal);
  float mu = dot(normal, sight);
  float radius = uOuterRadius * sqrt(max(0.0, 1.0 - mu * mu));
  float pixel = fwidth(radius) * 0.65;
  if (radius < 0.92) discard;
  vec3 light = normalize(mat3(viewMatrix) * uLight);
  vec3 tangent = normalize(normal - sight * mu);
  float alignment = dot(sight, light);
  float solarLimb = dot(tangent, light) / max(length(light - alignment * sight), 0.08);
  float sunward = smoothstep(-0.24, 0.96, solarLimb);
  float forward = smoothstep(0.0, 0.99, -alignment);
  float crescent = forward * sunward * sunward;
  float faceLight = smoothstep(-0.15, 0.65, dot(normal, light));
  // In daylight the halo is a narrow fringe just over the disc's limb.
  float fringe = band(radius, 1.009, 0.021, pixel) * 0.22 * faceLight * (1.0 - forward);
  vec3 fringeTint = mix(vec3(0.95, 0.72, 0.39), vec3(0.53, 0.72, 0.94), smoothstep(1.003, 1.035, radius));
  // Forward scattering lights the main ring most strongly on the sunward side.
  float mainRadius = mix(1.009, 1.126, forward);
  float mainHaze = band(radius, mainRadius, 0.023, pixel) * (0.065 * forward + 0.86 * crescent);
  // The outer peak of Cassini PIA12511 is about 1.22R at its 157° phase.
  // Forward scattering makes the thin layer much easier to see from that side.
  float detached = band(radius, 1.194 + 0.011 * vLatitude + 0.016 * forward, 0.013, pixel)
    * 0.16 * forward * crescent;
  float alpha = fringe + mainHaze + detached;
  vec3 tint = fringeTint * fringe + vec3(1.0, 0.86, 0.59) * mainHaze + vec3(0.44, 0.72, 0.96) * detached;
  // At high phase the haze in silhouette also hides the surface up to the bright limb.
  float shadow = (1.0 - alpha) * smoothstep(0.72, 0.98, forward) * smoothstep(0.92, 0.99, radius)
    * (1.0 - smoothstep(mainRadius - 0.023, mainRadius + 0.006, radius));
  gl_FragColor = vec4((tint + vec3(0.018, 0.012, 0.008) * shadow) / max(alpha + shadow, 0.001), alpha + shadow);
}`,
  });
  const haze = new T.Mesh(geometry, material);
  haze.scale.setScalar(OUTER_RADIUS);
  haze.renderOrder = 1;
  return haze;
}
