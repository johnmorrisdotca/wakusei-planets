// Screen-reader words for a covered arrow. A language is a row here. `{bodies}` are the bodies hidden behind the disc, `{cover}` is the body in front, and `{hint}` is the page's own hint.

/** The phrase a covered arrow says, by language. An unknown language uses the English row. */
export const COVERED_ARROW_WORDS: Readonly<Record<string, string>> = {
  en: "{bodies}: {cover} is in front. {hint}",
  ja: "{bodies}: {cover} の後ろ. {hint}",
};

/** The screen-reader label for one covered arrow, in `lang`, filled from `COVERED_ARROW_WORDS`. */
export const coveredArrowLabel = (lang: string | null, parts: { bodies: string; cover: string; hint: string }): string =>
  (COVERED_ARROW_WORDS[lang ?? ""] ?? COVERED_ARROW_WORDS["en"]!).replace(/\{(bodies|cover|hint)\}/g, (_all, name: string) => parts[name as keyof typeof parts]);
