// Jacobson (2010), Table 6, Table 5 and Eq. 12. The epoch and fit years are terrestrial time.
import { DAY_MS } from "../clock.ts";
import type { OrbitElements } from "../data/orbits.ts";
import { registerMoonTheory } from "../data/theories.ts";
import { laplaceBasis, precessingOrbitVector } from "../orbit-vector.ts";

const FIT_START = Date.UTC(1950, 0, 1);
const FIT_END = Date.UTC(2050, 0, 1);
const JULIAN_YEAR_DAYS = 365.25;
const TRANSITION_MS = 10 * JULIAN_YEAR_DAYS * DAY_MS;

const PHOBOS = {
  parent: "mars", frame: "laplace", pole: [317.6708, 52.8930], epoch: FIT_START,
  a: 9375, e: 0.01511, i: 1.0756, node: 207.7875,
  // Convert longitude of periapsis and mean longitude to argument of periapsis and mean anomaly.
  w: 357.4308 - 207.7875, m: 90.9914 - 357.4308,
  sid: 1128.844409, dw: 0.4352 + 0.4358, dn: -0.4358,
  // Table 5 gives the coefficient of years squared; the solver uses half the acceleration in days.
  acc: 2 * 0.001270 / JULIAN_YEAR_DAYS ** 2,
} satisfies OrbitElements;

const DEIMOS = {
  parent: "mars", frame: "laplace", pole: [316.6570, 53.5294], epoch: FIT_START,
  a: 23458, e: 0.00024, i: 1.7878, node: 24.5123,
  w: 290.7208 - 24.5123, m: 250.4550 - 290.7208,
  sid: 285.161886, dw: 0.0179 + 0.0181, dn: -0.0181,
  // The argument in Eq. 12 is 20 degrees minus the node's (negative) rate times days.
  wave: [0.2711, 360 / 0.0181, 20],
} satisfies OrbitElements;

/** Weight of the source model, increasing smoothly to 1 over the first decade and decreasing over the last. */
function weight(terrestrialMs: number): number {
  const edge = Math.min(terrestrialMs - FIT_START, FIT_END - terrestrialMs);
  const fraction = Math.max(0, Math.min(1, edge / TRANSITION_MS));
  return fraction * fraction * (3 - 2 * fraction);
}

const phobosBasis = laplaceBasis(PHOBOS.pole);
const deimosBasis = laplaceBasis(DEIMOS.pole);
registerMoonTheory("phobos", Object.assign((ms: number) => precessingOrbitVector(PHOBOS, ms, phobosBasis), { weight }));
registerMoonTheory("deimos", Object.assign((ms: number) => precessingOrbitVector(DEIMOS, ms, deimosBasis), { weight }));
