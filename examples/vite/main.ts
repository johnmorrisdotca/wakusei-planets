import "@johnmorrisdotca/wakusei-planets/element";
import { lineSvg } from "@johnmorrisdotca/wakusei-planets";

const planet = document.querySelector("wakusei-body")!;
planet.setAttribute("tilt", "20");
console.log(lineSvg("saturn", { size: 64 }).startsWith("<svg"));
