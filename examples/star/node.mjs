import { starLineSvg, starLook } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse = starLook({ name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab", estimated: ["radiusSun"] });
const drawn = betelgeuse.parts.filter((part) => part.status === "illustrative").map((part) => part.part);

console.log(betelgeuse.colour, starLineSvg(betelgeuse).startsWith("<svg"), drawn.join(","));
