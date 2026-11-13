// A body's name written on its own globe (kazoku-ui's shared body label), fitted to this package's bodies: the band is a child of the body's mesh, so it turns with the body, in the frame
// the bodies' shaders use (longitude 0 along the mesh's +z, east along +x, the pole +y); and it is lit by the same direction the body is, through its own small shader, because the
// bodies have no three.js lights (each is lit by the `uLight` of its own material). Nothing here draws: the host calls `update` before each draw and `set` when a setting changed.
import { BODY_LABEL_FONT, createBodyLabel, loadBodyLabelFont, type BodyLabel, type BodyLabelLook, type BodyLabelRepeat, type BodyLabelSize, type BodyLabelThree } from "@johnmorrisdotca/kazoku-ui/body-label";
import type * as THREE from "three";
import type { ThreeParts } from "./body.ts";
import type { Vec3 } from "../vec.ts";

/**
 * The name written on a body's globe: the family's `bodyLabel` property. `look` is the one setting with no default: `painted` (pale letters over the surface), `etched` (the letters lighten the surface), `outline`
 * (the letters' edges) or `burned` (darker letters). The rest fall back to the family's: half strength, the name once, on the equator, turning with the body, in Michroma. The text is the body's own name
 * in the element's language (`EARTH`, `地球`), so it is not a setting here.
 *
 * @example
 * ```ts no-run
 * import type { NameLabelOptions } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const label: NameLabelOptions = { look: "painted", strength: 0.5, repeat: "both", latitude: 0, facing: false };
 * console.log(label.look);
 * ```
 */
export interface NameLabelOptions {
  look: BodyLabelLook;
  /** How strongly it shows, 0 to 1. Default 0.5. */
  strength?: number;
  /** `once`, `both` (two, on opposite sides, so one is always in view) or `around` (as many as fit). Default `once`. */
  repeat?: BodyLabelRepeat;
  /** The band's latitude in degrees: 0 is the equator; 55 or -55 is near a pole. Default 0. */
  latitude?: number;
  /** True: the name keeps facing the reader while the body turns under it. Default false. */
  facing?: boolean;
  /** A CSS font family the page has loaded. Default Michroma, which the label fetches itself (64 kB, once). */
  font?: string;
  /** The family for letters `font` has none of, such as Japanese (`"Noto Sans JP"`). Default the page's sans. */
  fallbackFont?: string;
  /** `small`, `medium` or `large`. Default `medium`. */
  size?: BodyLabelSize;
  /** No label while the body is drawn smaller than this many CSS pixels in radius. Default 24. */
  minRadiusPx?: number;
  /**
   * The tone of the letters, so the name reads on every body: `auto` (the default) takes dark letters on a light body and pale letters on a dark one, from the body's own colour (`nameTone`); `light` and
   * `dark` force one. Dark letters are the `burned` look, pale ones the `painted` look; `outline` has one tone only and keeps it.
   */
  tone?: NameLabelTone;
}

/**
 * The tone of a name's letters: `auto` (from the body's colour), `light` or `dark`.
 *
 * @example
 * ```ts
 * import type { NameLabelTone } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const tone: NameLabelTone = "dark";
 * console.log(tone);
 * ```
 */
export type NameLabelTone = "auto" | "light" | "dark";

/** The family's standard attribute names, as `readNameLabel` reads them. */
export const NAME_LABEL_ATTRIBUTES = ["body-label", "body-label-strength", "body-label-repeat", "body-label-latitude", "body-label-facing", "body-label-font", "body-label-fallback-font", "body-label-tone"] as const;

const LOOKS: readonly BodyLabelLook[] = ["painted", "etched", "outline", "burned"];
const REPEATS: readonly BodyLabelRepeat[] = ["once", "both", "around"];
const TONES: readonly NameLabelTone[] = ["auto", "light", "dark"];

/**
 * The label the family's attributes ask for (`body-label="painted"` and the seven beside it), or `null` when `body-label` is absent or not a look.
 *
 * @param el - Anything with `getAttribute` and `hasAttribute`: the element.
 * @returns The options, or `null` for no label.
 *
 * @example
 * ```ts no-run
 * import { readNameLabel } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * const el = document.querySelector("wakusei-body")!;
 * el.setAttribute("body-label", "etched");
 * console.log(readNameLabel(el)?.look);
 * ```
 */
export function readNameLabel(el: { getAttribute(name: string): string | null; hasAttribute(name: string): boolean }): NameLabelOptions | null {
  const look = el.getAttribute("body-label");
  if (look === null || !(LOOKS as readonly string[]).includes(look)) return null;
  const out: NameLabelOptions = { look: look as BodyLabelLook };
  const strength = Number(el.getAttribute("body-label-strength"));
  if (el.getAttribute("body-label-strength") !== null && Number.isFinite(strength)) out.strength = Math.max(0, Math.min(1, strength));
  const repeat = el.getAttribute("body-label-repeat");
  if (repeat !== null && (REPEATS as readonly string[]).includes(repeat)) out.repeat = repeat as BodyLabelRepeat;
  const latitude = Number(el.getAttribute("body-label-latitude"));
  if (el.getAttribute("body-label-latitude") !== null && Number.isFinite(latitude)) out.latitude = latitude;
  if (el.hasAttribute("body-label-facing") && el.getAttribute("body-label-facing") !== "off" && el.getAttribute("body-label-facing") !== "false") out.facing = true;
  const font = el.getAttribute("body-label-font");
  if (font !== null && font.trim() !== "") out.font = font.trim();
  const fallback = el.getAttribute("body-label-fallback-font");
  if (fallback !== null && fallback.trim() !== "") out.fallbackFont = fallback.trim();
  const tone = el.getAttribute("body-label-tone");
  if (tone !== null && (TONES as readonly string[]).includes(tone)) out.tone = tone as NameLabelTone;
  return out;
}

/** The relative luminance (0 to 1, as WCAG defines it) of a `#rrggbb` colour. */
const luminanceOf = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

/**
 * The tone of letters that read on a body of this colour: `dark` when the body is light, `light` when it is dark. The two letters are the family's pale `#f4efe2` and dark `#1c140c`; laid over a surface at any
 * strength, the pale ones stand out more on a surface darker than about half way between them and the dark ones on a lighter one, which is a relative luminance of 0.5 in the body's mean colour (`BODIES[id].colour`):
 * Venus, Saturn, Uranus, the Sun, Io and the ice moons get dark letters, and Mars, the Moon, the Earth and Neptune pale ones.
 *
 * @param colour - The body's mean colour, `#rrggbb`.
 * @returns `dark` or `light`.
 *
 * @example
 * ```ts
 * import { BODIES } from "@johnmorrisdotca/wakusei-planets";
 * import { nameTone } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * console.log(nameTone(BODIES.uranus.colour), nameTone(BODIES.mars.colour));
 * ```
 */
export function nameTone(colour: string): "light" | "dark" {
  return luminanceOf(colour) > 0.5 ? "dark" : "light";
}

/**
 * The look a name is drawn in once its tone is settled: `painted` and `etched` (pale letters) become `burned` (dark ones) where the tone is dark, and `burned` becomes `painted` where it is light; `outline`
 * has only one tone and is left alone. The tone is the label's own `tone`, or, for `auto` and for none, the body's (`nameTone`).
 *
 * @param options - The label's look and tone.
 * @param colour - The body's mean colour, `#rrggbb`; left out, `auto` is `light`.
 * @returns The look to draw.
 *
 * @example
 * ```ts
 * import { nameLabelLook } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * console.log(nameLabelLook({ look: "painted" }, "#a9e0e5"), nameLabelLook({ look: "painted", tone: "light" }, "#a9e0e5"));
 * ```
 */
export function nameLabelLook(options: Pick<NameLabelOptions, "look" | "tone">, colour?: string): BodyLabelLook {
  const tone = options.tone === undefined || options.tone === "auto" ? (colour === undefined ? "light" : nameTone(colour)) : options.tone;
  if (options.look === "outline") return "outline";
  if (tone === "dark") return "burned";
  return options.look === "burned" ? "painted" : options.look;
}

/**
 * The text written for a body: its English name in capitals (the family's look), or its Japanese name as it is.
 *
 * @param name - The body's names, as `BODIES[id].name` holds them.
 * @param lang - `en` (the default) or `ja`.
 * @returns The text to write.
 *
 * @example
 * ```ts
 * import { BODIES } from "@johnmorrisdotca/wakusei-planets";
 * import { nameLabelText } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * console.log(nameLabelText(BODIES.earth.name, "en"), nameLabelText(BODIES.earth.name, "ja"));
 * ```
 */
export function nameLabelText(name: { en: string; ja: string }, lang: "en" | "ja" = "en"): string {
  return lang === "ja" ? name.ja : name.en.toUpperCase();
}

/** One string that changes whenever the label would be made differently (the text and every setting): for a host that keeps a still for each state. */
export function nameLabelKey(text: string, options: NameLabelOptions | null | undefined): string {
  if (!options) return "";
  const o = { ...DEFAULTS, ...options };
  return `${text}|${o.look}|${o.tone}|${o.strength}|${o.repeat}|${o.latitude}|${o.facing}|${o.font}|${o.fallbackFont}|${o.size}|${o.minRadiusPx}`;
}

const DEFAULTS: Required<Omit<NameLabelOptions, "look">> = { tone: "auto", strength: 0.5, repeat: "once", latitude: 0, facing: false, font: BODY_LABEL_FONT, fallbackFont: "", size: "medium", minRadiusPx: 24 };

/** The parts of three.js the label needs beyond the bodies': a page that hands over a subset without them gets no label, and a warning once. */
export type LabelParts = Pick<typeof THREE, "CanvasTexture" | "SRGBColorSpace" | "NormalBlending">;
const hasLabelParts = (T: ThreeParts): T is ThreeParts & LabelParts => {
  const parts = T as Partial<LabelParts>;
  return typeof parts.CanvasTexture === "function" && typeof parts.SRGBColorSpace === "string" && typeof parts.NormalBlending === "number";
};
let warned = false;

/** The name is drawn to a canvas: without one (Node, a worker with no `OffscreenCanvas`) there is no label and nothing to draw. */
const canDraw = (): boolean => typeof document !== "undefined" || typeof OffscreenCanvas !== "undefined";

const LABEL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
void main() {
  vUv = uv;
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// lit as the bodies are: the Sun's direction in the scene's axes, a little wrap past the terminator and a little ambient on the night side, so a name on the night side is dark too
const LABEL_FRAGMENT = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uLight;
uniform float uOpacity;
uniform float uAmbient;
uniform float uWrap;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec4 c = texture2D(uMap, vUv);
  float d = dot(normalize(vN), uLight);
  float lit = uAmbient + (1.0 - uAmbient) * clamp((d + uWrap) / (1.0 + uWrap), 0.0, 1.0);
  gl_FragColor = vec4(c.rgb * lit, c.a * uOpacity);
  #include <colorspace_fragment>
}`;

interface LitUniforms {
  uMap: { value: unknown };
  uLight: { value: THREE.Vector3 };
  uOpacity: { value: number };
  uAmbient: { value: number };
  uWrap: { value: number };
}

/** The three.js the shared label is handed: its own, but with a material lit by the bodies' light instead of three's Lambert (the scenes here have no three.js lights). */
function litThree(T: ThreeParts & LabelParts, emissive: boolean): BodyLabelThree & { made: THREE.ShaderMaterial[] } {
  const made: THREE.ShaderMaterial[] = [];
  class LitLabelMaterial extends T.ShaderMaterial {
    constructor(parameters: Record<string, unknown>) {
      const { map, ...rest } = parameters;
      super({
        ...rest,
        vertexShader: LABEL_VERTEX,
        fragmentShader: LABEL_FRAGMENT,
        uniforms: { uMap: { value: map }, uLight: { value: new T.Vector3(0, 0, 1) }, uOpacity: { value: 1 }, uAmbient: { value: emissive ? 1 : 0.06 }, uWrap: { value: 0.08 } } satisfies LitUniforms,
      });
      made.push(this);
    }
  }
  return { ...(T as unknown as BodyLabelThree), MeshLambertMaterial: LitLabelMaterial as unknown as BodyLabelThree["MeshLambertMaterial"], made };
}

/** What `createNameLabel` returns: the group to add to the body's mesh, and the calls the host makes. */
export interface NameLabel {
  /** Add it to the body's turning mesh (a radius-1 sphere whose +z is longitude 0). */
  readonly object: THREE.Group;
  /** The look the name is drawn in now, its tone settled: `painted` (pale letters), `etched`, `outline` or `burned` (dark ones). */
  readonly look: BodyLabelLook;
  /** True once the name is drawn in its font: the host draws its view again when `onReady` is called. */
  readonly ready: boolean;
  /** Before each draw: the camera (for `facing`; left out, the name faces +z), the body's radius on the screen in CSS pixels, and the direction to the light in the scene's axes. Returns true when it hid, showed or turned the name. */
  update(camera: THREE.Camera | undefined, radiusPx: number, light: Vec3): boolean;
  /** New settings or text; the texture is drawn again only when it must be. */
  set(text: string, options: NameLabelOptions): void;
  dispose(): void;
}

const FAR_EYE = { getWorldPosition: (v: { set(x: number, y: number, z: number): unknown }): unknown => v.set(0, 0, 1e6) };
let fontLoad: Promise<string> | undefined;
let fontUrl: string | URL | undefined;

/**
 * Where Michroma is fetched from, for a page whose bundler does not carry kazoku-ui's font file along with its module (the label looks for it next to the module, `fonts/Michroma-Regular.ttf`). Call it before the
 * first name is written. A page that sets `body-label-font` to a font of its own needs nothing here.
 *
 * @param url - The address of `Michroma-Regular.ttf`, with its `OFL.txt` beside it.
 *
 * @example
 * ```ts no-run
 * import { setBodyLabelFontUrl } from "@johnmorrisdotca/wakusei-planets/painter";
 *
 * setBodyLabelFontUrl("/fonts/Michroma-Regular.ttf");
 * ```
 */
export function setBodyLabelFontUrl(url: string | URL): void {
  fontUrl = url;
  fontLoad = undefined;
}

/** Michroma, fetched once from kazoku-ui's own copy (or `setBodyLabelFontUrl`'s), the first time a label in it is made. A fetch that fails leaves the page's sans, and is not tried again. */
const ensureFont = (font: string): Promise<unknown> => (font === BODY_LABEL_FONT && canDraw() ? (fontLoad ??= (fontUrl === undefined ? loadBodyLabelFont() : loadBodyLabelFont(fontUrl)).catch(() => BODY_LABEL_FONT)) : Promise.resolve());

/**
 * Make a body's name label. The group is empty until the font is in (at once when it is already loaded); `onReady` is called when the name is drawn, so the host can draw its view again.
 *
 * @param T - The three.js module the bodies use. Without `CanvasTexture`, `SRGBColorSpace` and `NormalBlending` there is no label, and a warning once.
 * @param text - The name as it is written.
 * @param options - The look and the rest.
 * @param emissive - The body glows (the Sun): the name is lit fully, from no direction.
 * @param onReady - Called when the name is drawn, and again when a new font is in.
 * @param colour - The body's mean colour, `#rrggbb`: with `tone: "auto"` the letters are dark on a light body and pale on a dark one. Left out, they are the look's own.
 */
export function createNameLabel(T: ThreeParts, text: string, options: NameLabelOptions, emissive: boolean, onReady: () => void, colour?: string): NameLabel {
  const group = new T.Group();
  group.name = "name-label";
  // the shared label's frame has longitude 0 along +x and east towards -z; the bodies' has longitude 0 along +z and east along +x: a quarter turn about the pole maps one onto the other
  group.rotation.y = -Math.PI / 2;
  let label: BodyLabel | undefined;
  let materials: THREE.ShaderMaterial[] = [];
  // what the shared label is told: the look with its tone settled (`nameLabelLook`), and no tone of its own
  const shared = (o: NameLabelOptions): Required<Omit<NameLabelOptions, "tone">> => {
    const rest: Partial<Required<NameLabelOptions>> = { ...DEFAULTS, ...withoutUndefined(o) };
    delete rest.tone;
    return { ...(rest as Required<Omit<NameLabelOptions, "tone">>), look: nameLabelLook(o, colour) };
  };
  let wanted = { text, options: shared(options) };
  let disposed = false;
  let ready = false;
  const light = new T.Vector3(0, 0, 1);
  const able = hasLabelParts(T) && canDraw();
  if (!able && !warned && canDraw()) {
    warned = true;
    console.warn("wakusei-planets: the three.js handed over lacks CanvasTexture, SRGBColorSpace or NormalBlending, so a name cannot be written on a body");
  }

  const make = (): void => {
    if (disposed || label !== undefined || !able) return;
    const lit = litThree(T as ThreeParts & LabelParts, emissive);
    label = createBodyLabel(lit, { text: wanted.text, ...wanted.options, radius: 1 });
    materials = lit.made;
    group.add(label.object as unknown as THREE.Object3D);
    void label.ready.then(() => {
      if (disposed) return;
      ready = true;
      onReady();
    });
  };
  void ensureFont(wanted.options.font).then(() => {
    if (!disposed) make();
  });

  return {
    object: group,
    get ready() {
      return ready;
    },
    get look() {
      return wanted.options.look;
    },
    update(camera, radiusPx, toLight) {
      if (label === undefined) return false;
      light.set(toLight[0], toLight[1], toLight[2]);
      for (const m of materials) {
        const u = m.uniforms as unknown as LitUniforms;
        u.uLight.value.copy(light);
        u.uOpacity.value = m.opacity;
      }
      return label.update((camera ?? FAR_EYE) as never, radiusPx);
    },
    set(nextText, next) {
      wanted = { text: nextText, options: shared(next) };
      if (label === undefined) return;
      const fontChanged = wanted.options.font !== label.options.font;
      label.set({ text: wanted.text, ...wanted.options });
      if (fontChanged) void ensureFont(wanted.options.font).then(() => {
        // the shared label repaints only when a setting changed: the new font arriving after the set is told by setting the font again
        if (!disposed && label !== undefined) {
          label.set({ font: "" });
          label.set({ font: wanted.options.font });
          onReady();
        }
      });
    },
    dispose() {
      disposed = true;
      if (label !== undefined) {
        group.remove(label.object as unknown as THREE.Object3D);
        label.dispose();
        label = undefined;
      }
      materials = [];
    },
  };
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
