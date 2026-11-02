// One table for the whole page, kept on `globalThis`: a CDN's bundler (jsDelivr's `/+esm`) gives each entry point its own copy of a file, and the copies must still share the looks.
import type { BodyId } from "../facts.ts";
import type { BodyLook } from "./look.ts";

const KEY = Symbol.for("johnmorrisdotca.wakusei-planets.looks");
const store = ((globalThis as Record<symbol, unknown>)[KEY] ??= { looks: new Map<BodyId, BodyLook>(), waiting: new Set<() => void>() }) as { looks: Map<BodyId, BodyLook>; waiting: Set<() => void> };

export const { looks, waiting } = store;

/** Call `wake` whenever a look is registered; returns a function that stops it. */
export function onRegister(wake: () => void): () => void {
  waiting.add(wake);
  return () => waiting.delete(wake);
}
