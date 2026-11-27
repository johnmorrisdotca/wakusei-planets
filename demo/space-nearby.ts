import { BODIES, type BodyId } from "../src/facts.ts";

type Tab = "nearby" | "approaches";
type Mode = "sky" | "space";
type Match = { a: BodyId; b: BodyId; angle?: number; km?: number; event?: number };
type Words = (key: string, values?: Record<string, string | number>) => string;

interface NearbyOptions {
  time: () => number;
  target: () => BodyId;
  language: () => "en" | "ja";
  say: Words;
  show: (pair: Match) => void;
}

const DAY = 86_400_000;
const DAYS_AHEAD = 90;
const COUNT = 5;
const TABS: readonly Tab[] = ["nearby", "approaches"];

/** The two lists take a snapshot of the demo clock on selection, explicit date changes or when the clock pauses. */
export function bindSpaceNearby(panel: HTMLElement, options: NearbyOptions): { dateChanged: (time: number) => void; targetChanged: () => void; languageChanged: () => void } {
  const buttons = [...panel.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const tabs = [...panel.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  const space = panel.querySelector<HTMLButtonElement>("#nearby-space")!;
  const sky = panel.querySelector<HTMLButtonElement>("#nearby-sky")!;
  const targetLabel = panel.querySelector<HTMLElement>("#nearby-target")!;
  const notes = {
    nearby: panel.querySelector<HTMLElement>("#nearby-note")!,
    approaches: panel.querySelector<HTMLElement>("#approaches-note")!,
  };
  const lists = {
    nearby: panel.querySelector<HTMLOListElement>("#nearby-results")!,
    approaches: panel.querySelector<HTMLOListElement>("#approaches-results")!,
  };

  let math: Promise<typeof import("../src/nearest.ts")> | undefined;
  let active = false;
  let tab: Tab = "nearby";
  let mode: Mode = "space";
  let time = 0;
  let revision = 0;
  const cache = new Map<Tab, { key: string; rows: Match[] }>();
  const displayed = new Map<Tab, string>();
  const name = (id: BodyId): string => BODIES[id].name[options.language()];
  const locale = () => options.language() === "ja" ? "ja-JP" : "en-CA";
  const local = (ms: number): string => new Date(ms).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" });

  function rowsOf(rows: readonly Match[]): DocumentFragment {
    const fragment = document.createDocumentFragment();
    for (const match of rows) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fam-button";
      button.dataset["pair"] = `${match.a} ${match.b}`;
      if (match.event !== undefined) button.dataset["eventTime"] = String(match.event);
      const title = document.createElement("span");
      title.textContent = match.event === undefined ? name(match.b) : options.say("sp_near_pair", { a: name(match.a), b: name(match.b) });
      const value = document.createElement("span");
      value.className = "fam-fine";
      const separation = match.angle === undefined
        ? `${Math.round(match.km ?? 0).toLocaleString(locale())} km`
        : `${match.angle.toLocaleString(locale(), { maximumFractionDigits: 2 })}°`;
      value.textContent = separation;
      button.append(title);
      if (match.event !== undefined) {
        const date = document.createElement("time");
        date.className = "fam-fine nearby-event-date";
        date.dateTime = new Date(match.event).toISOString();
        date.textContent = local(match.event);
        button.append(date);
      }
      button.append(value);
      button.addEventListener("click", () => {
        // Jumping to the event replaces its row. Keep keyboard focus inside the panel.
        if (match.event !== undefined && document.activeElement === button) buttons[1]!.focus({ preventScroll: true });
        options.show(match);
      });
      item.append(button);
      fragment.append(item);
    }
    return fragment;
  }

  async function refresh(): Promise<void> {
    const id = ++revision;
    const currentTab = tab;
    const date = time;
    const target = options.target();
    const by = target === "earth" ? "space" : mode;
    const note = notes[currentTab];
    const list = lists[currentTab];
    const key = currentTab === "nearby" ? `${date}|${target}|${by}` : String(date);
    const displayKey = `${key}|${options.language()}`;
    space.setAttribute("aria-pressed", String(by === "space"));
    sky.setAttribute("aria-pressed", String(by === "sky"));
    sky.disabled = target === "earth";
    targetLabel.textContent = options.say("sp_near_target", { name: name(target) });
    const describe = (): string => currentTab === "approaches"
      ? options.say("sp_near_window", { date: local(date), days: DAYS_AHEAD })
      : options.say(target === "earth" ? "sp_near_earth" : "sp_near_date", { date: local(date) });

    const previous = cache.get(currentTab);
    if (previous?.key === key) {
      if (displayed.get(currentTab) === displayKey) return;
      note.textContent = previous.rows.length ? describe() : options.say("sp_near_empty", { days: DAYS_AHEAD });
      list.replaceChildren(rowsOf(previous.rows));
      displayed.set(currentTab, displayKey);
      return;
    }
    note.textContent = options.say("sp_near_loading");
    list.replaceChildren();
    displayed.delete(currentTab);
    try {
      const { nearest, conjunctions } = await (math ??= import("../src/nearest.ts"));
      if (id !== revision) return;
      const rows: Match[] = currentTab === "approaches"
        ? conjunctions({ from: date, to: date + DAYS_AHEAD * DAY }).slice(0, COUNT).map((row) => ({ a: row.a, b: row.b, angle: row.angle, event: row.time.getTime() }))
        : by === "space"
          ? nearest(target, { by, date, count: COUNT }).map((row) => ({ a: target, b: row.id, km: row.distanceKm }))
          : nearest(target, { by, date, count: COUNT }).map((row) => ({ a: target, b: row.id, angle: row.angle }));
      cache.set(currentTab, { key, rows });
      note.textContent = rows.length ? describe() : options.say("sp_near_empty", { days: DAYS_AHEAD });
      list.replaceChildren(rowsOf(rows));
      displayed.set(currentTab, displayKey);
    } catch {
      if (id !== revision) return;
      math = undefined;
      note.textContent = options.say("sp_near_error");
    }
  }

  function activate(next: Tab): void {
    active = true;
    tab = next;
    time = Math.floor(options.time() / 1000) * 1000;
    for (const [i, name] of TABS.entries()) {
      buttons[i]!.setAttribute("aria-selected", String(name === tab));
      buttons[i]!.tabIndex = name === tab ? 0 : -1;
      tabs[i]!.hidden = name !== tab;
    }
    void refresh();
  }

  buttons.forEach((button, index) => {
    button.addEventListener("click", () => activate(TABS[index]!));
    button.addEventListener("keydown", (event) => {
      const next = event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1
        : event.key === "ArrowLeft" || event.key === "ArrowRight" ? 1 - index : -1;
      if (next < 0) return;
      event.preventDefault();
      activate(TABS[next]!);
      buttons[next]!.focus();
    });
  });
  for (const [button, next] of [[space, "space"], [sky, "sky"]] as const) {
    button.addEventListener("click", () => {
      mode = next;
      activate("nearby");
    });
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    if (!active) activate(tab);
  });
  observer.observe(panel);

  return {
    dateChanged(ms) {
      const next = Math.floor(ms / 1000) * 1000;
      if (!active || time === next) return;
      time = next;
      void refresh();
    },
    targetChanged() {
      if (active && tab === "nearby") {
        time = Math.floor(options.time() / 1000) * 1000;
        void refresh();
      }
    },
    languageChanged() {
      if (active) void refresh();
    },
  };
}
