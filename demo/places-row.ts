// The "Places" row shared by the body page and the space page: the layers of places marked on the body (landings, crashes, planned, features), kept in the address as `places`, a few
// places to go to, the chosen place's name and what it is, and the credit the places owe their sources. The row writes the element's `places` attribute; the lists load as chunks of their own.
import { loadPlaces, PLACES_CREDITS, PLACE_LAYERS, readPlaceLayers, type Place, type PlaceLayer } from "../src/places.ts";
import { placeLine, setPlacesLoader } from "../src/scene/place-layer.ts";

setPlacesLoader(loadPlaces);

interface Address {
  get(key: string): string | null;
  set(key: string, value: string | null): void;
}

export interface PlacesState {
  layers: PlaceLayer[];
}

/** The row's state from the address (`places=landing,crash`). */
export const readPlacesState = (address: Address): PlacesState => ({ layers: readPlaceLayers(address.get("places") ?? "none") });

const $$ = (selector: string): HTMLButtonElement[] => [...document.querySelectorAll<HTMLButtonElement>(selector)];

/** Wire the row: a layer button switches its layer, a place button goes there (with the landing layer on), and a chosen mark's name shows under the row. */
export function bindPlacesRow(state: PlacesState, element: HTMLElement & { goToPlace(text: string, options?: { body?: string; smooth?: boolean }): Promise<Place | undefined> }, render: () => void, lang: () => "en" | "ja"): void {
  for (const b of $$("#place-layers [data-layer]")) {
    b.addEventListener("click", () => {
      const layer = b.dataset["layer"] as PlaceLayer;
      state.layers = state.layers.includes(layer) ? state.layers.filter((l) => l !== layer) : PLACE_LAYERS.filter((l) => l === layer || state.layers.includes(l));
      render();
    });
  }
  const picked = document.querySelector<HTMLElement>("#place-picked");
  const tell = (place: Place | undefined): void => {
    if (picked !== null) picked.textContent = place === undefined ? "" : `${place.name[lang()]}: ${placeLine(place, lang())}`;
  };
  for (const b of $$("#place-gos [data-place]")) {
    b.addEventListener("click", () => {
      if (state.layers.length === 0) state.layers = ["landing"];
      render();
      const go = element.goToPlace as (text: string, options?: { body?: string }) => Promise<Place | undefined>;
      void go.call(element, b.dataset["place"]!, b.dataset["body"] === undefined ? {} : { body: b.dataset["body"] }).then(tell);
    });
  }
  element.addEventListener("wakusei-place", (event) => tell((event as CustomEvent<{ place: Place }>).detail.place));
}

/** Show the state on the buttons, write the attribute and the credit line, and keep the address. */
export function renderPlacesRow(state: PlacesState, element: HTMLElement, address: Address): void {
  for (const b of $$("#place-layers [data-layer]")) {
    const on = state.layers.includes(b.dataset["layer"] as PlaceLayer);
    b.setAttribute("aria-pressed", String(on));
    b.classList.toggle("on", on);
  }
  const value = state.layers.join(" ");
  if (state.layers.length === 0) element.removeAttribute("places");
  else if (element.getAttribute("places") !== value) element.setAttribute("places", value);
  address.set("places", state.layers.length === 0 ? null : state.layers.join(","));
  const credit = document.querySelector<HTMLElement>("#place-credit");
  if (credit !== null) {
    credit.hidden = state.layers.length === 0;
    credit.textContent = PLACES_CREDITS.filter((c) => ["iau-gazetteer", "gcat-landercat", "nssdca", "announcement"].includes(c.id)).map((c) => (c.id === "announcement" ? "planned landings: the agencies' own announcements" : c.line)).join("; ");
  }
}
