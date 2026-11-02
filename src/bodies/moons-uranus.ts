import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

registerLook({ id: "miranda", surface: rock({ dark: "#6f6d69", light: "#b3b1ac", craters: 0.8, contrast: 0.8, seed: 9, patches: 4.5, extra: "col = mix(col, col * 1.25, oval(p, 30.0, -55.0, 40.0, 25.0, 0.4) * 0.5);" }), relief: 0.9, ambient: 0.02 });
registerLook({ id: "ariel", surface: rock({ dark: "#8a8883", light: "#c6c3bc", craters: 0.8, contrast: 0.7, seed: 13, patches: 3, extra: "float v = 1.0 - smoothstep(0.0, 0.02, abs(fbm(p * 6.0 + 2.0) - 0.5)); col = mix(col, vec3(0.9), v * 0.35);" }), relief: 0.7, ambient: 0.02 });
registerLook({ id: "umbriel", surface: rock({ dark: "#4f4c49", light: "#7f7c77", craters: 1.2, contrast: 0.9, seed: 16, extra: "col = mix(col, vec3(0.85), (oval(p, 270.0, 8.0, 8.0, 8.0, 0.5) - oval(p, 270.0, 8.0, 4.0, 4.0, 0.5)) * 0.8);" }), relief: 0.8, ambient: 0.02 });
registerLook({ id: "titania", surface: rock({ dark: "#7d7972", light: "#bdb8af", craters: 0.9, contrast: 0.8, seed: 19 }), relief: 0.8, ambient: 0.02 });
registerLook({ id: "oberon", surface: rock({ dark: "#625b55", light: "#9c948b", craters: 1.4, contrast: 0.9, seed: 22 }), relief: 0.85, ambient: 0.02 });
