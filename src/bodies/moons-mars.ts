import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({ id: "phobos", surface: rock({ dark: "#4d4844", light: "#8a847d", craters: 2, contrast: 1.2, seed: 8, extra: "h += bowl(p, -49.0, 1.0, 22.0, 0.45); col *= 1.0 + 0.5 * bowl(p, -49.0, 1.0, 22.0, 0.45);" }), relief: 1, ambient: 0.02 });
registerLook({ id: "deimos", surface: rock({ dark: "#6d665f", light: "#a39a8f", craters: 0.9, contrast: 0.6, seed: 4, patches: 3 }), relief: 0.7, ambient: 0.02 });
