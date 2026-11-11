import { registerLook } from "../scene/look.ts";
import { rock } from "../scene/recipes.ts";

// The minor bodies, drawn from their numbers: a rock of the body's colour with craters. Vesta has Dawn's own map as its painted look; the others have never been seen as more than a few pixels
// (Halley's nucleus was photographed by the Giotto probe in 1986, a picture whose terms keep it out of this package), so their craters and patches are made up.
registerLook({
  id: "vesta",
  surface: rock({ dark: "#7d776d", light: "#bdb6aa", craters: 1.5, contrast: 0.9, seed: 81, patches: 3 }),
  relief: 0.8,
  ambient: 0.02,
  painted: { map: "vesta", widths: [512, 1024, 2048], far: 2048 },
  mapped: true,
});
registerLook({ id: "pallas", surface: rock({ dark: "#5e6064", light: "#92949a", craters: 1.2, contrast: 0.8, seed: 83, patches: 2.6 }), relief: 0.7, ambient: 0.02 });
registerLook({ id: "chiron", surface: rock({ dark: "#6f7073", light: "#a5a6a9", craters: 0.9, contrast: 0.7, seed: 85, patches: 2.4 }), relief: 0.6, ambient: 0.02 });
registerLook({ id: "pholus", surface: rock({ dark: "#6b3524", light: "#a85c42", craters: 0.9, contrast: 0.7, seed: 87, patches: 2.6 }), relief: 0.6, ambient: 0.02 });
registerLook({ id: "halley", surface: rock({ dark: "#25221f", light: "#4a4541", craters: 0.8, contrast: 0.9, seed: 89, patches: 3.2 }), relief: 0.9, ambient: 0.02 });
