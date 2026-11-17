// Registers <wakusei-flat>. Importing this entry point (`@johnmorrisdotca/wakusei-planets/flat/define`) defines the tag once. It needs no WebGL and no peer.
import { WakuseiFlat } from "./element.ts";

export { WakuseiFlat };
export type { FlatPick } from "./element.ts";

if (typeof customElements !== "undefined" && !customElements.get("wakusei-flat")) {
  customElements.define("wakusei-flat", WakuseiFlat);
}
