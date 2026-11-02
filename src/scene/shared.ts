// One shared renderer for the page, whichever element draws with it: every `<wakusei-body>` takes it from here, so the page keeps one WebGL context. The last element to
// leave lets it go (after a second, in case it is only moving).
import { createSharedRenderer, type SharedRenderer } from "@johnmorrisdotca/kazoku-ui/renderer";
import type { ThreeParts } from "./body.ts";

export type ContextState = "lost" | "restored" | "unavailable";

let shared: SharedRenderer<ThreeParts> | undefined;
let loader: () => Promise<ThreeParts> = () => import("three");
const listeners = new Set<(state: ContextState) => void>();
let elements = 0;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Where three.js comes from, if a page wants to hand it over itself (before the first element connects). A page that hands over a module that re-exports only the parts the bodies use
 * ships a few hundred kilobytes of three.js instead of all of it, and a page with no bundler gives the address of a module (an import map is the other way).
 *
 * @param load - Returns the three.js module, as a promise.
 *
 * @example
 * ```ts no-run
 * import { setThreeLoader } from "@johnmorrisdotca/wakusei-planets/element";
 *
 * setThreeLoader(() => import("three"));
 * ```
 */
export function setThreeLoader(load: () => Promise<ThreeParts>): void {
  loader = load;
}

/** The page's renderer, made on first use. Call `release()` (from the result) when the element leaves. */
export function takeRenderer(onContext: (state: ContextState) => void): { renderer: SharedRenderer<ThreeParts>; release(): void } {
  clearTimeout(releaseTimer);
  elements += 1;
  listeners.add(onContext);
  shared ??= createSharedRenderer<ThreeParts>({
    load: () => loader(),
    stillSize: 480,
    onContext: (state) => {
      for (const listener of listeners) listener(state);
    },
  });
  return {
    renderer: shared,
    release() {
      listeners.delete(onContext);
      elements -= 1;
      if (elements <= 0) {
        releaseTimer = setTimeout(() => {
          if (elements <= 0) {
            shared?.dispose();
            shared = undefined;
          }
        }, 1000);
      }
    },
  };
}

/** The renderer now, if one is made: for tests and for a page that wants its numbers. */
export const currentRenderer = (): SharedRenderer<ThreeParts> | undefined => shared;
