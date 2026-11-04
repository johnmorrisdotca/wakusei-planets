// The portrait builder: put any bodies of the solar system in one picture. The picture is one <wakusei-portrait> (one WebGL context for every body in it); this file is the editing around it: pick,
// drag, turn, size, order, undo, the choices, the code, the saved picture. Every change makes a new scene (never edits the old), so undo is a list of scenes and the address holds the latest.
import { createAddressState } from "@johnmorrisdotca/kazoku-ui/address-state";
import "@johnmorrisdotca/kazoku-ui/embed-panel/define";
import type { EmbedChangeDetail, EmbedPanelElement } from "@johnmorrisdotca/kazoku-ui/embed-panel/element";
import { BODIES, DWARF_IDS, drawnTilt, MOONS_OF, PLANET_IDS, type BodyId, type Look } from "../src/index.ts";
import { EMBED_KINDS, portraitCode, type EmbedKind } from "../src/embed.ts";
import { addBody, addMoons, ASPECTS, auto, centreCamera, createHistory, decodeScene, encodeScene, fitAll, moveInOrder, PRESETS, removeBody, rescale, resolve, setItem, setPortrait, snap, type Guide, type Item, type Portrait } from "../src/portrait/model.ts";
import { defaultPitch } from "../src/portrait/pose.ts";
import "../src/portrait/element.ts";
import "../src/bodies/all.ts";
import "../src/bodies/earth.ts";
import { setThreeLoader, type WakuseiPortrait } from "../src/portrait/element.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));
const lang = (): "en" | "ja" => chooser()?.lang ?? "en";
const name = (id: BodyId): string => BODIES[id].name[lang()];

setThreeLoader(() => import("./three-subset.ts"));

const view = document.querySelector<WakuseiPortrait>("#view")!;
const wrap = document.querySelector<HTMLElement>("#wrap")!;
const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
const all = <T extends HTMLElement = HTMLElement>(selector: string): T[] => [...document.querySelectorAll<T>(selector)];

const address = createAddressState({ defaults: {} });
const DEG = 180 / Math.PI;
const initial = (): Portrait => {
  const text = address.get("scene");
  return text === null ? { ...PRESETS.find((p) => p.id === "galileans")!.scene } : decodeScene(text);
};
const history = createHistory(initial());
const ui = { selected: -1, tool: "move" as "move" | "turn", tab: "bodies", group: "planets", guides: [] as Guide[] };
const scene = (): Portrait => history.current;

const pressed = (button: Element, on: boolean): void => {
  button.setAttribute("aria-pressed", String(on));
  button.classList.toggle("on", on);
};
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// --- changes: a finished change is a step of history, one that goes on (a key held, a slider dragged) is the same step ---------------------------------------------------------------------------
let lastKey = "";
let lastAt = 0;
function change(next: Portrait, coalesce?: string): void {
  if (next === scene()) return;
  const now = performance.now();
  if (coalesce !== undefined && coalesce === lastKey && now - lastAt < 700) history.replace(next);
  else history.push(next);
  lastKey = coalesce ?? "";
  lastAt = now;
  render();
}
/** Show a scene without making a step of history: the drag in progress. */
function preview(next: Portrait): void {
  view.portrait = next;
  view.editing = { selected: ui.selected, guides: ui.guides };
}
const select = (index: number): void => {
  ui.selected = index;
  render();
};

// --- a line under every choice that says what it does, always there, tied to its button -----------------------------------------------------------------------------------------------------
const NOTES: readonly (readonly [string, string])[] = [
  ['#tools [data-tool="move"]', "pt_note_move"],
  ['#tools [data-tool="turn"]', "pt_note_turn"],
  ['#layouts [data-layout="auto"]', "pt_note_auto"],
  ['#layouts [data-layout="manual"]', "pt_note_manual"],
  ['#arranges [data-arrange="row"]', "pt_note_row"],
  ['#arranges [data-arrange="arc"]', "pt_note_arc"],
  ['#arranges [data-arrange="grid"]', "pt_note_grid"],
  ['#arranges [data-arrange="orbit"]', "pt_note_orbit"],
  ['#scales [data-scale="true"]', "pt_note_true"],
  ['#scales [data-scale="readable"]', "pt_note_readable"],
  ['#moons [data-moons="auto"]', "pt_note_moons_auto"],
  ['#moons [data-moons="manual"]', "pt_note_moons_manual"],
  ['#looks [data-look="line"]', "note_line"],
  ['#looks [data-look="realistic"]', "note_realistic"],
  ['#looks [data-look="painted"]', "note_painted"],
  ['#bgs [data-bg="black"]', "pt_note_bg_black"],
  ['#bgs [data-bg="stars"]', "pt_note_bg_stars"],
  ['#bgs [data-bg="gradient"]', "pt_note_bg_gradient"],
  ['#bgs [data-bg="transparent"]', "pt_note_bg_transparent"],
  ["#labels", "pt_note_labels"],
  ["#orbits", "pt_note_orbits"],
  ["#shadows", "pt_note_shadows"],
  ["#skydate", "pt_note_sky"],
];
const noteLines: { line: HTMLElement; key: string }[] = [];
for (const [selector, key] of NOTES) {
  const button = document.querySelector<HTMLElement>(selector);
  const row = button?.closest<HTMLElement>(".fam-row");
  if (!button || !row) continue;
  let box = row.nextElementSibling as HTMLElement | null;
  if (!box || !box.classList.contains("choice-notes")) {
    box = document.createElement("div");
    box.className = "choice-notes";
    row.after(box);
  }
  const line = document.createElement("p");
  line.className = "fam-fine note";
  line.id = `note-${key}`;
  box.append(line);
  button.setAttribute("aria-describedby", line.id);
  noteLines.push({ line, key });
}

// --- the page from the scene --------------------------------------------------------------------------------------------------------------------------------------------------------------------
const GROUPS: readonly { id: string; label: () => string; bodies: readonly BodyId[] }[] = [
  { id: "planets", label: () => say("pt_g_planets"), bodies: ["sun", ...PLANET_IDS] },
  { id: "dwarfs", label: () => say("pt_g_dwarfs"), bodies: DWARF_IDS },
  ...Object.entries(MOONS_OF).map(([planet, moons]) => ({ id: planet, label: () => say("moonsOf", { planet: name(planet as BodyId) }), bodies: moons as readonly BodyId[] })),
];

function chip(text: string, on: boolean, click: () => void, testid?: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.setAttribute("aria-pressed", String(on));
  if (testid !== undefined) b.dataset["testid"] = testid;
  b.addEventListener("click", click);
  return b;
}

let writeTimer: ReturnType<typeof setTimeout> | undefined;
function renderBodies(p: Portrait): void {
  $("#presets").replaceChildren(
    ...PRESETS.map((preset) => chip(preset.name[lang()], false, () => change({ ...preset.scene, look: scene().look, bg: scene().bg, date: scene().date }), `preset-${preset.id}`)),
    chip(say("pt_empty"), false, () => change({ ...p, items: [] }), "preset-empty"),
  );
  $("#groups").replaceChildren(...GROUPS.map((g) => chip(g.label(), g.id === ui.group, () => ((ui.group = g.id), render()), `group-${g.id}`)));
  const group = GROUPS.find((g) => g.id === ui.group) ?? GROUPS[0]!;
  $("#picker").replaceChildren(
    ...group.bodies.map((id) =>
      chip(name(id), p.items.some((i) => i.body === id), () => {
        const next = scene().items.some((i) => i.body === id) ? removeBody(scene(), id) : addBody(scene(), id);
        change(next);
        const at = scene().items.findIndex((i) => i.body === id);
        if (at >= 0) ui.selected = at;
        else if (ui.selected >= scene().items.length) ui.selected = -1;
        render();
      }, `body-${id}`),
    ),
  );
}

function renderSelection(p: Portrait): void {
  const item: Item | undefined = p.items[ui.selected];
  const manual = p.layout === "manual";
  $("#inscene").replaceChildren(...p.items.map((it, i) => chip(name(it.body), i === ui.selected, () => select(i), `item-${it.body}`)));
  $("#sel-name").textContent = item === undefined ? say("pt_none") : `${say("pt_sel")}: ${name(item.body)}`;
  for (const id of ["o-back", "o-backward", "o-forward", "o-front", "remove"]) $<HTMLButtonElement>(`#${id}`).disabled = item === undefined;
  $<HTMLButtonElement>("#addmoons").disabled = item === undefined || !(item.body in MOONS_OF) || MOONS_OF[item.body as keyof typeof MOONS_OF].every((m) => p.items.some((i) => i.body === m));
  const size = $<HTMLInputElement>("#size");
  size.disabled = item === undefined || !manual;
  if (item !== undefined) size.value = String(Math.log(item.r));
  const lean = $<HTMLInputElement>("#lean");
  const over = $<HTMLInputElement>("#over");
  lean.disabled = over.disabled = item === undefined;
  if (item !== undefined) {
    lean.value = String(Math.round(item.tilt ?? drawnTilt(BODIES[item.body])));
    over.value = String(Math.round(item.pitch ?? defaultPitch(item.body)));
  }
  for (const b of all<HTMLButtonElement>("#turns [data-turn]")) {
    b.disabled = item === undefined;
    pressed(b, item !== undefined && Number(b.dataset["turn"]) === item.turn);
  }
}

function renderChoices(p: Portrait): void {
  for (const b of all("#tools [data-tool]")) pressed(b, b.dataset["tool"] === ui.tool);
  for (const b of all("#layouts [data-layout]")) pressed(b, b.dataset["layout"] === p.layout);
  for (const b of all<HTMLButtonElement>("#arranges [data-arrange]")) {
    pressed(b, b.dataset["arrange"] === p.arrange);
    b.disabled = p.layout === "manual";
  }
  for (const b of all("#scales [data-scale]")) pressed(b, b.dataset["scale"] === p.scale);
  for (const b of all("#moons [data-moons]")) pressed(b, b.dataset["moons"] === p.moons);
  for (const b of all("#looks [data-look]")) pressed(b, b.dataset["look"] === p.look);
  for (const b of all("#bgs [data-bg]")) pressed(b, b.dataset["bg"] === p.bg);
  const shapes = $("#shapes");
  if (shapes.childElementCount === 0) shapes.replaceChildren(...ASPECTS.map(([label, ratio]) => chip(label, false, () => change(setPortrait(scene(), { aspect: ratio })), `shape-${label}`)));
  [...shapes.children].forEach((b, i) => pressed(b, Math.abs(ASPECTS[i]![1] - p.aspect) < 0.01));
  pressed($("#labels"), p.labels);
  pressed($("#orbits"), p.orbits);
  pressed($("#shadows"), p.shadows);
  pressed($("#skydate"), p.date !== undefined);
  $("#date-field").hidden = p.date === undefined;
  if (p.date !== undefined) $<HTMLInputElement>("#when").value = localValue(Date.parse(p.date));
  $<HTMLInputElement>("#sun-az").value = String(p.light.az);
  $<HTMLInputElement>("#sun-el").value = String(p.light.el);
  $<HTMLButtonElement>("#undo").disabled = !history.canUndo;
  $<HTMLButtonElement>("#redo").disabled = !history.canRedo;
  $<HTMLButtonElement>("#centre").disabled = $<HTMLButtonElement>("#fit").disabled = p.layout === "auto";
  $("#hint").textContent = p.items.length === 0 ? say("pt_none") : say(p.layout === "auto" ? "pt_hint_auto" : "pt_hint_manual");
  for (const { line, key } of noteLines) line.textContent = say(key);
}

const localValue = (ms: number): string => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

const panel = $<EmbedPanelElement>("#embed-panel");
panel.kinds = EMBED_KINDS;
const kept = address.get("embed");
if (EMBED_KINDS.includes(kept as EmbedKind)) panel.kind = kept as string;
panel.generate = ({ kind, preview }) => portraitCode({ scene: encodeScene(scene()), width: 720 }, kind as EmbedKind, preview ? { site: "" } : {});
panel.credits = () => `Wakusei Planets by John Morris (MIT). Sizes, tilt and rotation: IAU and NASA fact sheets.${scene().look === "painted" ? " Surface pictures: NASA, USGS and JPL imagery in the public domain (details in the package's NOTICE.md)." : ""}`;
panel.addEventListener("kazoku-embedchange", (event) => {
  const { kind } = (event as CustomEvent<EmbedChangeDetail>).detail;
  address.set("embed", kind === "html" ? null : kind);
});

function renderShare(p: Portrait): void {
  panel.setAttribute("lang", lang());
  panel.openHref = `embed.html?${new URLSearchParams({ scene: encodeScene(p) }).toString()}`;
  panel.update();
}

function render(): void {
  const p = scene();
  if (ui.selected >= p.items.length) ui.selected = p.items.length - 1;
  view.setAttribute("lang", lang());
  view.setAttribute("texture-base", "textures/");
  wrap.style.setProperty("--wakusei-ratio", String(p.aspect));
  view.portrait = p;
  view.editing = { selected: ui.selected, guides: ui.guides };
  renderBodies(p);
  renderSelection(p);
  renderChoices(p);
  renderShare(p);
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => address.set("scene", encodeScene(p) === "" ? "~" : encodeScene(p)), 250);
}

// --- tabs ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const TABS = ["bodies", "arrange", "look", "share"] as const;
function showTab(tab: string): void {
  ui.tab = tab;
  for (const t of TABS) {
    const button = $(`#tab-${t}`);
    button.setAttribute("aria-selected", String(t === tab));
    button.tabIndex = t === tab ? 0 : -1;
    $(`#panel-${t}`).hidden = t !== tab;
  }
}
for (const t of TABS) $(`#tab-${t}`).addEventListener("click", () => showTab(t));
$("#tabs").addEventListener("keydown", (event) => {
  const step = (event as KeyboardEvent).key === "ArrowRight" ? 1 : (event as KeyboardEvent).key === "ArrowLeft" ? -1 : 0;
  if (step === 0) return;
  const next = TABS[(TABS.indexOf(ui.tab as (typeof TABS)[number]) + step + TABS.length) % TABS.length]!;
  showTab(next);
  $(`#tab-${next}`).focus();
  event.preventDefault();
});

// --- the choices -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
for (const b of all("#tools [data-tool]")) b.addEventListener("click", () => ((ui.tool = b.dataset["tool"] === "turn" ? "turn" : "move"), render()));
for (const b of all("#layouts [data-layout]")) b.addEventListener("click", () => change(b.dataset["layout"] === "manual" ? setPortrait(scene(), { layout: "manual" }) : auto(scene())));
for (const b of all("#arranges [data-arrange]")) b.addEventListener("click", () => change(setPortrait(scene(), { arrange: b.dataset["arrange"] as Portrait["arrange"] })));
for (const b of all("#scales [data-scale]")) b.addEventListener("click", () => change(rescale(scene(), b.dataset["scale"] === "true" ? "true" : "readable")));
for (const b of all("#moons [data-moons]")) b.addEventListener("click", () => change(setPortrait(scene(), { moons: b.dataset["moons"] === "manual" ? "manual" : "auto" })));
for (const b of all("#looks [data-look]")) b.addEventListener("click", () => change(setPortrait(scene(), { look: b.dataset["look"] as Look })));
for (const b of all("#bgs [data-bg]")) b.addEventListener("click", () => change(setPortrait(scene(), { bg: b.dataset["bg"] as Portrait["bg"] })));
$("#labels").addEventListener("click", () => change(setPortrait(scene(), { labels: !scene().labels })));
$("#orbits").addEventListener("click", () => change(setPortrait(scene(), { orbits: !scene().orbits })));
$("#shadows").addEventListener("click", () => change(setPortrait(scene(), { shadows: !scene().shadows })));
$("#skydate").addEventListener("click", () => change(setPortrait(scene(), { date: scene().date === undefined ? new Date().toISOString().slice(0, 16) : undefined })));
$<HTMLInputElement>("#when").addEventListener("change", (event) => {
  const ms = Date.parse((event.target as HTMLInputElement).value);
  if (Number.isFinite(ms)) change(setPortrait(scene(), { date: new Date(ms).toISOString().slice(0, 16) }));
});
$<HTMLInputElement>("#sun-az").addEventListener("input", (event) => change(setPortrait(scene(), { light: { ...scene().light, az: Number((event.target as HTMLInputElement).value) } }), "light"));
$<HTMLInputElement>("#sun-el").addEventListener("input", (event) => change(setPortrait(scene(), { light: { ...scene().light, el: Number((event.target as HTMLInputElement).value) } }), "light"));
$("#undo").addEventListener("click", () => ((ui.selected = -1), history.undo(), render()));
$("#redo").addEventListener("click", () => (history.redo(), render()));
$("#centre").addEventListener("click", () => change(centreCamera(scene())));
$("#fit").addEventListener("click", () => change(fitAll(scene())));

// the chosen body
const withSelected = (fn: (p: Portrait, index: number) => Portrait, coalesce?: string): void => {
  if (ui.selected < 0) return;
  change(fn(scene(), ui.selected), coalesce);
};
const reorder = (to: (index: number, count: number) => number): void => {
  const from = ui.selected;
  if (from < 0) return;
  const target = clamp(to(from, scene().items.length), 0, scene().items.length - 1);
  ui.selected = target;
  change(moveInOrder(scene(), from, target));
};
$("#o-back").addEventListener("click", () => reorder(() => 0));
$("#o-backward").addEventListener("click", () => reorder((i) => i - 1));
$("#o-forward").addEventListener("click", () => reorder((i) => i + 1));
$("#o-front").addEventListener("click", () => reorder((_i, n) => n - 1));
$("#remove").addEventListener("click", () => {
  const body = scene().items[ui.selected]?.body;
  if (body !== undefined) change(removeBody(scene(), body));
});
$("#addmoons").addEventListener("click", () => {
  const body = scene().items[ui.selected]?.body;
  if (body !== undefined) change(addMoons(scene(), body));
});
$<HTMLInputElement>("#size").addEventListener("input", (event) => withSelected((p, i) => setItem(p, i, { r: Math.exp(Number((event.target as HTMLInputElement).value)) }), "size"));
$<HTMLInputElement>("#lean").addEventListener("input", (event) => withSelected((p, i) => setItem(p, i, { tilt: Number((event.target as HTMLInputElement).value) }), "lean"));
$<HTMLInputElement>("#over").addEventListener("input", (event) => withSelected((p, i) => setItem(p, i, { pitch: Number((event.target as HTMLInputElement).value) }), "over"));
for (const b of all("#turns [data-turn]")) b.addEventListener("click", () => withSelected((p, i) => setItem(p, i, { turn: Number(b.dataset["turn"]) })));

// --- the pointer ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
interface Drag {
  pointer: number;
  mode: "move" | "turn" | "pan" | "reorder";
  index: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  grab: { x: number; y: number };
  base: Portrait;
  current: Portrait;
  moved: boolean;
}
let drag: Drag | undefined;
const touches = new Map<number, { x: number; y: number }>();
let pinch: { distance: number; base: Portrait; index: number } | undefined;

const nudgeRadius = (p: Portrait, index: number): number => Math.max(p.layout === "manual" ? p.items[index]!.r : resolve(p).placed[index]!.r, 0.0001);

wrap.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  wrap.focus({ preventScroll: true });
  const p = scene();
  if (touches.size === 2 && p.layout === "manual") {
    const [a, b] = [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
    const mid = view.pick((a.x + b.x) / 2, (a.y + b.y) / 2, 20);
    pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), base: p, index: mid >= 0 ? mid : ui.selected };
    drag = undefined;
    return;
  }
  if (touches.size > 1) return;
  const index = view.pick(event.clientX, event.clientY);
  wrap.setPointerCapture(event.pointerId);
  if (index >= 0 && index !== ui.selected) {
    ui.selected = index;
    renderSelection(p);
    view.editing = { selected: index, guides: [] };
  }
  if (index < 0) {
    ui.selected = -1;
    renderSelection(p);
    view.editing = { guides: [] };
  }
  const world = view.worldAt(event.clientX, event.clientY);
  const placed = resolve(p).placed;
  const mode: Drag["mode"] = index < 0 ? "pan" : ui.tool === "turn" || event.shiftKey ? "turn" : p.layout === "manual" ? "move" : "reorder";
  drag = {
    pointer: event.pointerId,
    mode,
    index,
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    grab: index >= 0 ? { x: world.x - placed[index]!.x, y: world.y - placed[index]!.y } : { x: 0, y: 0 },
    base: p,
    current: p,
    moved: false,
  };
});

wrap.addEventListener("pointermove", (event) => {
  if (touches.has(event.pointerId)) touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch !== undefined && touches.size === 2) {
    const [a, b] = [...touches.values()] as [{ x: number; y: number }, { x: number; y: number }];
    const k = Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance);
    const next = pinch.index >= 0 ? setItem(pinch.base, pinch.index, { r: clamp(pinch.base.items[pinch.index]!.r * k, 0.003, 4) }) : setPortrait(pinch.base, { camera: { ...pinch.base.camera, h: clamp(pinch.base.camera.h / k, 1e-4, 1e4) } });
    preview(next);
    return;
  }
  const d = drag;
  if (d === undefined || d.pointer !== event.pointerId) return;
  if (!d.moved && Math.hypot(event.clientX - d.startX, event.clientY - d.startY) < 3) return;
  d.moved = true;
  const { scale } = view.metrics;
  const p = d.current;
  if (d.mode === "move") {
    const world = view.worldAt(event.clientX, event.clientY);
    const want = { x: world.x - d.grab.x, y: world.y - d.grab.y };
    const others = resolve(p).placed.filter((_q, i) => i !== d.index);
    const mine = p.items[d.index]!;
    const snapped = event.altKey ? { ...want, guides: [] as Guide[] } : snap({ ...want, r: mine.r }, others, { x: p.camera.x, y: p.camera.y }, 6 / scale);
    ui.guides = snapped.guides;
    d.current = setItem(p, d.index, { x: snapped.x, y: snapped.y });
  } else if (d.mode === "turn") {
    const item = p.items[d.index]!;
    const rPx = Math.max(nudgeRadius(p, d.index) * scale, 24);
    const dx = event.clientX - d.lastX;
    const dy = event.clientY - d.lastY;
    d.current = setItem(p, d.index, { spin: item.spin - (dx / rPx) * DEG, pitch: clamp((item.pitch ?? defaultPitch(item.body)) + (dy / rPx) * DEG, -90, 90) });
  } else if (d.mode === "pan") {
    if (p.layout === "manual") d.current = setPortrait(p, { camera: { ...p.camera, x: p.camera.x - (event.clientX - d.lastX) / scale, y: p.camera.y + (event.clientY - d.lastY) / scale } });
  } else {
    // auto-fit: the body keeps its place in the order where the pointer is
    const world = view.worldAt(event.clientX, event.clientY);
    const placed = resolve(p).placed;
    let target = d.index;
    placed.forEach((q, i) => {
      if (i === d.index) return;
      if (i > d.index && world.x > q.x) target = Math.max(target, i);
      if (i < d.index && world.x < q.x) target = Math.min(target, i);
    });
    if (target !== d.index) {
      d.current = moveInOrder(p, d.index, target);
      d.index = target;
      ui.selected = target;
    }
  }
  d.lastX = event.clientX;
  d.lastY = event.clientY;
  preview(d.current);
});

function finish(event: PointerEvent): void {
  touches.delete(event.pointerId);
  if (pinch !== undefined && touches.size < 2) {
    const final = view.portrait;
    const base = pinch.base;
    pinch = undefined;
    if (final !== base) change(final);
    return;
  }
  const d = drag;
  if (d === undefined || d.pointer !== event.pointerId) return;
  drag = undefined;
  ui.guides = [];
  if (d.moved && d.current !== d.base) change(d.current);
  else render();
}
wrap.addEventListener("pointerup", finish);
wrap.addEventListener("pointercancel", finish);

// the wheel over the view zooms it about the pointer (Manual); Shift and the wheel over a body sizes it
let wheelTimer: ReturnType<typeof setTimeout> | undefined;
let wheelBase: Portrait | undefined;
wrap.addEventListener(
  "wheel",
  (event) => {
    const p = wheelBase ?? scene();
    if (p.layout !== "manual") return;
    const index = view.pick(event.clientX, event.clientY);
    const size = event.shiftKey && index >= 0;
    if (!size && !event.ctrlKey && !event.metaKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const delta = event.deltaY || (size ? event.deltaX : 0);
    const k = Math.exp(-delta * (event.deltaMode === 1 ? 0.03 : 0.0018));
    const now = view.portrait;
    const h = clamp(now.camera.h / k, 1e-4, 1e4);
    if (!size && h === now.camera.h && wheelBase === undefined && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    wheelBase ??= scene();
    let next: Portrait;
    if (size) next = setItem(now, index, { r: clamp(now.items[index]!.r * k, 0.003, 4) });
    else {
      const at = view.worldAt(event.clientX, event.clientY);
      const f = h / now.camera.h;
      next = setPortrait(now, { camera: { x: at.x - (at.x - now.camera.x) * f, y: at.y - (at.y - now.camera.y) * f, h } });
    }
    if (size) ui.selected = index;
    preview(next);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      const final = view.portrait;
      wheelBase = undefined;
      change(final);
    }, 300);
  },
  { passive: false },
);

// --- the keyboard ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
wrap.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const p = scene();
  const i = ui.selected;
  const item = p.items[i];
  const big = event.shiftKey;
  const px = (big ? 10 : 1) / Math.max(1e-9, view.metrics.scale);
  let handled = true;
  if (event.key === "Escape") select(-1);
  else if (item === undefined) handled = false;
  else if (event.key === "Delete" || event.key === "Backspace") change(removeBody(p, item.body));
  else if (event.key === "PageUp") reorder((n) => n + 1);
  else if (event.key === "PageDown") reorder((n) => n - 1);
  else if (event.key === "Home") reorder(() => 0);
  else if (event.key === "End") reorder((_n, count) => count - 1);
  else if (event.key === "[" || event.key === "]") {
    if (p.layout === "manual") change(setItem(p, i, { r: clamp(item.r * (event.key === "]" ? 1.07 : 1 / 1.07), 0.003, 4) }), "size");
  } else if (event.key.startsWith("Arrow")) {
    const sx = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    const sy = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (ui.tool === "turn") {
      // the surface goes the way the key points: right turns the body so its surface moves right, up so it moves up
      change(setItem(p, i, { spin: item.spin - sx * (big ? 20 : 5), pitch: clamp((item.pitch ?? defaultPitch(item.body)) - sy * (big ? 20 : 5), -90, 90) }), "turn");
    } else if (p.layout === "manual") change(setItem(p, i, { x: item.x + sx * px, y: item.y + sy * px }), "nudge");
    else if (sx !== 0) reorder((n) => n + sx);
    else handled = false;
  } else handled = false;
  if (handled) event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("input, textarea, select")) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    if (event.shiftKey) history.redo();
    else history.undo();
    render();
  } else if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    history.redo();
    render();
  }
});

// --- sharing ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const shareStatus = $("#share-status");
const told = (text: string): void => {
  shareStatus.textContent = text;
  setTimeout(() => (shareStatus.textContent = ""), 2500);
};
const save = (blob: Blob, file: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
$("#link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    told(say("pt_linked"));
  } catch {
    told(say("copyFail"));
  }
});
$("#png").addEventListener("click", async () => {
  try {
    save(await view.toPng(2), "wakusei-portrait.png");
    told(say("pt_saved"));
  } catch {
    told(say("pt_failed"));
  }
});
$("#svg").addEventListener("click", async () => {
  try {
    save(new Blob([await view.toSvg()], { type: "image/svg+xml" }), "wakusei-portrait.svg");
    told(say("pt_saved"));
  } catch {
    told(say("pt_failed"));
  }
});

view.addEventListener("wakusei-state", (event) => {
  const { state } = (event as CustomEvent<{ state: string }>).detail;
  if (state === "unavailable") $("#hint").textContent = say("noWebgl");
});
window.addEventListener("wakusei-language", () => render());
Object.assign(globalThis, { wakuseiPortraitDebug: { scene, history } });
showTab("bodies");
render();
