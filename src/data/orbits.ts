// Made by scripts/make-moon-data.py from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/); do not edit by hand.
// The moons of the dwarf planets are not on that page: their orbits are in dwarf.ts, from the papers it cites, and are added at the end.
import { DWARF_MOON_ORBITS } from "./dwarf.ts";

// `sid` is the mean motion in degrees a day (negative: retrograde); `dw` and `dn` are the precession rates of the periapsis and the node, degrees a day.
export interface OrbitElements {
  /** The planet it goes round. */
  parent: string;
  /** The reference plane: the ecliptic, the Earth's equator of J2000, the planet's equator, or the Laplace plane whose pole is `pole` (right ascension, declination, degrees). */
  frame: "ecliptic" | "j2000" | "equatorial" | "laplace";
  pole?: [number, number];
  /** The epoch of the elements, in milliseconds since 1970. */
  epoch: number;
  /** Semi-major axis in km, eccentricity, argument of periapsis, mean anomaly, inclination and node, degrees. */
  a: number; e: number; w: number; m: number; i: number; node: number;
  sid: number; dw: number; dn: number;
}

export const ORBITS: Record<string, OrbitElements> = {
  moon: { parent: "earth", frame: "ecliptic", epoch: 946728000000, a: 384400, e: 0.0554, w: 318.15, m: 135.27, i: 5.16, node: 125.08, sid: 13.1763585, dw: 0.16435, dn: -0.05299 },
  phobos: { parent: "mars", frame: "laplace", pole: [317.7, 52.9], epoch: 946728000000, a: 9375, e: 0.015, w: 216.3, m: 189.7, i: 1.1, node: 169.2, sid: 1128.8443146, dw: -0.74464, dn: -0.42853 },
  deimos: { parent: "mars", frame: "laplace", pole: [316.6, 53.5], epoch: 946728000000, a: 23457, e: 0, w: 0, m: 205, i: 1.8, node: 54.3, sid: 285.1619090, dw: 0.00000, dn: -0.01754 },
  io: { parent: "jupiter", frame: "laplace", pole: [268.1, 64.5], epoch: 946728000000, a: 421800, e: 0.004, w: 49.1, m: 330.9, i: 0, node: 0, sid: 203.4889554, dw: -0.73948, dn: 0.00000 },
  europa: { parent: "jupiter", frame: "laplace", pole: [268.1, 64.5], epoch: 946728000000, a: 671100, e: 0.009, w: 45, m: 345.4, i: 0.5, node: 184, sid: 101.3747246, dw: -0.73952, dn: -0.03263 },
  ganymede: { parent: "jupiter", frame: "laplace", pole: [268.2, 64.6], epoch: 946728000000, a: 1.0704e+06, e: 0.001, w: 198.3, m: 324.8, i: 0.2, node: 58.5, sid: 50.3176092, dw: 0.00000, dn: -0.00715 },
  callisto: { parent: "jupiter", frame: "laplace", pole: [268.7, 64.8], epoch: 946728000000, a: 1.8827e+06, e: 0.007, w: 43.8, m: 87.4, i: 0.3, node: 309.1, sid: 21.5710710, dw: 0.00355, dn: -0.00171 },
  mimas: { parent: "saturn", frame: "laplace", pole: [40.6, 83.5], epoch: 946728000000, a: 186000, e: 0.02, w: 160.4, m: 275.3, i: 1.6, node: 66.2, sid: 381.9945591, dw: 1.99924, dn: -0.99962 },
  enceladus: { parent: "saturn", frame: "laplace", pole: [40.6, 83.5], epoch: 946728000000, a: 238400, e: 0.005, w: 119.5, m: 57, i: 0, node: 0, sid: 262.7319157, dw: 0.33801, dn: 0.00000 },
  tethys: { parent: "saturn", frame: "laplace", pole: [40.6, 83.5], epoch: 946728000000, a: 295000, e: 0.001, w: 335.3, m: 0, i: 1.1, node: 273, sid: 190.6979651, dw: 0.00000, dn: -0.19784 },
  dione: { parent: "saturn", frame: "laplace", pole: [40.6, 83.5], epoch: 946728000000, a: 377700, e: 0.002, w: 116, m: 212, i: 0, node: 0, sid: 131.5349582, dw: 0.00000, dn: 0.00000 },
  rhea: { parent: "saturn", frame: "laplace", pole: [40.6, 83.5], epoch: 946728000000, a: 527200, e: 0.001, w: 44.3, m: 31.5, i: 0.3, node: 133.7, sid: 79.6900941, dw: 0.00000, dn: -0.02755 },
  titan: { parent: "saturn", frame: "laplace", pole: [36.4, 84.0], epoch: 946728000000, a: 1.2219e+06, e: 0.029, w: 78.3, m: 11.7, i: 0.3, node: 78.6, sid: 22.5770144, dw: 0.00284, dn: -0.00143 },
  iapetus: { parent: "saturn", frame: "laplace", pole: [288.7, 78.9], epoch: 946728000000, a: 3.5617e+06, e: 0.028, w: 254.5, m: 74.8, i: 7.6, node: 86.5, sid: 4.5384921, dw: 0.00054, dn: -0.00031 },
  miranda: { parent: "uranus", frame: "equatorial", epoch: 946728000000, a: 129846, e: 0.001, w: 154.8, m: 73, i: 4.4, node: 100.9, sid: 254.6907312, dw: 0.00000, dn: -0.05541 },
  ariel: { parent: "uranus", frame: "equatorial", epoch: 946728000000, a: 190929, e: 0.001, w: 9.6, m: 193.5, i: 0, node: 0, sid: 142.8356608, dw: 0.00000, dn: 0.00000 },
  umbriel: { parent: "uranus", frame: "equatorial", epoch: 946728000000, a: 265986, e: 0.004, w: 183.4, m: 253, i: 0.1, node: 174.8, sid: 86.8688975, dw: 0.01537, dn: -0.00758 },
  titania: { parent: "uranus", frame: "equatorial", epoch: 946728000000, a: 436298, e: 0.002, w: 184, m: 68.1, i: 0.1, node: 29.5, sid: 41.3514243, dw: 0.00000, dn: -0.00060 },
  oberon: { parent: "uranus", frame: "equatorial", epoch: 946728000000, a: 583511, e: 0.002, w: 132.2, m: 143.6, i: 0.1, node: 76.8, sid: 26.7394892, dw: 0.00000, dn: -0.00511 },
  triton: { parent: "neptune", frame: "equatorial", epoch: 946728000000, a: 354800, e: 0, w: 0, m: 63, i: 157.3, node: 177.7, sid: -61.2572645, dw: 0.00000, dn: 0.00329 },
  nereid: { parent: "neptune", frame: "ecliptic", epoch: 1577836800000, a: 5.5139e+06, e: 0.751, w: 296.8, m: 318.5, i: 5.1, node: 319.5, sid: 0.9996218, dw: 0.00012, dn: -0.00010 },
  proteus: { parent: "neptune", frame: "equatorial", epoch: 946728000000, a: 117700, e: 0.001, w: 357.2, m: 297.4, i: 0.6, node: 355.5, sid: 320.7655605, dw: 0.00000, dn: -0.07524 },
  charon: { parent: "pluto", frame: "equatorial", epoch: 946728000000, a: 19600, e: 0, w: 0, m: 304.1, i: 0, node: 0, sid: 56.3624607, dw: 0.00000, dn: 0.00000 },
  nix: { parent: "pluto", frame: "equatorial", epoch: 946728000000, a: 49300, e: 0.015, w: 31.4, m: 338.2, i: 0, node: 0, sid: 14.4842403, dw: 0.00000, dn: 0.00000 },
  hydra: { parent: "pluto", frame: "equatorial", epoch: 946728000000, a: 65200, e: 0.009, w: 139.3, m: 335, i: 0.3, node: 114.3, sid: 9.4236471, dw: 0.00000, dn: -0.07040 },
  ...DWARF_MOON_ORBITS,
};
