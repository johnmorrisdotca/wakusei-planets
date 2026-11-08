// The seven Saturnian moons Mimas to Iapetus (not Hyperion) from the theory TASS1.7 (Vienne and Duriez 1995, IMCCE): importing this teaches `moonVector` their places.
import { registerMoonTheory } from "../data/theories.ts";
import { tass17Position } from "../theories/tass17.ts";

["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus"].forEach((id, index) => registerMoonTheory(id, (ms) => tass17Position(index, ms)));
