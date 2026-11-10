// The full-screen space page: one <wakusei-space immersive> filling the window, whatever its shape, on a dark page. A plain wheel zooms and a drag anywhere turns; the family's bar sits over the bottom.
// It opens moving, from now, an hour a second (the first speed at which the Earth's turn shows), with the date shown in the device's local time; a reader who asked for reduced motion gets it still.
import "@johnmorrisdotca/kazoku-ui/view-controls/define";
import type { ViewChangeDetail, ViewControlsElement } from "@johnmorrisdotca/kazoku-ui/view-controls/element";
import { setThreeLoader, type SpacePreset, type WakuseiSpace } from "../src/space/element.ts";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;

setThreeLoader(() => import("./three-subset.ts"));

const space = document.querySelector<WakuseiSpace>("#space")!;
const controls = document.querySelector<ViewControlsElement>("#controls")!;
const when = document.querySelector<HTMLElement>("#when")!;
const params = new URLSearchParams(location.search);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// links with a date or a speed are respected; otherwise it moves
if (params.has("t")) space.setAttribute("time", params.get("t")!);
if (params.has("scale")) space.setAttribute("scale", params.get("scale")!);
space.speed = params.has("speed") ? Number(params.get("speed")) || 0 : reduced ? 0 : 3600;

/** The moment shown, in the device's own time. */
const local = (ms: number): string => new Date(ms).toLocaleString(chooser()?.lang === "ja" ? "ja-JP" : "en-CA", { dateStyle: "medium", timeStyle: "medium" });
const show = (ms: number): void => void (when.textContent = local(ms));
space.addEventListener("wakusei-timechange", (event) => show((event as CustomEvent<{ time: number }>).detail.time));
space.addEventListener("wakusei-ready", () => show(space.time));
show(space.time);

controls.addEventListener("kazoku-viewchange", (event) => {
  const detail = (event as CustomEvent<ViewChangeDetail>).detail;
  space.setView(detail, detail.final);
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-goto]")) {
  button.addEventListener("click", () => {
    const preset = button.dataset["goto"] as SpacePreset;
    space.body = preset === "moon" ? "moon" : "earth";
    controls.controller.set({ zoom: space.zoomFor(preset) }, true, "jump");
    for (const other of document.querySelectorAll<HTMLButtonElement>("[data-goto]")) other.setAttribute("aria-pressed", String(other === button));
  });
}
// the hopper: two arrows with the names of where each leads; the bar holds the zoom, so the page applies the one a hop asks for
const say = (key: string): string => chooser()?.word(key) ?? key;
const showHop = (): void => {
  const { previous, next } = space.hopper;
  document.querySelector("#hop-prev-name")!.textContent = previous.name;
  document.querySelector("#hop-next-name")!.textContent = next.name;
  document.querySelector("#hop-prev")!.setAttribute("aria-label", `${say("sp_hop_prev")}: ${previous.name}`);
  document.querySelector("#hop-next")!.setAttribute("aria-label", `${say("sp_hop_next")}: ${next.name}`);
};
document.querySelector("#hop-prev")!.addEventListener("click", () => space.previous());
document.querySelector("#hop-next")!.addEventListener("click", () => space.next());
space.addEventListener("wakusei-hop", (event) => {
  const { zoom } = (event as CustomEvent<{ zoom?: number }>).detail;
  if (zoom !== undefined) controls.controller.set({ zoom }, true, "jump");
  showHop();
});
showHop();
window.addEventListener("wakusei-language", () => {
  showHop();
  space.setAttribute("lang", chooser()?.lang ?? "en");
  controls.setAttribute("lang", chooser()?.lang ?? "en");
  show(space.time);
});
space.setAttribute("lang", chooser()?.lang ?? "en");
