import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({ id: "charon", surface: rock({ dark: "#756f6a", light: "#aaa29a", craters: 0.7, contrast: 0.7, seed: 41, extra: "col = mix(col, vec3(0.42, 0.20, 0.13), smoothstep(radians(52.0), radians(78.0), lat(p)) * 0.85);" }), relief: 0.6, ambient: 0.02 });
registerLook({ id: "nix", surface: rock({ dark: "#8d8983", light: "#c9c3b9", craters: 1, contrast: 0.7, seed: 43 }), relief: 0.7, ambient: 0.02 });
registerLook({ id: "hydra", surface: rock({ dark: "#9e9a92", light: "#d4cec4", craters: 1, contrast: 0.7, seed: 47 }), relief: 0.7, ambient: 0.02 });
