import type * as THREE from "three";
import { VERSION } from "../version.ts";

/**
 * The default home of the surface pictures: the files of this exact version on jsDelivr. Set `texture-base` on an element to serve them yourself.
 *
 * @example
 * ```ts no-run
 * import { TEXTURE_BASE } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * console.log(TEXTURE_BASE);
 * ```
 */
export const TEXTURE_BASE = `https://cdn.jsdelivr.net/npm/@johnmorrisdotca/wakusei-planets@${VERSION}/dist/textures/`;

/**
 * Where the sharpest surface pictures are: the files of this exact version in the repository, on jsDelivr's GitHub address. The npm package holds only the two smaller widths, so a page that
 * never zooms in never fetches them. Set `texture-far-base` on an element to serve them yourself.
 *
 * @example
 * ```ts no-run
 * import { TEXTURE_FAR_BASE } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * console.log(TEXTURE_FAR_BASE);
 * ```
 */
export const TEXTURE_FAR_BASE = `https://cdn.jsdelivr.net/gh/johnmorrisdotca/wakusei-planets@v${VERSION}/textures/`;

export const slash = (base: string): string => (base.endsWith("/") ? base : `${base}/`);

export function texturePaths(element: Element): { textureBase(): string; farBase(): string } {
  const textureBase = (): string => {
    const own = element.getAttribute("texture-base");
    return own === null || own === "" ? TEXTURE_BASE : slash(own);
  };
  return {
    textureBase,
    farBase: () => {
      const own = element.getAttribute("texture-far-base");
      if (own !== null && own !== "") return slash(own);
      return element.hasAttribute("texture-base") ? textureBase() : TEXTURE_FAR_BASE;
    },
  };
}

export function loadImage(three: Pick<typeof THREE, "TextureLoader">, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const loader = new three.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(url, resolve, undefined, (error) => reject(error instanceof Error ? error : new Error("texture failed")));
  });
}
