import type { BodyFacts } from "../facts.ts";
import type { BodyLook } from "./look.ts";

/** A body that has no registered look is still drawn: a lit ball in its mean colour. */
export function fallbackLook(facts: BodyFacts): BodyLook {
  const c = [1, 3, 5].map((i) => (parseInt(facts.colour.slice(i, i + 2), 16) / 255).toFixed(3)).join(", ");
  return { id: facts.id, surface: `vec4 surface(vec3 p) { float n = fbm(p * 5.0); return vec4(vec3(${c}) * (0.85 + 0.3 * n), 0.0); }` };
}
