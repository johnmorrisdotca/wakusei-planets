import "@johnmorrisdotca/wakusei-planets/lineup";
import type { WakuseiLineup } from "@johnmorrisdotca/wakusei-planets/lineup";

const lineup = document.querySelector<WakuseiLineup>("wakusei-lineup")!;
// glide from the Sun up to Betelgeuse; the zoom slider, a drag on a star and the keys work by themselves
void lineup.zoomTo("betelgeuse");
lineup.addEventListener("wakusei-lineup-zoom", (event) => console.log((event as CustomEvent<{ focus: string }>).detail.focus));
