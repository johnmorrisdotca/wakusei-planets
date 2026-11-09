import { starLineSvg, starLook } from "@johnmorrisdotca/wakusei-planets";

const betelgeuse = starLook({ name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab", estimated: ["radiusSun"] });
const drawn = betelgeuse.parts.filter((part) => part.status === "illustrative").map((part) => part.part);

console.log(betelgeuse.colour, starLineSvg(betelgeuse).startsWith("<svg"), drawn.join(","));
