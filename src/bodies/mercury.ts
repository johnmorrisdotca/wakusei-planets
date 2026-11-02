import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({
  id: "mercury",
  surface: rock({ dark: "#4f4a46", light: "#a6a09a", craters: 0.9, contrast: 0.8, seed: 2, patches: 1.8, extra: "col *= 1.0 + 0.5 * smoothstep(0.05, 0.25, h);" }),
  relief: 0.9,
  ambient: 0.03,
});
