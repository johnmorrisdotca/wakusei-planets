// TASS1.7 positions for eight Saturnian moons (Vienne and Duriez 1995, IMCCE), including Hyperion's separate series.
import { registerMoonTheory } from "../data/theories.ts";
import { SATURN_MOON_PHASE, moonPhaseTime } from "../data/moon-refinements.ts";
import { tass17HyperionPosition, tass17Position } from "../theories/tass17.ts";

["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"].forEach((id, index) => {
  const correction = SATURN_MOON_PHASE[id];
  registerMoonTheory(id, (ms) => tass17Position(index, moonPhaseTime(ms, correction)));
});
registerMoonTheory("hyperion", tass17HyperionPosition);
