// Registers <wakusei-flat-system>. Importing this entry point (`@johnmorrisdotca/wakusei-planets/flat/system/define`) defines the tag once. It needs no WebGL and no peer.
import { WakuseiFlatSystem } from "./system-element.ts";

export { WakuseiFlatSystem };
export type { SystemPick } from "./system-element.ts";

if (typeof customElements !== "undefined" && !customElements.get("wakusei-flat-system")) {
  customElements.define("wakusei-flat-system", WakuseiFlatSystem);
}
