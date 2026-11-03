import { registerLook } from "../scene/look.ts";
import { ice, rock } from "../scene/recipes.ts";

registerLook({ id: "proteus", surface: rock({ dark: "#45433f", light: "#6f6c68", craters: 1.8, contrast: 0.9, seed: 33 }), relief: 0.9, ambient: 0.02 });
registerLook({
  id: "triton",
  surface: ice({ base: "#e8d8cb", stain: "#8b6f62", craters: 0.2, extra: "col = mix(col, vec3(0.95, 0.88, 0.84), smoothstep(radians(-20.0), radians(-60.0), lat(p)) * 0.8); float cant = fbm(p * 14.0); col *= 0.92 + 0.16 * cant;" }),
  atmosphere: { colour: [0.8, 0.8, 0.9], strength: 0.05, power: 5 },
  ambient: 0.025,
  relief: 0.4,
  painted: { map: "triton", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "nereid", surface: rock({ dark: "#6e6e6e", light: "#9b9b9b", craters: 1, seed: 40 }), relief: 0.8, ambient: 0.02 });
