import { registerLook } from "../scene/look.ts";
import { cloud, ice, rock } from "../scene/recipes.ts";

registerLook({ id: "mimas", surface: rock({ dark: "#7f7d79", light: "#bebcb7", craters: 1.7, contrast: 1, seed: 6, extra: "float hs = bowl(p, -110.0, 0.0, 33.0, 0.7); h += hs; col *= 1.0 + 0.9 * hs;" }), relief: 1, ambient: 0.02, painted: { map: "mimas", widths: [512, 1024, 2048], far: 2048 } });
registerLook({
  id: "enceladus",
  surface: ice({ base: "#f4f7fa", stain: "#c3cfd9", craters: 0.35, extra: "float tiger = oval(p, 0.0, -80.0, 170.0, 14.0, 0.5) * (1.0 - smoothstep(0.0, 0.04, abs(fbm(p * vec3(4.0, 4.0, 14.0)) - 0.5))); col = mix(col, vec3(0.45, 0.72, 0.85), tiger * 0.85);" }),
  ambient: 0.03,
  relief: 0.3,
  painted: { map: "enceladus", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "tethys", surface: rock({ dark: "#8f8d88", light: "#d0cec9", craters: 1.2, contrast: 0.9, seed: 14, patches: 2.2, extra: "float od = bowl(p, 232.0, 5.0, 24.0, 0.6); h += od; col *= 1.0 + 0.7 * od;" }), relief: 0.8, ambient: 0.02 });
registerLook({ id: "dione", surface: rock({ dark: "#8c8a85", light: "#cdcbc5", craters: 1, contrast: 0.9, seed: 18, patches: 2.6 }), relief: 0.8, ambient: 0.02 });
registerLook({ id: "rhea", surface: rock({ dark: "#8a8883", light: "#cac8c2", craters: 1.5, contrast: 0.9, seed: 24, patches: 2 }), relief: 0.85, ambient: 0.02, painted: { map: "rhea", widths: [512, 1024, 2048], far: 2048 } });
registerLook({
  id: "titan",
  surface: cloud({ light: "#ecbe6c", dark: "#b8802f", swirl: 0.7 }),
  atmosphere: { colour: [0.92, 0.66, 0.3], strength: 0.65, power: 2.3 },
  limb: 0.3,
  ambient: 0.06,
  painted: { map: "titan", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({
  id: "iapetus",
  surface: rock({
    dark: "#7e7a73",
    light: "#d9d6d0",
    craters: 1,
    contrast: 0.8,
    seed: 30,
    extra: "float lead = smoothstep(-0.15, 0.35, cos(lon(p) + 1.5708)) * (1.0 - smoothstep(0.75, 0.95, abs(lat(p)) / 1.5708 * 1.2)); col = mix(col, vec3(0.20, 0.15, 0.12), lead * 0.9);",
  }),
  relief: 0.7,
  ambient: 0.02,
});
