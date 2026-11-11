// The minor bodies' osculating elements, from JPL Horizons' own element tables (https://ssd.jpl.nasa.gov/api/horizons.api, OBJ_DATA, read 2026-11-10): ecliptic and equinox J2000, a in au, angles in degrees, `n` the mean motion in degrees a day,
// at the epoch the orbit solution gives (Vesta 2020-01-01, Pallas 2017-04-27, Chiron 2017-06-12, Pholus 2010-06-22, Halley 1968-01-20). They are the plain ellipse a body follows outside the years its table covers (1800 to 2200); a planet's
// pull moves a real orbit away from it, so far from the epoch it is only roughly right (a comet's, most of all).
import type { MinorId } from "../facts.ts";
import type { Osculating } from "./dwarf.ts";

export const MINOR_ELEMENTS: Readonly<Record<MinorId, Osculating>> = {
  vesta: { epoch: 1577836800000, a: 2.361908654291772, e: 0.08857261385730482, i: 7.14181494423702, node: 103.8092892453337, w: 150.8357762126256, m: 163.3754032354997, n: 0.271524753 },
  pallas: { epoch: 1493251200000, a: 2.773023116113918, e: 0.2306545322740501, i: 34.83970334384021, node: 173.0883296888898, w: 309.9974922427895, m: 263.9040941962388, n: 0.21343903 },
  chiron: { epoch: 1497225600000, a: 13.64597936638133, e: 0.3824171374703196, i: 6.94959060447848, node: 209.2011323125998, w: 339.6529896907077, m: 151.975605480683, n: 0.019552262 },
  pholus: { epoch: 1277164800000, a: 20.30484241567553, e: 0.5718479422462566, i: 24.66709981611229, node: 119.4098618882261, w: 354.7063272595453, m: 73.88199769909997, n: 0.010772206 },
  halley: { epoch: -61516800000, a: 17.92863504856929, e: 0.9679359956953212, i: 162.1905300439129, node: 59.09894720612437, w: 112.2414314637764, m: 274.3823371364693, n: 0.012983244 },
};
