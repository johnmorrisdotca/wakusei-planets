// Close the openings of a partial sphere with filled layers on the two radial faces.
import { cutOpening, type CutSize } from "../interior.ts";
import type { InteriorProfile } from "../interior-profile.ts";
import type { ThreeParts } from "./body.ts";
import { PRELUDE } from "./glsl.ts";

const turn = 2 * Math.PI;
const latitudeSteps = 96;

const vertexShader = /* glsl */ `
attribute vec2 cutPoint;
attribute vec3 colour;
attribute vec2 finish;
varying vec2 vCut;
varying vec3 vColour;
varying vec2 vFinish;
void main() {
  vCut = cutPoint;
  vColour = colour;
  vFinish = finish;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
${PRELUDE}
uniform float uTime;
uniform float uMagma;
varying vec2 vCut;
varying vec3 vColour;
varying vec2 vFinish;

float pocket(vec2 centre, vec2 p, vec2 shape) {
  return 1.0 - smoothstep(0.15, 1.0, length((p - centre) / shape));
}

void main() {
  float r = length(vCut);
  float a = atan(vCut.y, vCut.x);
  float grain = fbm(vec3(vCut * 71.0, 3.0));
  vec3 colour = vColour * (0.82 + 0.29 * grain + 0.09 * vCut.y);
  if (vFinish.y > 0.5) {
    float phase = a - uTime * (0.18 + 0.32 * (1.0 - r));
    float bend = sin(3.0 * phase + 11.0 * r);
    vec2 p = r * vec2(cos(phase + 0.28 * bend), sin(phase + 0.28 * bend));
    float billow = fbm(vec3(p * 9.0, uTime * 0.24));
    float streak = 0.5 + 0.5 * sin(74.0 * r + 11.0 * billow + 4.0 * bend);
    float glow = 0.35 + 0.52 * billow + 0.48 * streak * streak * streak;
    colour = mix(colour * 0.62, mix(vColour, vec3(1.0, 0.94, 0.88), 0.43), glow);
  }
  if (uMagma > 0.5) {
    vec2 p = vec2(r, a);
    float melt = pocket(vec2(0.953, 0.84), p, vec2(0.012, 0.092))
      + pocket(vec2(0.955, 2.2), p, vec2(0.010, 0.073))
      + pocket(vec2(0.944, -1.0), p, vec2(0.014, 0.07));
    colour = mix(colour, vec3(1.0, 0.74, 0.18), clamp(melt * (0.82 + 0.3 * grain), 0.0, 1.0));
  }
  gl_FragColor = vec4(colour * vFinish.x, 1.0);
}
`;

export function createCutaway(T: ThreeParts, interior: InteriorProfile, size: CutSize) {
  const [centre, halfWidth] = cutOpening(size);
  const start = Math.PI / 2 + centre + halfWidth;
  const sweep = turn - 2 * halfWidth;
  const faces = new T.BufferGeometry();
  const positions: number[] = [];
  const points: number[] = [];
  const colours: number[] = [];
  const finishes: number[] = [];
  const indices: number[] = [];

  for (const [face, phi] of [start, start + sweep].entries()) {
    let inner = 0;
    const sign = face === 0 ? 1 : -1;
    const shade = face === 0 || size === "half" ? 1 : 0.81;
    for (const layer of interior.layers) {
      const outer = layer.outerKm / interior.radiusKm;
      const rgb = [1, 3, 5].map((offset) => parseInt(layer.colour.slice(offset, offset + 2), 16) / 255);
      const base = positions.length / 3;
      for (let j = 0; j <= latitudeSteps; j++) {
        const theta = (j / latitudeSteps) * Math.PI;
        for (const radius of [inner, outer]) {
          const across = radius * Math.sin(theta);
          const y = radius * Math.cos(theta);
          positions.push(-across * Math.cos(phi), y, across * Math.sin(phi));
          points.push(sign * across, y);
          colours.push(...rgb);
          finishes.push(shade, layer.flow === true ? 1 : 0);
        }
        if (j < latitudeSteps) {
          const at = base + 2 * j;
          indices.push(at, at + 1, at + 3, at, at + 3, at + 2);
        }
      }
      inner = outer;
    }
  }
  faces.setIndex(indices);
  faces.setAttribute("position", new T.BufferAttribute(new Float32Array(positions), 3));
  faces.setAttribute("cutPoint", new T.BufferAttribute(new Float32Array(points), 2));
  faces.setAttribute("colour", new T.BufferAttribute(new Float32Array(colours), 3));
  faces.setAttribute("finish", new T.BufferAttribute(new Float32Array(finishes), 2));
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: { uTime: { value: 0 }, uMagma: { value: interior.body === "earth" ? 1 : 0 } },
    vertexShader,
    fragmentShader,
  });
  const faceMesh = new T.Mesh(faces, material);
  return {
    faceMesh,
    setTime(time: number) {
      material.uniforms.uTime!.value = time;
    },
    dispose() {
      faces.dispose();
      material.dispose();
    },
  };
}
