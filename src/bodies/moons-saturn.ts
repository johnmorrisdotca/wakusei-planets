import { registerLook } from "../scene/look.ts";
import { cloud, ice, rock } from "../scene/recipes.ts";

registerLook({ id: "mimas", surface: rock({ dark: "#7f7d79", light: "#bebcb7", craters: 1.7, contrast: 1, seed: 6, extra: "float hs = bowl(p, -110.0, 0.0, 33.0, 0.7); h += hs; hr += hs; col *= 1.0 + 0.9 * hs;" }), relief: 1, ambient: 0.02, painted: { map: "mimas", widths: [512, 1024, 2048], far: 2048 } });
registerLook({
  id: "enceladus",
  surface: ice({ base: "#f4f7fa", stain: "#c3cfd9", craters: 0.35, extra: "float tiger = oval(p, 0.0, -80.0, 170.0, 14.0, 0.5) * (1.0 - smoothstep(0.0, 0.04, abs(fbm(p * vec3(4.0, 4.0, 14.0)) - 0.5))); col = mix(col, vec3(0.45, 0.72, 0.85), tiger * 0.85);" }),
  ambient: 0.03,
  relief: 0.3,
  painted: { map: "enceladus", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "tethys", surface: rock({ dark: "#8f8d88", light: "#d0cec9", craters: 1.2, contrast: 0.9, seed: 14, patches: 2.2, extra: "float od = bowl(p, 232.0, 5.0, 24.0, 0.6); h += od; hr += od; col *= 1.0 + 0.7 * od;" }), relief: 0.8, ambient: 0.02, painted: { map: "tethys", widths: [512, 1024, 2048], far: 2048 } });
registerLook({ id: "dione", surface: rock({ dark: "#8c8a85", light: "#cdcbc5", craters: 1, contrast: 0.9, seed: 18, patches: 2.6 }), relief: 0.8, ambient: 0.02, painted: { map: "dione", widths: [512, 1024, 2048], far: 2048 } });
registerLook({ id: "rhea", surface: rock({ dark: "#8a8883", light: "#cac8c2", craters: 1.5, contrast: 0.9, seed: 24, patches: 2 }), relief: 0.85, ambient: 0.02, painted: { map: "rhea", widths: [512, 1024, 2048], far: 2048 } });
registerLook({
  id: "titan",
  surface: cloud({ light: "#ecbe6c", dark: "#b8802f", swirl: 0.7 }),
  atmosphere: { colour: [0.92, 0.66, 0.3], strength: 1, power: 2.3 },
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
  painted: { map: "iapetus", widths: [512, 1024, 2048], far: 2048 },
});
registerLook({ id: "hyperion", surface: rock({ dark: "#6f5d4d", light: "#b9a58f", craters: 2.4, contrast: 1.1, seed: 54 }), relief: 0.9, ambient: 0.02, shape: () => import("../data/shapes/hyperion.ts").then((m) => m.SHAPE_HYPERION) });
registerLook({ id: "janus", surface: rock({ dark: "#8c8982", light: "#cdc9c1", craters: 1.4, contrast: 0.8, seed: 55 }), relief: 0.8, ambient: 0.02, shape: () => import("../data/shapes/janus.ts").then((m) => m.SHAPE_JANUS) });
registerLook({ id: "epimetheus", surface: rock({ dark: "#8e8b84", light: "#cfcbc3", craters: 1.5, contrast: 0.8, seed: 56 }), relief: 0.8, ambient: 0.02, shape: () => import("../data/shapes/epimetheus.ts").then((m) => m.SHAPE_EPIMETHEUS) });
registerLook({ id: "prometheus", surface: rock({ dark: "#9a978f", light: "#d6d3cc", craters: 0.7, contrast: 0.6, seed: 57 }), relief: 0.6, ambient: 0.02, shape: () => import("../data/shapes/prometheus.ts").then((m) => m.SHAPE_PROMETHEUS) });
registerLook({ id: "pandora", surface: rock({ dark: "#97948d", light: "#d4d1ca", craters: 0.8, contrast: 0.6, seed: 58 }), relief: 0.6, ambient: 0.02, shape: () => import("../data/shapes/pandora.ts").then((m) => m.SHAPE_PANDORA) });
registerLook({ id: "atlas", surface: rock({ dark: "#a3a099", light: "#dbd8d2", craters: 0.2, contrast: 0.4, seed: 59 }), relief: 0.3, ambient: 0.02, shape: () => import("../data/shapes/atlas.ts").then((m) => m.SHAPE_ATLAS) });
registerLook({ id: "pan", surface: rock({ dark: "#a4a19a", light: "#dcd9d3", craters: 0.2, contrast: 0.4, seed: 60 }), relief: 0.3, ambient: 0.02, shape: () => import("../data/shapes/pan.ts").then((m) => m.SHAPE_PAN) });
registerLook({ id: "daphnis", surface: rock({ dark: "#a4a19a", light: "#dcd9d3", craters: 0.2, contrast: 0.4, seed: 61 }), relief: 0.3, ambient: 0.02, shape: () => import("../data/shapes/daphnis.ts").then((m) => m.SHAPE_DAPHNIS) });
registerLook({ id: "helene", surface: rock({ dark: "#9d9a93", light: "#d7d4cd", craters: 0.7, contrast: 0.6, seed: 62 }), relief: 0.6, ambient: 0.02, shape: () => import("../data/shapes/helene.ts").then((m) => m.SHAPE_HELENE) });
registerLook({ id: "telesto", surface: rock({ dark: "#b5b2ac", light: "#ebe9e5", craters: 0.5, contrast: 0.5, seed: 63 }), relief: 0.5, ambient: 0.02, shape: () => import("../data/shapes/telesto.ts").then((m) => m.SHAPE_TELESTO) });
registerLook({ id: "calypso", surface: rock({ dark: "#aeaba5", light: "#e2e0dc", craters: 0.5, contrast: 0.5, seed: 64 }), relief: 0.5, ambient: 0.02, shape: () => import("../data/shapes/calypso.ts").then((m) => m.SHAPE_CALYPSO) });
registerLook({ id: "phoebe", surface: rock({ dark: "#383634", light: "#7b7874", craters: 2, contrast: 1.1, seed: 65 }), relief: 1, ambient: 0.02, painted: { map: "phoebe", widths: [512, 1024, 2048], far: 2048, credit: "NASA/JPL/Space Science Institute, Cassini ISS mosaic of Phoebe (DLR and the ISS team)" }, mapped: true, shape: () => import("../data/shapes/phoebe.ts").then((m) => m.SHAPE_PHOEBE) });
