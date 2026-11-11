// The "Name on the body" row shared by the body page and the space page: the look (off, painted, etched, outline, burned), how many, where, the strength and "Facing you", kept in the
// address as `bl`, `blr`, `bll`, `bls` and `blf`. The row writes the family's `body-label` attributes on the element it is given.
import type { NameLabelOptions } from "../src/scene/name-label.ts";

export interface BodyLabelState {
  look: "" | "painted" | "etched" | "outline" | "burned";
  repeat: "once" | "both" | "around";
  latitude: "0" | "55" | "-55";
  strength: "0.25" | "0.5" | "1";
  facing: boolean;
}

interface Address {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** The row's state from the address. */
export function readBodyLabelState(address: Address): BodyLabelState {
  return {
    look: pick(address.get("bl"), ["", "painted", "etched", "outline", "burned"], ""),
    repeat: pick(address.get("blr"), ["once", "both", "around"], "once"),
    latitude: pick(address.get("bll"), ["0", "55", "-55"], "0"),
    strength: pick(address.get("bls"), ["0.25", "0.5", "1"], "0.5"),
    facing: address.get("blf") === "1",
  };
}

/** The element's `bodyLabel` for the state, or null when off. */
export const bodyLabelOf = (state: BodyLabelState): NameLabelOptions | null => (state.look === "" ? null : { look: state.look, repeat: state.repeat, latitude: Number(state.latitude), strength: Number(state.strength), facing: state.facing });

/** Wire the row's buttons: each click changes the state and calls `render`. */
export function bindBodyLabelRow(state: BodyLabelState, render: () => void): void {
  const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
  for (const b of $$("#body-labels [data-bl]")) b.addEventListener("click", () => ((state.look = b.dataset["bl"] as BodyLabelState["look"]), render()));
  for (const b of $$("#body-label-repeats [data-blr]")) b.addEventListener("click", () => ((state.repeat = b.dataset["blr"] as BodyLabelState["repeat"]), render()));
  for (const b of $$("#body-label-wheres [data-bll]")) b.addEventListener("click", () => ((state.latitude = b.dataset["bll"] as BodyLabelState["latitude"]), render()));
  for (const b of $$("#body-label-strengths [data-bls]")) b.addEventListener("click", () => ((state.strength = b.dataset["bls"] as BodyLabelState["strength"]), render()));
  document.querySelector("#body-label-facing")?.addEventListener("click", () => ((state.facing = !state.facing), render()));
}

/** Show the state on the row's buttons, write the attributes on the element, and keep the address. */
export function renderBodyLabelRow(state: BodyLabelState, element: Element, address: Address): void {
  const pressed = (button: HTMLElement, on: boolean): void => {
    button.setAttribute("aria-pressed", String(on));
    button.classList.toggle("on", on);
  };
  const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];
  for (const b of $$("#body-labels [data-bl]")) pressed(b, b.dataset["bl"] === state.look);
  for (const b of $$("#body-label-repeats [data-blr]")) pressed(b, b.dataset["blr"] === state.repeat);
  for (const b of $$("#body-label-wheres [data-bll]")) pressed(b, b.dataset["bll"] === state.latitude);
  for (const b of $$("#body-label-strengths [data-bls]")) pressed(b, b.dataset["bls"] === state.strength);
  const facing = document.querySelector<HTMLElement>("#body-label-facing");
  if (facing) pressed(facing, state.facing);
  const on = state.look !== "";
  for (const id of ["#body-label-repeats", "#body-label-wheres", "#body-label-strengths", "#body-label-facing"]) {
    const el = document.querySelector<HTMLElement>(id);
    if (el) el.hidden = !on;
  }
  const set = (name: string, value: string | null): void => {
    if (value === null) element.removeAttribute(name);
    else if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  };
  set("body-label", on ? state.look : null);
  set("body-label-repeat", on && state.repeat !== "once" ? state.repeat : null);
  set("body-label-latitude", on && state.latitude !== "0" ? state.latitude : null);
  set("body-label-strength", on && state.strength !== "0.5" ? state.strength : null);
  set("body-label-facing", on && state.facing ? "" : null);
  address.set("bl", on ? state.look : null);
  address.set("blr", on && state.repeat !== "once" ? state.repeat : null);
  address.set("bll", on && state.latitude !== "0" ? state.latitude : null);
  address.set("bls", on && state.strength !== "0.5" ? state.strength : null);
  address.set("blf", on && state.facing ? "1" : null);
}
