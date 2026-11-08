// Made by scripts/make-moon-data.py: the Moon from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/), every other moon fitted to JPL Horizons' positions for 1800 to 2199; do not edit by hand.
// The moons of the dwarf planets other than Pluto's are not in either: their orbits are in dwarf.ts, from the papers it cites, and are added at the end.
import { DWARF_MOON_ORBITS } from "./dwarf.ts";

// `sid` is the mean longitude's rate in degrees a day; `dw` and `dn` are the precession rates of the periapsis and the node, degrees a day.
export interface OrbitElements {
  /** The planet it goes round. */
  parent: string;
  /** The reference plane: the ecliptic, the Earth's equator of J2000, the planet's equator, or the plane whose pole is `pole` (right ascension, declination, degrees). */
  frame: "ecliptic" | "j2000" | "equatorial" | "laplace";
  pole?: [number, number];
  /** The epoch of the elements, in milliseconds since 1970. */
  epoch: number;
  /** Semi-major axis in km, eccentricity, argument of periapsis, mean anomaly, inclination and node, degrees. */
  a: number; e: number; w: number; m: number; i: number; node: number;
  sid: number; dw: number; dn: number;
  /** The mean longitude's acceleration, degrees a day squared (Phobos, whose orbit is shrinking). */
  acc?: number;
  /** A swing in the mean longitude: its amplitude in degrees, its period in days and its phase in degrees (Mimas and Tethys, in resonance). */
  wave?: [number, number, number];
}

export const ORBITS: Record<string, OrbitElements> = {
  moon: { parent: "earth", frame: "ecliptic", epoch: 946728000000, a: 384400, e: 0.0554, w: 318.15, m: 135.27, i: 5.16, node: 125.08, sid: 13.1763585, dw: 0.16435, dn: -0.05299 },
  phobos: { parent: "mars", frame: "laplace", pole: [317.7000, 52.9000], epoch: 946728000000, a: 9379, e: 0.015119, w: 216.4977, m: 190.1997, i: 1.0774, node: 169.1169, sid: 1128.8447638, dw: 0.870973, dn: -0.435790, acc: 1.8810e-08 },
  deimos: { parent: "mars", frame: "laplace", pole: [316.6000, 53.5000], epoch: 946728000000, a: 23459, e: 0.000272, w: 195.2788, m: 9.9280, i: 1.8013, node: 54.3960, sid: 285.1618893, dw: 0.036016, dn: -0.018069 },
  io: { parent: "jupiter", frame: "laplace", pole: [268.1000, 64.5000], epoch: 946728000000, a: 422050, e: 0.004180, w: 148.5870, m: 330.9876, i: 0.0389, node: 260.4378, sid: 203.4889597, dw: -0.606701, dn: -0.132808 },
  europa: { parent: "jupiter", frame: "laplace", pole: [268.1000, 64.5000], epoch: 946728000000, a: 671278, e: 0.009365, w: 45.0131, m: 345.4922, i: 0.4649, node: 184.0137, sid: 101.3747250, dw: -0.706875, dn: -0.032634 },
  ganymede: { parent: "jupiter", frame: "laplace", pole: [268.2000, 64.6000], epoch: 946728000000, a: 1070705, e: 0.001614, w: 46.1946, m: 117.5598, i: 0.1903, node: 57.9276, sid: 50.3176077, dw: -0.122518, dn: -0.007126 },
  callisto: { parent: "jupiter", frame: "laplace", pole: [268.7000, 64.8000], epoch: 946728000000, a: 1883240, e: 0.007373, w: 44.4316, m: 87.3746, i: 0.2475, node: 308.5920, sid: 21.5710727, dw: 0.003690, dn: -0.001851 },
  mimas: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 186020, e: 0.019682, w: 332.6162, m: 14.7362, i: 1.5759, node: 172.9916, sid: 381.9944922, dw: 2.000419, dn: -0.999500, wave: [43.360, 25631.1, 140.77] },
  enceladus: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 238411, e: 0.004863, w: 347.2062, m: 10.8783, i: 0.0376, node: 184.3153, sid: 262.7318996, dw: 0.337757, dn: 0.000206 },
  tethys: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 294976, e: 0.001030, w: 300.5426, m: 348.0806, i: 1.0922, node: 259.8208, sid: 190.6979127, dw: 1.005649, dn: -0.197849, wave: [2.079, 25631.1, -38.90] },
  dione: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 377651, e: 0.002240, w: 23.6277, m: 322.2544, i: 0.0468, node: 191.0740, sid: 131.5349315, dw: 0.083977, dn: 0.000274 },
  rhea: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 527235, e: 0.001009, w: 213.5465, m: 207.7724, i: 0.3372, node: 350.8591, sid: 79.6900466, dw: 0.028925, dn: -0.027520 },
  titan: { parent: "saturn", frame: "laplace", pole: [36.4000, 84.0000], epoch: 946728000000, a: 1222236, e: 0.028878, w: 182.8975, m: 163.2808, i: 0.3344, node: 25.5528, sid: 22.5769762, dw: 0.002727, dn: -0.001324 },
  iapetus: { parent: "saturn", frame: "laplace", pole: [288.7000, 78.9000], epoch: 946728000000, a: 3561733, e: 0.028566, w: 275.7198, m: 209.3991, i: 7.5910, node: 74.9006, sid: 4.5379489, dw: 0.000599, dn: -0.000314 },
  miranda: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 129874, e: 0.001370, w: 154.8103, m: 72.7773, i: 4.4274, node: 100.8573, sid: 254.6906627, dw: 0.110266, dn: -0.055413 },
  ariel: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 190949, e: 0.001406, w: 14.6840, m: 117.9260, i: 0.0276, node: 70.5897, sid: 142.8356533, dw: 0.038335, dn: -0.021279, acc: -4.5011e-10 },
  umbriel: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 266003, e: 0.003890, w: 183.1711, m: 255.7500, i: 0.0862, node: 172.3446, sid: 86.8688746, dw: 0.015401, dn: -0.007613 },
  titania: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 436315, e: 0.001582, w: 146.8303, m: 104.0204, i: 0.1313, node: 30.7310, sid: 41.3514151, dw: -0.491945, dn: -0.000752 },
  oberon: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 583539, e: 0.001617, w: 283.8793, m: 43.4715, i: 0.1409, node: 25.2251, sid: 26.7394825, dw: -0.547716, dn: -0.000404 },
  triton: { parent: "neptune", frame: "laplace", pole: [119.3600, -43.4600], epoch: 946728000000, a: 354841, e: 0.000247, w: 242.5418, m: 356.0407, i: 23.1259, node: 182.1782, sid: 61.2572608, dw: -2.038006, dn: -0.001436 },
  nereid: { parent: "neptune", frame: "laplace", pole: [262.9670, 62.5306], epoch: 946728000000, a: 5515142, e: 0.750637, w: 33.5592, m: 216.7074, i: 0.4751, node: 228.9244, sid: 0.9996299, dw: -0.075681, dn: 0.075699, wave: [0.555, 29462.3, -82.66] },
  proteus: { parent: "neptune", frame: "laplace", pole: [299.3600, 43.4600], epoch: 946728000000, a: 117674, e: 0.000518, w: 18.0840, m: 257.0336, i: 0.9980, node: 359.1578, sid: 320.7656368, dw: 0.075705, dn: 0.001336 },
  charon: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 19594, e: 0.000170, w: 145.5839, m: 148.8112, i: 0.0832, node: 9.7573, sid: 56.3625307, dw: -0.000061, dn: 0.000064 },
  nix: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 49331, e: 0.015290, w: 307.1081, m: 135.3103, i: 0.0847, node: 9.7013, sid: 14.4841691, dw: -0.574755, dn: 0.000064 },
  hydra: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 65177, e: 0.008508, w: 152.6898, m: 325.4937, i: 0.2857, node: 114.7977, sid: 9.4235842, dw: 3.910425, dn: -0.070598 },
  ...DWARF_MOON_ORBITS,
};
