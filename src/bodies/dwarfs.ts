import { registerLook } from "../scene/look.ts";
import { ice, rock } from "../scene/recipes.ts";

registerLook({
  id: "ceres",
  surface: rock({
    dark: "#4d4a47",
    light: "#7e7a75",
    craters: 1.4,
    contrast: 0.8,
    seed: 61,
    patches: 3,
    extra: `
    float occ = oval(p, 239.0, 19.8, 3.4, 3.4, 0.5);
    col = mix(col, vec3(0.93, 0.93, 0.92), occ * 0.95);`,
  }),
  relief: 0.7,
  ambient: 0.02,
  painted: { map: "ceres", widths: [512, 1024, 2048], far: 2048 },
  mapped: true,
});
registerLook({ id: "orcus", surface: rock({ dark: "#6f7074", light: "#a9a9ab", craters: 0.5, contrast: 0.5, seed: 63, patches: 2.2 }), relief: 0.5, ambient: 0.02 });
registerLook({
  id: "haumea",
  surface: ice({ base: "#e4e5e8", stain: "#bfc0c4", craters: 0.08, extra: "col = mix(col, vec3(0.50, 0.17, 0.12), oval(p, 40.0, 5.0, 24.0, 13.0, 0.5) * 0.85);" }),
  relief: 0.3,
  ambient: 0.02,
});
registerLook({ id: "quaoar", surface: rock({ dark: "#7d5844", light: "#b58b72", craters: 0.35, contrast: 0.4, seed: 65, patches: 2.4 }), relief: 0.5, ambient: 0.02 });
registerLook({ id: "makemake", surface: rock({ dark: "#8e5a3c", light: "#cf9a76", craters: 0.12, contrast: 0.3, seed: 67, patches: 2.8, extra: "col = mix(col, vec3(0.45, 0.25, 0.17), oval(p, 30.0, 10.0, 34.0, 20.0, 0.45) * 0.5);" }), relief: 0.35, ambient: 0.02 });
registerLook({ id: "gonggong", surface: rock({ dark: "#6e3524", light: "#a9604a", craters: 0.3, contrast: 0.4, seed: 69, patches: 2.5 }), relief: 0.5, ambient: 0.02 });
registerLook({ id: "eris", surface: ice({ base: "#ece8e0", stain: "#cdc6ba", craters: 0.06 }), atmosphere: { colour: [0.9, 0.9, 0.95], strength: 0.03, power: 5 }, relief: 0.2, ambient: 0.02 });
registerLook({ id: "sedna", surface: rock({ dark: "#6a2a1b", light: "#a24b34", craters: 0.2, contrast: 0.3, seed: 71, patches: 2.6 }), relief: 0.4, ambient: 0.02 });
