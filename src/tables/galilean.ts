// The Galilean moons from the theory L1.2 (Lainey, Duriez and Vienne 2006, IMCCE): importing this teaches `moonVector` Io, Europa, Ganymede and Callisto, 1130 to 2760.
import { registerMoonTheory } from "../data/theories.ts";
import { galileanPosition } from "../theories/galilean.ts";

["io", "europa", "ganymede", "callisto"].forEach((id, index) => registerMoonTheory(id, (ms) => galileanPosition(index, ms)));
