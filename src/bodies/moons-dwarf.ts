import { registerLook } from "../scene/look.ts";
import { ice, rock } from "../scene/recipes.ts";

registerLook({ id: "dysnomia", surface: rock({ dark: "#3f3d3b", light: "#6c6967", craters: 1.2, contrast: 0.8, seed: 73 }), relief: 0.8, ambient: 0.02 });
registerLook({ id: "hiiaka", surface: ice({ base: "#e6e6e6", stain: "#c4c4c4", craters: 0.25 }), relief: 0.6, ambient: 0.02 });
registerLook({ id: "namaka", surface: ice({ base: "#d8d8d8", stain: "#b4b4b4", craters: 0.25 }), relief: 0.6, ambient: 0.02 });
registerLook({ id: "vanth", surface: rock({ dark: "#55514d", light: "#827d78", craters: 1.2, contrast: 0.8, seed: 75 }), relief: 0.8, ambient: 0.02 });
