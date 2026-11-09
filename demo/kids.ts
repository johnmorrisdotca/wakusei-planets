// The kids' page: type a weight and a birthday and every world's card shows what you weigh there and how old you are. Nothing is stored: the weight and the birthday live in the two fields and are gone with the page.
import { BODIES, lineSvg } from "../src/index.ts";
import { ageOn, nextBirthdayOn, surfaceGravity, weightOn, type WorldId } from "../src/kids.ts";
import { WORDS } from "./words.js";

const chooser = (): { lang: "en" | "ja"; word(key: string): string | undefined } | undefined => Reflect.get(globalThis, "wakuseiLanguage") as { lang: "en" | "ja"; word(key: string): string | undefined } | undefined;
const language = (): "en" | "ja" => chooser()?.lang ?? "en";
const say = (key: string, values: Record<string, string | number> = {}): string => (chooser()?.word(key) ?? WORDS.en[key] ?? key).replace(/\{(\w+)\}/g, (all, name: string) => String(values[name] ?? all));

/** The Sun, the planets, Pluto, the Moon and the big moons, nearest the Sun first. */
const CARDS: readonly WorldId[] = ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto", "moon", "io", "europa", "ganymede", "callisto", "titan", "triton"];
const CLOUD_TOPS: readonly WorldId[] = ["jupiter", "saturn", "uranus", "neptune"];

const weightField = document.querySelector<HTMLInputElement>("#weight")!;
const birthdayField = document.querySelector<HTMLInputElement>("#birthday")!;
const unitButtons = [...document.querySelectorAll<HTMLButtonElement>("#units [data-unit]")];
const warn = document.querySelector<HTMLElement>("#warn")!;
const cards = document.querySelector<HTMLUListElement>("#cards")!;

let unit = "kg";
const number = (value: number, options: Intl.NumberFormatOptions): string => value.toLocaleString(language() === "ja" ? "ja-JP" : "en-CA", options);
const years = (value: number): string => (value >= 1 ? number(value, { maximumFractionDigits: 1 }) : number(value, { maximumSignificantDigits: 2 }));
const todayUtc = (): number => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
};
/** A date field's text as midnight UTC, or undefined when it holds no date. */
const birthdayMs = (): number | undefined => {
  const match = /^(\d{4})-(\d\d)-(\d\d)$/.exec(birthdayField.value);
  return match === null ? undefined : Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const line = (parent: HTMLElement, className: string, text: string): HTMLElement => {
  const el = document.createElement("p");
  el.className = className;
  el.textContent = text;
  parent.append(el);
  return el;
};

function card(id: WorldId, weight: number | undefined, birth: number | undefined, today: number): HTMLElement {
  const item = document.createElement("li");
  item.className = "kids-card";
  item.dataset["world"] = id;
  const lang = language();
  const drawing = document.createElement("div");
  drawing.className = "kids-art";
  drawing.innerHTML = lineSvg(id, { size: 160, lang, labels: false });
  const heading = document.createElement("h3");
  heading.textContent = BODIES[id].name[lang];
  item.append(drawing, heading);
  line(item, "kids-pull", say("kids_pull", { x: number(surfaceGravity(id).relativeToEarth, { maximumSignificantDigits: 2 }) }));
  if (CLOUD_TOPS.includes(id)) line(item, "kids-cloud", "☁ 1 bar").dataset["cloud"] = "1";
  const weighs = document.createElement("div");
  weighs.className = "kids-answer kids-weight";
  line(weighs, "kids-label", say("kids_weigh"));
  if (weight === undefined) line(weighs, "kids-none", say("kids_weigh_none"));
  else line(weighs, "kids-big", `${number(weightOn(id, weight), { maximumFractionDigits: 1 })} ${unit}`);
  item.append(weighs);
  const old = document.createElement("div");
  old.className = "kids-answer kids-age";
  line(old, "kids-label", say("kids_age"));
  if (birth === undefined) line(old, "kids-none", say("kids_age_none"));
  else {
    const age = ageOn(id, birth, today);
    const next = nextBirthdayOn(id, birth, today);
    if (age === null || next === null) line(old, "kids-none", say("kids_sun"));
    else {
      line(old, "kids-big", `${years(age.years)} ${say("kids_years")}`);
      if (age.days !== null) line(old, "kids-small", say("kids_days", { n: number(Math.floor(age.days), {}) }));
      const when = next.date.toLocaleDateString(lang === "ja" ? "ja-JP" : "en-CA", { dateStyle: "long", timeZone: "UTC" });
      line(old, "kids-small", `${say("kids_next")}: ${when}, ${next.inEarthDays < 1 ? say("kids_today") : say("kids_in_days", { n: number(Math.ceil(next.inEarthDays), {}) })} (${say("kids_turns", { n: next.turns })})`);
    }
  }
  item.append(old);
  return item;
}

function render(): void {
  const raw = weightField.value.trim();
  const entered = raw === "" ? undefined : Number(raw);
  const weight = entered !== undefined && Number.isFinite(entered) && entered > 0 ? entered : undefined;
  const today = todayUtc();
  let birth = birthdayMs();
  const problems: string[] = [];
  if (entered !== undefined && weight === undefined) problems.push(say("kids_bad_weight"));
  if (birth !== undefined && birth > today) {
    birth = undefined;
    problems.push(say("kids_bad_birthday"));
  }
  const message = problems.join(" ");
  warn.textContent = message;
  warn.hidden = message === "";
  for (const button of unitButtons) button.setAttribute("aria-pressed", String(button.dataset["unit"] === unit));
  cards.replaceChildren(...CARDS.map((id) => card(id, weight, birth, today)));
}

weightField.addEventListener("input", render);
birthdayField.addEventListener("input", render);
for (const button of unitButtons) button.addEventListener("click", () => {
  unit = button.dataset["unit"] ?? "kg";
  render();
});
window.addEventListener("wakusei-language", render);
render();
