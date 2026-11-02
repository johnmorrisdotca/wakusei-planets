// What is known about each body: sizes, tilt, poles and rotation from the IAU Working Group on Cartographic Coordinates and Rotational Elements (Archinal et al., 2018) and NASA's
// planetary fact sheets, plus the few features a line drawing shows. Facts, not artwork: every picture is drawn from these numbers.
/**
 * The planets and the dwarf planet Pluto, nearest the Sun first.
 *
 * @example
 * ```ts
 * import { PLANET_IDS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(PLANET_IDS.join(", "));
 * ```
 */
export const PLANET_IDS = ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const;
/**
 * The moons the package draws, by planet.
 *
 * @example
 * ```ts
 * import { MOONS_OF } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(MOONS_OF.jupiter.join(", "));
 * ```
 */
export const MOONS_OF = {
  earth: ["moon"],
  mars: ["phobos", "deimos"],
  jupiter: ["io", "europa", "ganymede", "callisto"],
  saturn: ["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"],
  uranus: ["miranda", "ariel", "umbriel", "titania", "oberon"],
  neptune: ["proteus", "triton", "nereid"],
  pluto: ["charon", "nix", "hydra"],
} as const;

/**
 * The name of a planet or of Pluto: `mercury` to `pluto`.
 *
 * @example
 * ```ts
 * import { PLANET_IDS, type PlanetId } from "@johnmorrisdotca/wakusei-planets";
 *
 * const id: PlanetId = PLANET_IDS[4];
 * console.log(id);
 * ```
 */
export type PlanetId = (typeof PLANET_IDS)[number];
/**
 * The name of a moon the package draws, such as `moon`, `io` or `titan`.
 *
 * @example
 * ```ts
 * import { MOONS_OF, type MoonId } from "@johnmorrisdotca/wakusei-planets";
 *
 * const id: MoonId = MOONS_OF.saturn[5];
 * console.log(id);
 * ```
 */
export type MoonId = (typeof MOONS_OF)[keyof typeof MOONS_OF][number];
/**
 * The name of a body: `sun`, a planet or a moon.
 *
 * @example
 * ```ts
 * import { lineSvg, type BodyId } from "@johnmorrisdotca/wakusei-planets";
 *
 * const id: BodyId = "mars";
 * console.log(lineSvg(id, { size: 64 }).length > 100);
 * ```
 */
export type BodyId = "sun" | PlanetId | MoonId;
/**
 * How a body is drawn: `line` (an outline drawing), `realistic` (shaded, from the numbers) or `painted` (a real surface map).
 *
 * @example
 * ```ts
 * import { type Look } from "@johnmorrisdotca/wakusei-planets";
 *
 * const looks: Look[] = ["line", "realistic", "painted"];
 * console.log(looks.length);
 * ```
 */
export type Look = "line" | "realistic" | "painted";

/**
 * One band of a ring system, in kilometres from the planet's centre: how much light it stops (`alpha`, 0 to 1) and how bright it is (`tone`, 0 dark, 1 bright).
 *
 * @example
 * ```ts
 * import { BODIES, type RingBand } from "@johnmorrisdotca/wakusei-planets";
 *
 * const bands: readonly RingBand[] = BODIES.saturn.rings ?? [];
 * console.log(bands.length, bands[2]?.from);
 * ```
 */
export interface RingBand {
  from: number;
  to: number;
  alpha: number;
  tone: number;
}

/**
 * A thing a line drawing shows on a body's surface, placed by longitude and latitude in degrees (angular sizes in degrees): a circle, an oval, a band of latitude or a line.
 *
 * @example
 * ```ts
 * import { BODIES, type Feature } from "@johnmorrisdotca/wakusei-planets";
 *
 * const features: readonly Feature[] = BODIES.jupiter.features ?? [];
 * console.log(features.length);
 * ```
 */
export type Feature =
  | { kind: "circle"; lon: number; lat: number; radius: number; fill?: boolean }
  | { kind: "oval"; lon: number; lat: number; rx: number; ry: number; fill?: boolean }
  | { kind: "band"; lat: number }
  | { kind: "line"; points: readonly (readonly [number, number])[]; close?: boolean };

/**
 * The facts of one body: its radius, flattening, axial tilt, pole, prime meridian, rotation, colour, rings and the features a line drawing shows.
 *
 * @example
 * ```ts
 * import { BODIES, type BodyFacts } from "@johnmorrisdotca/wakusei-planets";
 *
 * const uranus: BodyFacts = BODIES.uranus;
 * console.log(uranus.tiltDeg, uranus.rotationHours);
 * ```
 */
export interface BodyFacts {
  id: BodyId;
  kind: "star" | "planet" | "dwarf-planet" | "moon";
  /** The planet a moon goes round. */
  parent?: PlanetId;
  name: { en: string; ja: string };
  /** The equatorial radius in kilometres (a moon's mean radius). */
  radiusKm: number;
  /** (equatorial − polar) / equatorial. */
  flattening: number;
  /** The angle between the spin axis and the orbit's normal, in degrees. Above 90 the spin is backwards. */
  tiltDeg: number;
  /** The north pole's right ascension and declination, J2000, in degrees (IAU). */
  pole: { ra: number; dec: number };
  /** The prime meridian at J2000, in degrees, and how fast it turns, in degrees a day (negative: backwards). */
  prime: { w0: number; rate: number };
  /** The sidereal rotation period in hours; negative when it turns backwards. */
  rotationHours: number;
  /** A moon that always shows the same face to its planet. */
  synchronous?: boolean;
  /** The semi-axes in kilometres along the line to the planet, along the orbit and along the pole, for a moon that is far from round. */
  axesKm?: readonly [number, number, number];
  /** The body's mean colour, `#rrggbb`. */
  colour: string;
  /** The longitude a portrait faces, degrees east: the side with the body's best-known features. */
  showLon?: number;
  rings?: readonly RingBand[];
  features?: readonly Feature[];
}

const f = (id: BodyId, kind: BodyFacts["kind"], en: string, ja: string, radiusKm: number, flattening: number, tiltDeg: number, ra: number, dec: number, w0: number, rate: number, rotationHours: number, colour: string, more: Partial<BodyFacts> = {}): BodyFacts => ({
  id,
  kind,
  name: { en, ja },
  radiusKm,
  flattening,
  tiltDeg,
  pole: { ra, dec },
  prime: { w0, rate },
  rotationHours,
  colour,
  ...more,
});

const bandsAt = (lats: readonly number[]): Feature[] => lats.map((lat) => ({ kind: "band", lat }));
const dots = (list: readonly (readonly [number, number, number])[]): Feature[] => list.map(([lon, lat, radius]) => ({ kind: "circle", lon, lat, radius }));

// The IAU north poles and prime meridians (J2000) are Archinal et al. 2018 (Celestial Mechanics and Dynamical Astronomy 130:22). A moon that keeps one face to its planet is oriented from the geometry, so its own pole is its planet's.
const SATURN_RINGS: readonly RingBand[] = [
  { from: 66900, to: 74510, alpha: 0.05, tone: 0.3 },
  { from: 74658, to: 91975, alpha: 0.25, tone: 0.45 },
  { from: 91975, to: 117507, alpha: 0.85, tone: 0.8 },
  { from: 117507, to: 122340, alpha: 0.06, tone: 0.4 },
  { from: 122340, to: 133570, alpha: 0.55, tone: 0.7 },
  { from: 133610, to: 136775, alpha: 0.5, tone: 0.65 },
  { from: 140100, to: 140260, alpha: 0.35, tone: 0.8 },
];
const URANUS_RINGS: readonly RingBand[] = [
  { from: 41800, to: 41880, alpha: 0.3, tone: 0.2 },
  { from: 42200, to: 42270, alpha: 0.3, tone: 0.2 },
  { from: 42540, to: 42610, alpha: 0.3, tone: 0.2 },
  { from: 44680, to: 44760, alpha: 0.3, tone: 0.2 },
  { from: 45620, to: 45700, alpha: 0.3, tone: 0.2 },
  { from: 47140, to: 47210, alpha: 0.3, tone: 0.2 },
  { from: 47590, to: 47660, alpha: 0.3, tone: 0.2 },
  { from: 48260, to: 48340, alpha: 0.3, tone: 0.2 },
  { from: 51100, to: 51200, alpha: 0.55, tone: 0.3 },
];

/**
 * Every body's facts, by name: sizes, flattening, axial tilt, poles and rotation from the IAU and NASA.
 *
 * @example
 * ```ts
 * import { BODIES } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(BODIES.jupiter.radiusKm, BODIES.venus.rotationHours < 0);
 * ```
 */
export const BODIES: Readonly<Record<BodyId, BodyFacts>> = {
  sun: f("sun", "star", "Sun", "太陽", 695700, 0, 7.25, 286.13, 63.87, 84.176, 14.1844, 609.12, "#ffcf4d", {
    features: [
      { kind: "oval", lon: 20, lat: 14, rx: 7, ry: 4 },
      { kind: "oval", lon: -30, lat: -12, rx: 5, ry: 3 },
      { kind: "circle", lon: 40, lat: -20, radius: 2.5, fill: true },
      { kind: "circle", lon: -5, lat: 18, radius: 3, fill: true },
    ],
  }),
  mercury: f("mercury", "planet", "Mercury", "水星", 2439.7, 0, 0.034, 281.0103, 61.4155, 329.5988, 6.1385108, 1407.6, "#a39b92", {
    features: [...dots([[-30, 20, 9], [35, 35, 6], [60, -25, 7], [-60, -30, 5], [5, -10, 4], [-10, 50, 6], [20, 10, 3], [75, 15, 4], [-80, 10, 4]]), { kind: "circle", lon: 90, lat: 30, radius: 14 }],
  }),
  venus: f("venus", "planet", "Venus", "金星", 6051.8, 0, 177.36, 272.76, 67.16, 160.2, -1.4813688, -5832.5, "#e8cf94", {
    features: [
      { kind: "line", points: [[-90, 40], [-45, 48], [0, 38], [45, 44], [90, 36]] },
      { kind: "line", points: [[-90, 8], [-45, 14], [0, 4], [45, 12], [90, 6]] },
      { kind: "line", points: [[-90, -26], [-45, -20], [0, -30], [45, -22], [90, -28]] },
      { kind: "line", points: [[-90, -58], [-40, -52], [10, -60], [60, -54], [90, -58]] },
    ],
  }),
  earth: f("earth", "planet", "Earth", "地球", 6378.137, 0.00335281, 23.4393, 0, 90, 190.147, 360.9856235, 23.9345, "#3b78c4"),
  mars: f("mars", "planet", "Mars", "火星", 3396.19, 0.00589, 25.19, 317.68143, 52.8865, 176.63, 350.89198226, 24.6229, "#c76a3f", {
    showLon: 75,
    features: [
      { kind: "band", lat: 78 },
      { kind: "band", lat: -82 },
      { kind: "oval", lon: 70, lat: 8, rx: 14, ry: 10, fill: true },
      { kind: "oval", lon: 25, lat: -30, rx: 22, ry: 6, fill: true },
      { kind: "circle", lon: 70, lat: -42, radius: 8 },
      { kind: "circle", lon: -135, lat: 18, radius: 6 },
      { kind: "line", points: [[-90, -8], [-70, -6], [-50, -10], [-30, -5]] },
    ],
  }),
  jupiter: f("jupiter", "planet", "Jupiter", "木星", 71492, 0.06487, 3.13, 268.056595, 64.495303, 284.95, 870.536, 9.925, "#d9b48a", {
    showLon: -20,
    features: [...bandsAt([62, 48, 35, 22, 8, -8, -22, -34, -48, -62]), { kind: "oval", lon: 20, lat: -22, rx: 12, ry: 6 }, { kind: "oval", lon: -70, lat: -33, rx: 3, ry: 2 }],
  }),
  saturn: f("saturn", "planet", "Saturn", "土星", 60268, 0.09796, 26.73, 40.589, 83.537, 38.9, 810.7939024, 10.656, "#e4d09c", {
    rings: SATURN_RINGS,
    features: [...bandsAt([72, 58, 44, 28, 12, -6, -22, -40, -56]), { kind: "line", points: [[0, 78], [60, 78], [120, 78], [180, 78], [240, 78], [300, 78]], close: true }],
  }),
  uranus: f("uranus", "planet", "Uranus", "天王星", 25559, 0.02293, 97.77, 257.311, -15.175, 203.81, -501.1600928, -17.24, "#a9e0e5", { rings: URANUS_RINGS, features: bandsAt([62, 38, 14, -14, -38]) }),
  neptune: f("neptune", "planet", "Neptune", "海王星", 24764, 0.01708, 28.32, 299.36, 43.46, 249.978, 541.1397757, 16.11, "#4a6ee0", {
    showLon: -25,
    features: [...bandsAt([58, 34, 10, -14, -38, -60]), { kind: "oval", lon: -20, lat: -22, rx: 12, ry: 6 }, { kind: "oval", lon: 45, lat: -42, rx: 5, ry: 2.5 }],
  }),
  pluto: f("pluto", "dwarf-planet", "Pluto", "冥王星", 1188.3, 0, 122.53, 132.993, -6.163, 302.695, 56.3625225, -153.2935, "#c9a98a", {
    showLon: 190,
    features: [
      { kind: "line", points: [[165, 5], [175, 22], [188, 30], [200, 24], [208, 12], [196, 4], [190, -10], [176, -18], [166, -8]], close: true },
      { kind: "line", points: [[208, 12], [222, 26], [236, 22], [240, 8], [226, 0], [212, 2]], close: true },
      { kind: "oval", lon: 20, lat: -8, rx: 40, ry: 10, fill: true },
      ...dots([[-60, 20, 6], [-100, -20, 7], [60, 40, 5]]),
    ],
  }),
  moon: f("moon", "moon", "Moon", "月", 1737.4, 0.0012, 6.68, 269.9949, 66.5392, 38.3213, 13.17635815, 655.728, "#b8b5ae", {
    parent: "earth",
    synchronous: true,
    features: [
      { kind: "oval", lon: -20, lat: 32, rx: 14, ry: 10, fill: true },
      { kind: "oval", lon: 18, lat: 28, rx: 8, ry: 7, fill: true },
      { kind: "oval", lon: 30, lat: 8, rx: 10, ry: 8, fill: true },
      { kind: "oval", lon: 58, lat: 17, rx: 6, ry: 5, fill: true },
      { kind: "oval", lon: -58, lat: 8, rx: 18, ry: 22, fill: true },
      { kind: "oval", lon: -14, lat: -22, rx: 8, ry: 7, fill: true },
      { kind: "circle", lon: -11, lat: -43, radius: 3 },
      { kind: "circle", lon: -20, lat: 10, radius: 1.5 },
    ],
  }),
  phobos: f("phobos", "moon", "Phobos", "フォボス", 11.08, 0.1, 0, 317.68143, 52.8865, 35.06, 1128.8445850, 7.65, "#8c8782", { parent: "mars", synchronous: true, axesKm: [13, 11.4, 9.1], features: [{ kind: "circle", lon: 55, lat: 5, radius: 24 }, ...dots([[-30, 20, 9], [10, -35, 7], [120, 15, 8]])] }),
  deimos: f("deimos", "moon", "Deimos", "ダイモス", 6.2, 0.1, 0, 316.65, 53.52, 79.41, 285.161897, 30.3, "#9a948b", { parent: "mars", synchronous: true, axesKm: [7.8, 6, 5.1], features: dots([[-30, 10, 14], [60, -25, 10], [140, 30, 9]]) }),
  io: f("io", "moon", "Io", "イオ", 1821.6, 0, 0, 268.05, 64.5, 200, 203.4889538, 42.46, "#e5d26a", { parent: "jupiter", synchronous: true, features: [...dots([[-30, 20, 5], [40, -10, 4], [120, 30, 4], [-80, -40, 4], [160, -20, 3], [-120, 10, 3]]), { kind: "circle", lon: -10, lat: 10, radius: 11 }] }),
  europa: f("europa", "moon", "Europa", "エウロパ", 1560.8, 0, 0, 268.08, 64.51, 36.022, 101.3747235, 85.23, "#dcd2c0", { parent: "jupiter", synchronous: true, features: [{ kind: "line", points: [[-120, -10], [-60, 8], [0, -4], [50, 16], [110, 4]] }, { kind: "line", points: [[-90, 40], [-30, 24], [40, 36], [100, 20]] }, { kind: "line", points: [[-100, -40], [-40, -26], [30, -42], [90, -30]] }, { kind: "line", points: [[20, 60], [30, 20], [10, -20], [30, -60]] }, { kind: "circle", lon: -70, lat: -10, radius: 7 }] }),
  ganymede: f("ganymede", "moon", "Ganymede", "ガニメデ", 2634.1, 0, 0, 268.2, 64.57, 44.064, 50.3176081, 171.7, "#a09484", { parent: "jupiter", synchronous: true, features: [{ kind: "oval", lon: -140, lat: 20, rx: 40, ry: 55, fill: true }, { kind: "oval", lon: 20, lat: 25, rx: 25, ry: 30, fill: true }, { kind: "oval", lon: 60, lat: -35, rx: 20, ry: 16, fill: true }, { kind: "circle", lon: 128, lat: -22, radius: 6 }, ...bandsAt([62, -62])] }),
  callisto: f("callisto", "moon", "Callisto", "カリスト", 2410.3, 0, 0, 268.72, 64.83, 259.51, 21.5710715, 400.5, "#70675d", { parent: "jupiter", synchronous: true, features: [{ kind: "circle", lon: 55, lat: 15, radius: 8 }, { kind: "circle", lon: 55, lat: 15, radius: 16 }, { kind: "circle", lon: 55, lat: 15, radius: 26 }, ...dots([[-40, 30, 4], [-70, -20, 5], [0, -40, 4], [-20, 5, 3], [100, -30, 4], [-100, 40, 3]])] }),
  mimas: f("mimas", "moon", "Mimas", "ミマス", 198.2, 0.02, 0, 40.66, 83.52, 333.46, 381.994555, 22.6, "#bdbab4", { parent: "saturn", synchronous: true, features: [{ kind: "circle", lon: -60, lat: 0, radius: 33 }, ...dots([[30, 30, 12], [60, -25, 10], [-130, 40, 9], [120, 5, 10], [10, -50, 9]])] }),
  enceladus: f("enceladus", "moon", "Enceladus", "エンケラドス", 252.1, 0.003, 0, 40.66, 83.52, 6.32, 262.7318996, 32.9, "#f1f4f6", { parent: "saturn", synchronous: true, features: [{ kind: "line", points: [[-40, -72], [-20, -76], [0, -78], [20, -76], [40, -72]] }, { kind: "line", points: [[-30, -66], [-10, -70], [10, -70], [30, -66]] }, ...dots([[-60, 20, 8], [60, 30, 7], [110, -10, 6]])] }),
  tethys: f("tethys", "moon", "Tethys", "テティス", 531.1, 0.001, 0, 40.66, 83.52, 8.95, 190.6979085, 45.3, "#d6d3ce", { parent: "saturn", synchronous: true, features: [{ kind: "circle", lon: 140, lat: 10, radius: 22 }, { kind: "line", points: [[-180, 0], [-120, 4], [-60, -2], [0, 3], [60, -3]] }, ...dots([[-40, 30, 7], [30, -30, 6], [70, 40, 5]])] }),
  dione: f("dione", "moon", "Dione", "ディオネ", 561.4, 0.002, 0, 40.66, 83.52, 357.0, 131.5349316, 65.7, "#cfcdc7", { parent: "saturn", synchronous: true, features: [{ kind: "line", points: [[-150, 20], [-120, 12], [-100, 30], [-60, 18]] }, { kind: "line", points: [[-170, -20], [-130, -28], [-90, -18]] }, ...dots([[10, 10, 9], [50, -30, 7], [90, 30, 6], [-20, -45, 6]])] }),
  rhea: f("rhea", "moon", "Rhea", "レア", 763.8, 0.001, 0, 40.38, 83.55, 235.16, 79.6900478, 108.4, "#c7c4be", { parent: "saturn", synchronous: true, features: [...dots([[-60, 15, 10], [20, -30, 9], [60, 40, 8], [110, -10, 9], [-20, 50, 7], [-100, -25, 8], [160, 20, 7]])] }),
  titan: f("titan", "moon", "Titan", "タイタン", 2574.7, 0, 0, 36.41, 83.94, 189.64, 22.5769768, 382.69, "#dba84a", { parent: "saturn", synchronous: true, features: [...bandsAt([60, 30, 0, -30, -60]), { kind: "oval", lon: 0, lat: 85, rx: 60, ry: 6 }] }),
  iapetus: f("iapetus", "moon", "Iapetus", "イアペトゥス", 734.3, 0.02, 0, 318.16, 75.03, 355.2, 4.5379572, 1903.7, "#a89f93", { parent: "saturn", synchronous: true, features: [{ kind: "line", points: [[-90, -85], [-90, -40], [-90, 0], [-90, 40], [-90, 85]] }, { kind: "line", points: [[90, -85], [90, -40], [90, 0], [90, 40], [90, 85]] }, { kind: "oval", lon: 0, lat: 0, rx: 100, ry: 25, fill: true }, { kind: "line", points: [[-180, 0], [-120, 0], [-60, 0], [0, 0], [60, 0], [120, 0]], close: true }] }),
  miranda: f("miranda", "moon", "Miranda", "ミランダ", 235.8, 0, 0, 257.43, -15.08, 30.7, 254.6906924, 33.9, "#b8b5b0", { parent: "uranus", synchronous: true, features: [{ kind: "oval", lon: 30, lat: -60, rx: 40, ry: 20, fill: true }, { kind: "circle", lon: -30, lat: 10, radius: 20 }, { kind: "line", points: [[60, 30], [75, 5], [80, -20]] }, ...dots([[-80, -30, 8], [100, 40, 7]])] }),
  ariel: f("ariel", "moon", "Ariel", "アリエル", 578.9, 0, 0, 257.43, -15.1, 156.22, 142.8356681, 60.5, "#bcb9b3", { parent: "uranus", synchronous: true, features: [{ kind: "line", points: [[-80, 20], [-50, 8], [-20, 26], [10, 10]] }, { kind: "line", points: [[40, -20], [70, -34], [100, -20]] }, { kind: "oval", lon: -10, lat: -30, rx: 30, ry: 12, fill: true }, ...dots([[60, 30, 7], [-100, 0, 6]])] }),
  umbriel: f("umbriel", "moon", "Umbriel", "ウンブリエル", 584.7, 0, 0, 257.43, -15.1, 108.05, 86.8688923, 99.5, "#807d79", { parent: "uranus", synchronous: true, features: [{ kind: "circle", lon: 50, lat: 85, radius: 8 }, { kind: "circle", lon: 80, lat: 80, radius: 14, fill: false }, ...dots([[-70, 20, 8], [20, -30, 9], [-20, 40, 7], [110, -10, 7]])] }),
  titania: f("titania", "moon", "Titania", "ティタニア", 788.9, 0, 0, 257.43, -15.1, 77.74, 41.3514246, 208.9, "#aaa59d", { parent: "uranus", synchronous: true, features: [{ kind: "line", points: [[-120, -10], [-80, -30], [-40, -10], [0, -34]] }, { kind: "line", points: [[-60, 36], [-20, 20], [20, 40]] }, ...dots([[40, 20, 9], [80, -25, 8], [-100, 30, 7]])] }),
  oberon: f("oberon", "moon", "Oberon", "オベロン", 761.4, 0, 0, 257.43, -15.1, 6.77, 26.7394932, 323.1, "#918981", { parent: "uranus", synchronous: true, features: [{ kind: "circle", lon: 40, lat: -15, radius: 12 }, ...dots([[-60, 20, 9], [90, 30, 8], [-110, -25, 8], [10, 45, 7]])] }),
  proteus: f("proteus", "moon", "Proteus", "プロテウス", 210, 0.1, 0, 299.36, 43.36, 93.38, 320.7654228, 26.9, "#6e6c6a", { parent: "neptune", synchronous: true, axesKm: [218, 208, 201], features: [{ kind: "circle", lon: 0, lat: -5, radius: 28 }, ...dots([[60, 30, 10], [-70, 20, 9], [110, -20, 8]])] }),
  triton: f("triton", "moon", "Triton", "トリトン", 1353.4, 0, 0, 299.36, 41.17, 296.53, -61.2572638, -141.04, "#cdbbac", { parent: "neptune", synchronous: true, features: [{ kind: "band", lat: -30 }, { kind: "oval", lon: 20, lat: -70, rx: 80, ry: 25, fill: true }, ...dots([[-40, -40, 3], [10, -45, 3], [50, -35, 3], [100, -42, 3]])] }),
  nereid: f("nereid", "moon", "Nereid", "ネレイド", 178.5, 0, 0, 299.36, 43.46, 0, 0, 0, "#9b9b9b", { parent: "neptune", features: dots([[-40, 20, 12], [50, -20, 10]]) }),
  charon: f("charon", "moon", "Charon", "カロン", 606, 0, 0, 132.993, -6.163, 122.695, 56.3625225, 153.2935, "#9c9189", { parent: "pluto", synchronous: true, features: [{ kind: "oval", lon: 0, lat: 76, rx: 90, ry: 14, fill: true }, { kind: "circle", lon: 40, lat: -15, radius: 12 }, ...dots([[-60, 10, 8], [120, 30, 7]])] }),
  nix: f("nix", "moon", "Nix", "ニクス", 19.3, 0.3, 0, 132.993, -6.163, 0, 14.48, 0, "#b3ada7", { parent: "pluto", axesKm: [24.9, 16.6, 15.6], features: [{ kind: "circle", lon: 0, lat: 0, radius: 18 }] }),
  hydra: f("hydra", "moon", "Hydra", "ヒドラ", 19.5, 0.4, 0, 132.993, -6.163, 0, 9.42, 0, "#c4beb6", { parent: "pluto", axesKm: [32.5, 22.5, 12.5], features: [{ kind: "circle", lon: 30, lat: 10, radius: 20 }] }),
};

/**
 * Every body's name: the Sun, the planets outward, then the moons of each planet.
 *
 * @example
 * ```ts
 * import { BODY_IDS } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(BODY_IDS.length, BODY_IDS[0]);
 * ```
 */
export const BODY_IDS: readonly BodyId[] = ["sun", ...PLANET_IDS, ...Object.values(MOONS_OF).flat()];

/** A body's polar radius as a fraction of its equatorial radius. */
export const polarRatio = (facts: BodyFacts): number => 1 - facts.flattening;

/**
 * The ring system's outer edge in body radii, or 1 for a body with no rings.
 * @param facts - A body's facts.
 * @returns The outer edge of its rings in body radii; `1` when it has no rings.
 *
 * @example
 * ```ts
 * import { BODIES, ringReach } from "@johnmorrisdotca/wakusei-planets";
 *
 * console.log(ringReach(BODIES.saturn).toFixed(2), ringReach(BODIES.mars));
 * ```
 */
export const ringReach = (facts: BodyFacts): number => (facts.rings === undefined ? 1 : Math.max(...facts.rings.map((band) => band.to)) / facts.radiusKm);
