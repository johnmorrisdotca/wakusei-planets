import type * as THREE from "three";
import type { ThreeParts } from "./body.ts";
import { GLOW_FRAGMENT, GLOW_VERTEX, STAR_GLOW_FRAGMENT } from "./glsl.ts";
import type { BodyLook } from "./look.ts";

/** The camera-facing glow shared by a star on its own and a star in a scene. */
export function makeGlowMaterial(T: ThreeParts, glow: BodyLook["glow"]): THREE.ShaderMaterial {
  return new T.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: glow === undefined ? GLOW_FRAGMENT : STAR_GLOW_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: glow === undefined
      ? { uColour: { value: new T.Vector3(1, 0.7, 0.3) } }
      : {
          uColour: { value: new T.Vector3(...glow.colour) },
          uStrength: { value: glow.strength },
          uSpread: { value: glow.spread },
          uRim: { value: glow.rim ?? 0 },
          uProm: { value: glow.prominence ?? 0 },
          uSeed: { value: glow.seed ?? 0 },
          uTime: { value: 0 },
          uPulse: { value: 1 },
          uSpin: { value: 0 },
          uPole: { value: 0 },
          uTilt: { value: 0 },
        },
  });
}
