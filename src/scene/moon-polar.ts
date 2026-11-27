import type * as THREE from "three";
import { loadImage } from "./textures.ts";
import type { Region } from "./tiles.ts";

const POLAR_EDGE = (75.25 * Math.PI) / 180;
const RELIEF_FROM_PX_PER_RADIAN = 600;

export const MOON_POLAR_RELIEF = /* glsl */ `
uniform sampler2D uMoonPolarHeight;
uniform float uMoonPolarSide;
float moonPolarHeight(vec3 p) {
  float pole = p.z * uMoonPolarSide;
  if (pole < 0.965925826) return 0.0;
  vec2 plane = vec2(p.y, uMoonPolarSide * p.x);
  vec2 uv = plane * (1737400.0 / (457440.0 * (1.0 + pole))) + 0.5;
  vec2 code = texture2D(uMoonPolarHeight, uv).rg;
  float height = dot(code, vec2(65280.0, 255.0)) * (24000.0 / 65535.0) - 12000.0;
  return height / 1737400.0;
}
float moonPolarFade(vec3 p) {
  // The data end at 75°. Fade the slope, rather than tilting the terrain down to zero at the edge.
  return smoothstep(0.967045938, 0.990268069, p.z * uMoonPolarSide);
}`;

export function moonPolarUniforms(): Record<string, THREE.IUniform> {
  return {
    uMoonPolarHeight: { value: null },
    uMoonPolarSide: { value: 0 },
  };
}

export interface MoonPolarRelief {
  follow(region?: Region, radiansPixels?: number): void;
  dispose(): void;
}

/** Hold one polar height plane per close view. The old painted map draws while it is in flight. */
export function moonPolarRelief(
  T: Pick<typeof THREE, "TextureLoader" | "NoColorSpace" | "LinearFilter">,
  uniforms: Record<string, THREE.IUniform>,
  base: () => string | undefined,
  redraw: () => void,
): MoonPolarRelief {
  const field = uniforms.uMoonPolarHeight!;
  const sideUniform = uniforms.uMoonPolarSide!;
  let wanted = 0;
  let requested: { url: string } | undefined;
  let texture: THREE.Texture | undefined;

  const drop = (): void => {
    requested = undefined;
    sideUniform.value = 0;
    field.value = null;
    texture?.dispose();
    texture = undefined;
  };

  return {
    follow(region, radiansPixels = 0) {
      const folder = base();
      if (folder === undefined) {
        drop();
        return;
      }
      const side = region === undefined || radiansPixels < RELIEF_FROM_PX_PER_RADIAN ? 0 :
        region.latMax >= POLAR_EDGE ? 1 : region.latMin <= -POLAR_EDGE ? -1 : 0;
      wanted = side;
      if (side === 0) {
        sideUniform.value = 0;
        return;
      }
      const url = `${folder}moon/polar/${side === 1 ? "north" : "south"}.webp`;
      if (requested?.url === url) {
        sideUniform.value = texture === undefined ? 0 : side;
        return;
      }
      drop();
      const request = { url };
      requested = request;
      void loadImage(T, url).then((map) => {
        if (requested !== request) {
          map.dispose();
          return;
        }
        texture = map;
        map.flipY = false;
        map.colorSpace = T.NoColorSpace;
        map.minFilter = T.LinearFilter;
        map.magFilter = T.LinearFilter;
        map.generateMipmaps = false;
        field.value = map;
        sideUniform.value = wanted === side ? side : 0;
        if (wanted === side) redraw();
      }, () => undefined);
    },
    dispose: drop,
  };
}
