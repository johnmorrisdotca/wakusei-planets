import { MOON_FILTER_GROUPS, normalizeMoonFilter, type MoonFilter } from "../src/moon-filters.ts";
import type { CatalogueMoon, MoonGroup } from "../src/moon-catalogue.ts";

type Lang = "en" | "ja";
type Choice = "status" | "size" | "direction";
const FIRST = 1610;
const LAST = 2026;
const CHOICES = {
  status: ["named", "numbered", "provisional"],
  size: ["major", "measured", "estimated"],
  direction: ["prograde", "retrograde"],
} as const;

const words = {
  any: ["Any", "すべて"],
  status: ["Naming status", "命名状況"],
  size: ["Size class", "大きさの区分"],
  direction: ["Orbit direction", "公転方向"],
  named: ["IAU named", "IAU正式名称あり"],
  numbered: ["Numbered", "番号あり"],
  provisional: ["Provisional", "仮符号のみ"],
  major: ["Major", "主要衛星"],
  measured: ["Measured", "測定値"],
  estimated: ["Estimated", "推定値"],
  prograde: ["Prograde", "順行"],
  retrograde: ["Retrograde", "逆行"],
  more: ["More filters", "その他の絞り込み"],
  group: ["Orbit group", "軌道のグループ"],
  from: ["Discovered from", "発見年の下限"],
  to: ["Discovered through", "発見年の上限"],
  play: ["Play discoveries", "発見順に再生"],
  pause: ["Pause discoveries", "発見順の再生を一時停止"],
  clear: ["Clear years", "発見年の指定を解除"],
  off: ["Off", "表示しない"],
  all: ["All moons", "すべての衛星"],
  moons: ["Moons", "衛星"],
  orbits: ["Moon orbits", "衛星の軌道"],
  close: ["Close moon details", "衛星の詳細を閉じる"],
  designation: ["Designation", "仮符号"],
  number: ["Number", "番号"],
  discovery: ["Discovery", "発見"],
  orbit: ["Orbit", "軌道"],
  radius: ["Radius", "半径"],
  accuracy: ["Position accuracy", "位置の精度"],
  noOrbit: ["No orbit in the catalogue", "カタログに軌道データなし"],
  noRadius: ["No radius in the catalogue", "カタログに半径データなし"],
  noDate: ["Discovery year unavailable", "発見年の記録なし"],
  sheet: ["Horizons data sheet", "Horizonsデータシート"],
  source: ["Source data", "出典"],
  unknown: ["No comparison with Horizons", "Horizonsとの比較なし"],
  full: ["Full ephemeris", "高精度の位置計算"],
  newest: ["Newest in this result", "この結果で最も新しい発見"],
} as const;

export const moonWord = (key: keyof typeof words, lang: Lang): string => words[key][lang === "ja" ? 1 : 0];
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => Object.assign(document.createElement(tag), className === undefined ? {} : { className });

export function createMoonControls(root: HTMLElement, changed: (filter: MoonFilter) => void, groupName: (group: MoonGroup, lang: Lang) => string) {
  let filter: MoonFilter = {};
  let lang: Lang = "en";
  let interval: ReturnType<typeof setInterval> | undefined;
  let enabled = false;
  const groups = new Map<Choice, { row: HTMLElement; title: HTMLElement; buttons: HTMLButtonElement[] }>();
  const chips = node("div", "moon-filter-chips");
  const details = node("details");
  const summary = node("summary");
  const more = node("div", "moon-filter-more");
  const groupLabel = node("label", "field");
  const groupText = node("span");
  const group = node("select", "fam-field");
  groupLabel.append(groupText, group);
  group.addEventListener("change", () => set({ ...filter, group: (group.value || undefined) as MoonGroup | undefined }));

  function button(action: () => void, className?: string): HTMLButtonElement {
    const element = node("button", className);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  }
  for (const key of Object.keys(CHOICES) as Choice[]) {
    const row = node("div", "group fam-seg");
    row.setAttribute("role", "group");
    const title = node("span", "fam-fine");
    const buttons = ["", ...CHOICES[key]].map((value) => {
      const choice = button(() => set({ ...filter, [key]: value || undefined }));
      choice.dataset["moonValue"] = value;
      choice.dataset["moonFilter"] = key;
      return choice;
    });
    row.append(...buttons);
    const field = node("div", "moon-filter-field");
    field.append(title, row);
    chips.append(field);
    groups.set(key, { row, title, buttons });
  }
  const range = (key: "from" | "to") => {
    const label = node("label", "moon-range");
    const title = node("span");
    const input = node("input");
    const value = node("output");
    input.type = "range";
    input.min = String(FIRST);
    input.max = String(LAST);
    input.dataset["moonYear"] = key;
    input.addEventListener("input", () => {
      stop();
      const current = Number(input.value);
      const from = key === "from" ? current : Math.min(current, filter.discovered?.from ?? FIRST);
      const to = key === "to" ? current : Math.max(current, filter.discovered?.to ?? LAST);
      set({ ...filter, discovered: { from, to } });
    });
    label.append(title, value, input);
    return { label, title, input, value };
  };
  const from = range("from");
  const to = range("to");
  const play = button(toggle, "fam-button");
  play.dataset["moonPlay"] = "";
  const clear = button(() => {
    stop();
    set({ ...filter, discovered: undefined });
  }, "fam-button");
  const actions = node("div", "fam-row");
  actions.append(play, clear);
  more.append(groupLabel, from.label, to.label, actions);
  details.append(summary, more);
  root.append(chips, details);
  details.addEventListener("toggle", () => { if (!details.open) stop(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(([entry]) => { if (entry?.isIntersecting === false) stop(); }).observe(root);
  }

  function set(next: MoonFilter): void {
    filter = normalizeMoonFilter(next);
    sync();
    changed(filter);
  }
  function stop(): void {
    clearInterval(interval);
    interval = undefined;
    play.textContent = moonWord("play", lang);
    play.setAttribute("aria-pressed", "false");
  }
  function toggle(): void {
    if (interval !== undefined) {
      stop();
      return;
    }
    if (!enabled) return;
    set({ ...filter, discovered: { from: FIRST, to: FIRST } });
    interval = setInterval(() => {
      const year = Math.min(LAST, (filter.discovered?.to ?? FIRST) + 8);
      set({ ...filter, discovered: { from: FIRST, to: year } });
      if (year === LAST) stop();
    }, 125);
    sync();
  }

  function sync(): void {
    for (const [key, { row, title, buttons }] of groups) {
      title.textContent = moonWord(key, lang);
      row.setAttribute("aria-label", title.textContent);
      for (const item of buttons) {
        const value = item.dataset["moonValue"] as keyof typeof words | "";
        item.textContent = moonWord(value || "any", lang);
        item.setAttribute("aria-pressed", String((filter[key] ?? "") === value));
      }
    }
    group.value = filter.group ?? "";
    groupText.textContent = moonWord("group", lang);
    summary.textContent = moonWord("more", lang);
    const start = filter.discovered?.from ?? FIRST;
    const end = filter.discovered?.to ?? LAST;
    from.title.textContent = moonWord("from", lang);
    from.input.value = from.value.value = String(start);
    to.title.textContent = moonWord("to", lang);
    to.input.value = to.value.value = String(end);
    clear.textContent = moonWord("clear", lang);
    clear.disabled = filter.discovered === undefined;
    play.textContent = moonWord(interval === undefined ? "play" : "pause", lang);
    play.setAttribute("aria-pressed", String(interval !== undefined));
  }

  let key = "";
  return {
    render(active: boolean, value: MoonFilter, language: Lang, used: readonly MoonGroup[] = MOON_FILTER_GROUPS): void {
      enabled = active;
      root.hidden = !active;
      if (!active && interval !== undefined) stop();
      if (!active) return;
      filter = value;
      lang = language;
      const groupKey = `${language}|${used.join(",")}|${value.group ?? ""}`;
      if (key !== groupKey) {
        key = groupKey;
        const options = value.group !== undefined && !used.includes(value.group) ? [...used, value.group] : used;
        group.replaceChildren(new Option(moonWord("any", lang), ""), ...options.map((id) => new Option(groupName(id, lang), id)));
      }
      sync();
    },
  };
}

export function showMoonCard(root: HTMLElement, moon: CatalogueMoon, lang: Lang, latest?: number, focus = false): void {
  const word = (key: keyof typeof words): string => moonWord(key, lang);
  const num = (n: number): string => n.toLocaleString(lang, { maximumFractionDigits: 3 });
  const heading = node("h3");
  heading.textContent = lang === "ja" ? moon.ja ?? moon.label : moon.label;
  heading.tabIndex = -1;
  const opener = document.activeElement;
  const englishName = lang === "ja" && moon.ja !== null ? moon.name : null;
  const close = node("button", "fam-button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", word("close"));
  close.addEventListener("click", () => {
    root.hidden = true;
    if (opener instanceof HTMLElement && opener.isConnected && !root.contains(opener)) opener.focus({ preventScroll: true });
  });
  const list = node("dl");
  const add = (label: string, value: string): void => {
    const term = node("dt");
    term.textContent = label;
    const definition = node("dd");
    definition.textContent = value;
    list.append(term, definition);
  };
  if (englishName !== null) add(lang === "ja" ? "英語名" : "English name", englishName);
  if (moon.designation !== null) add(word("designation"), moon.designation);
  if (moon.number !== null) add(word("number"), moon.number);
  add(word("status"), word(moon.named ? "named" : moon.number !== null ? "numbered" : "provisional"));
  const found = moon.discovery;
  add(word("discovery"), [found.year ?? word("noDate"), found.by, found.reference].filter(Boolean).join(" · "));
  const orbit = moon.orbit;
  add(word("orbit"), orbit === null ? word("noOrbit") : [
    word(moon.retrograde ? "retrograde" : "prograde"),
    `${num(orbit.a)} km`,
    lang === "ja" ? `${num(orbit.periodDays)} 日` : `${num(orbit.periodDays)} days`,
    `i = ${num(orbit.i)}°`,
  ].join(" · "));
  add(word("radius"), moon.radiusKm === null ? word("noRadius") : `${num(moon.radiusKm)}${moon.radiusSigmaKm === null ? "" : ` ± ${num(moon.radiusSigmaKm)}`} km${moon.radiusFrom ? ` · ${word(moon.radiusFrom === "derived" ? "estimated" : moon.radiusFrom)}` : ""}`);
  const accuracy = moon.accuracy;
  add(word("accuracy"), moon.full ? word("full") : accuracy === null ? word("unknown") : `${num(accuracy.worstDegrees)}° · ${num(accuracy.worstKm)} km${lang === "ja" ? "（最大差）" : " maximum difference"}`);
  const credited = node("p", "fam-fine");
  const source = node("a");
  source.href = "https://ssd.jpl.nasa.gov/sats/discovery.html";
  source.textContent = "NASA/JPL";
  const orbitSource = node("a");
  orbitSource.href = "https://ssd.jpl.nasa.gov/sats/elem/";
  const meanElements = lang === "ja" ? "平均軌道要素" : "Mean elements";
  orbitSource.textContent = orbit === null ? meanElements : `${meanElements} (${orbit.ephemeris})`;
  const sizeSource = node("a");
  sizeSource.href = moon.radiusFrom === "measured" ? "https://ssd.jpl.nasa.gov/sats/phys_par/" : "https://ssd.jpl.nasa.gov/horizons/";
  sizeSource.textContent = moon.radiusFrom === "measured" ? word("measured") : "Horizons";
  credited.append(`${word("source")} `, source, " · ", orbitSource, " · ", sizeSource);
  const newest = node("p", "fam-fine");
  newest.textContent = word("newest");
  newest.hidden = latest === undefined || found.year !== latest;
  root.replaceChildren(heading, close, newest, list, credited);
  root.hidden = false;
  if (focus) heading.focus();
}
