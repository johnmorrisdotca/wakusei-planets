// Made by scripts/make-moon-data.py: the Moon from JPL's Planetary Satellite Mean Elements (https://ssd.jpl.nasa.gov/sats/elem/), every other moon fitted to JPL Horizons' positions for 1950 to 2050; do not edit by hand.
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
  phobos: { parent: "mars", frame: "laplace", pole: [317.7000, 52.9000], epoch: 946728000000, a: 9379, e: 0.015119, w: 216.4466, m: 190.3756, i: 1.0753, node: 169.1550, sid: 1128.8447723, dw: 0.870970, dn: -0.435786, acc: 1.7626e-08 },
  deimos: { parent: "mars", frame: "laplace", pole: [316.6000, 53.5000], epoch: 946728000000, a: 23459, e: 0.000272, w: 194.7636, m: 10.4792, i: 1.7885, node: 54.3986, sid: 285.1618839, dw: 0.035947, dn: -0.018082 },
  io: { parent: "jupiter", frame: "laplace", pole: [268.1000, 64.5000], epoch: 946728000000, a: 422050, e: 0.004180, w: 148.9328, m: 331.0148, i: 0.0383, node: 260.0942, sid: 203.4889612, dw: -0.606688, dn: -0.132821 },
  europa: { parent: "jupiter", frame: "laplace", pole: [268.1000, 64.5000], epoch: 946728000000, a: 671278, e: 0.009364, w: 45.3280, m: 345.5110, i: 0.4630, node: 183.6941, sid: 101.3747258, dw: -0.706863, dn: -0.032648 },
  ganymede: { parent: "jupiter", frame: "laplace", pole: [268.2000, 64.6000], epoch: 946728000000, a: 1070704, e: 0.001550, w: 204.1684, m: 328.1491, i: 0.1902, node: 49.3711, sid: 50.3176080, dw: -0.085108, dn: -0.006949 },
  callisto: { parent: "jupiter", frame: "laplace", pole: [268.7000, 64.8000], epoch: 946728000000, a: 1883241, e: 0.007373, w: 50.5011, m: 86.8148, i: 0.2344, node: 303.0858, sid: 21.5710731, dw: 0.004038, dn: -0.002183 },
  mimas: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 186019, e: 0.019677, w: 332.5555, m: 15.1011, i: 1.5771, node: 173.0221, sid: 381.9944568, dw: 2.000419, dn: -0.999500, wave: [43.418, 25631.1, 140.48] },
  enceladus: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 238411, e: 0.004863, w: 347.7976, m: 10.8851, i: 0.0384, node: 183.7437, sid: 262.7319015, dw: 0.337808, dn: 0.000158 },
  tethys: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 294976, e: 0.001031, w: 130.7569, m: 157.9367, i: 1.0923, node: 259.8172, sid: 190.6979160, dw: 1.005657, dn: -0.197850, wave: [2.080, 25631.1, -39.13] },
  dione: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 377651, e: 0.002244, w: 23.9210, m: 322.2940, i: 0.0458, node: 190.7749, sid: 131.5349324, dw: 0.083921, dn: 0.000334 },
  rhea: { parent: "saturn", frame: "laplace", pole: [40.6000, 83.5000], epoch: 946728000000, a: 527235, e: 0.001014, w: 214.0290, m: 207.6217, i: 0.3323, node: 350.5663, sid: 79.6900471, dw: 0.029141, dn: -0.027653 },
  titan: { parent: "saturn", frame: "laplace", pole: [36.4000, 84.0000], epoch: 946728000000, a: 1222236, e: 0.028739, w: 184.8032, m: 163.5256, i: 0.3410, node: 23.4097, sid: 22.5769766, dw: 0.002735, dn: -0.001322 },
  iapetus: { parent: "saturn", frame: "laplace", pole: [288.7000, 78.9000], epoch: 946728000000, a: 3561731, e: 0.028384, w: 276.6311, m: 208.8251, i: 7.5692, node: 74.7761, sid: 4.5379486, dw: 0.000592, dn: -0.000316 },
  miranda: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 129874, e: 0.001371, w: 155.0214, m: 72.9701, i: 4.4275, node: 100.8616, sid: 254.6906648, dw: 0.110237, dn: -0.055413, wave: [1.375, 4492.9, -41.43] },
  ariel: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 190949, e: 0.001424, w: 203.0455, m: 122.6641, i: 0.0247, node: 237.4780, sid: 142.8356548, dw: 0.053280, dn: -0.035921 },
  umbriel: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 266003, e: 0.003883, w: 158.9377, m: 260.8156, i: 0.0796, node: 191.5526, sid: 86.8688751, dw: 0.016694, dn: -0.008759 },
  titania: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 436315, e: 0.001853, w: 222.1574, m: 53.4168, i: 0.0999, node: 6.0188, sid: 41.3514155, dw: 0.002907, dn: 0.000579 },
  oberon: { parent: "uranus", frame: "laplace", pole: [77.3110, 15.1750], epoch: 946728000000, a: 583539, e: 0.001418, w: 241.3288, m: 73.2386, i: 0.1731, node: 38.0128, sid: 26.7394826, dw: -1.069893, dn: -0.001489 },
  triton: { parent: "neptune", frame: "laplace", pole: [119.3600, -43.4600], epoch: 946728000000, a: 354841, e: 0.000247, w: 305.9384, m: 292.6939, i: 23.1671, node: 182.1368, sid: 61.2572613, dw: -2.038014, dn: -0.001435 },
  nereid: { parent: "neptune", frame: "laplace", pole: [263.0036, 62.5201], epoch: 946728000000, a: 5515113, e: 0.750814, w: 234.3873, m: 216.7867, i: 0.1195, node: 27.9962, sid: 0.9996312, dw: -0.165444, dn: 0.165461, wave: [0.575, 25887.4, -84.95] },
  proteus: { parent: "neptune", frame: "laplace", pole: [299.3600, 43.4600], epoch: 946728000000, a: 117674, e: 0.000518, w: 17.1835, m: 257.1008, i: 1.0395, node: 0.0397, sid: 320.7656392, dw: 0.075729, dn: 0.001312 },
  charon: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 19594, e: 0.000170, w: 145.3286, m: 148.8263, i: 0.0831, node: 10.0058, sid: 56.3625311, dw: -0.000103, dn: 0.000106 },
  nix: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 49331, e: 0.015293, w: 10.4893, m: 71.8449, i: 0.0845, node: 9.7857, sid: 14.4841692, dw: -0.611124, dn: 0.000103 },
  hydra: { parent: "pluto", frame: "laplace", pole: [132.9930, -6.1630], epoch: 946728000000, a: 65177, e: 0.008506, w: 342.3759, m: 135.3153, i: 0.2865, node: 115.2941, sid: 9.4235838, dw: 3.865115, dn: -0.070628 },
  ...DWARF_MOON_ORBITS,
};
