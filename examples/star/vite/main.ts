import "@johnmorrisdotca/wakusei-planets/element";
import type { WakuseiBody } from "@johnmorrisdotca/wakusei-planets/element";
import { starLook, type StarNumbers } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse: StarNumbers = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab", estimated: ["radiusSun"] };

const star = document.querySelector<WakuseiBody>("wakusei-body")!;
star.star = betelgeuse;
console.log(starLook(betelgeuse).parts.map((part) => `${part.part}: ${part.status}`).join(", "));
