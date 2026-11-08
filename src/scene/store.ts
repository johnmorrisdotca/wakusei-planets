// One table for the whole page, kept on `globalThis`: a CDN's bundler (jsDelivr's `/+esm`) gives each entry point its own copy of a file, and the copies must still share the looks.
import type { BodyId } from "../facts.ts";
import type { BodyLook } from "./look.ts";

const KEY = Symbol.for("johnmorrisdotca.wakusei-planets.looks");
/** A body whose line look another package's element draws (the Earth, by chikyu-earth) instead of this one: the element asks it for what to show. The shaded and painted looks are always this package's. */
export interface Delegate {
  /** The line look: an element for the body, centred on a longitude and latitude (`"lon,lat"`), or null when the other package is not on the page and this one draws its own. */
  line(options: { center: string; size: number }): Promise<HTMLElement | null>;
}

const store = ((globalThis as Record<symbol, unknown>)[KEY] ??= { looks: new Map<BodyId, BodyLook>(), waiting: new Set<() => void>(), delegates: new Map<BodyId, Delegate>() }) as {
  looks: Map<BodyId, BodyLook>;
  waiting: Set<() => void>;
  delegates: Map<BodyId, Delegate>;
};

export const { looks, waiting, delegates } = store;

/** Call `wake` whenever a look is registered; returns a function that stops it. */
export function onRegister(wake: () => void): () => void {
  waiting.add(wake);
  return () => waiting.delete(wake);
}
