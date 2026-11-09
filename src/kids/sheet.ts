// The printable page of a colouring sheet: kazoku-ui's print sheet (header with the brand, the package, the title and a Name box; footer with credits, version and a QR code back to the demo)
// around the sheet's one SVG. Needs a DOM; the picture itself (`kidsSvg`) does not.
import { buildSheet, printCss, type Layout, type PageName } from "@johnmorrisdotca/kazoku-ui/print";
import { VERSION } from "../version.ts";
import { SAY, kidsName, type KidsSheet, type Lang } from "./data.ts";
import { kidsOrientation, kidsRoom, kidsSvg } from "./svg.ts";

/** Where the sheets are on the web: the demo's address, and the QR code on each sheet leads to its own. */
export const KIDS_ADDRESS = "https://johnmorrisdotca.github.io/wakusei-planets/kids.html";

/**
 * What to build a sheet with: the paper, the language, the date and the address for the QR code.
 *
 * @example
 * ```ts
 * import { type KidsOptions } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * const options: KidsOptions = { page: "letter", language: "ja" };
 * console.log(options.page);
 * ```
 */
export interface KidsOptions {
  /** `a4`, `letter`, `a3` or `tabloid`. Default `a4`. */
  page?: PageName;
  language?: Lang;
  /** Written in the footer; a `Date` as `YYYY-MM-DD`. Default: today. */
  date?: Date | string;
  /** The address printed in the footer as a QR code. Default: this sheet's place in the demo. */
  address?: string;
}

/**
 * The layout of a sheet, to give kazoku-ui's `printCss`: its paper, its turn (the lineup lies on its side), large type for children and the language.
 * @param id - A body with a sheet, or `lineup`.
 * @param options - The paper and the language.
 * @returns The layout.
 *
 * @example
 * ```ts
 * import { kidsLayout } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * console.log(kidsLayout("lineup", { page: "letter" }));
 * ```
 */
export const kidsLayout = (id: KidsSheet, options: KidsOptions = {}): Partial<Layout> => ({ page: options.page ?? "a4", orientation: kidsOrientation(id), type: "kid", language: options.language ?? "en" });

/** A sheet's title: the body's name, or for the lineup its own. */
export const kidsTitle = (id: KidsSheet, lang: Lang): string => (id === "lineup" ? SAY[lang].lineup : kidsName(id, lang));

/**
 * A printable colouring sheet: one `.kazoku-sheet` with one page holding the sheet's SVG, in kazoku-ui's print layout (add `printCss(kidsLayout(id, options))` to the page, and print with `printSheet`).
 * @param id - A body with a sheet, or `lineup`.
 * @param options - The paper, the language, the date and the address for the QR code.
 * @returns The sheet's element.
 *
 * @example
 * ```ts no-run
 * import { printCss, printSheet } from "@johnmorrisdotca/kazoku-ui/print";
 * import { kidsLayout, kidsSheet } from "@johnmorrisdotca/wakusei-planets/sheets";
 *
 * const style = document.createElement("style");
 * style.textContent = printCss(kidsLayout("saturn", { page: "letter" }));
 * document.head.append(style);
 * const sheet = kidsSheet("saturn", { page: "letter" });
 * document.body.append(sheet);
 * printSheet(sheet);
 * ```
 */
export function kidsSheet(id: KidsSheet, options: KidsOptions = {}): HTMLElement {
  const layout = kidsLayout(id, options);
  const lang = options.language ?? "en";
  const holder = document.createElement("div");
  holder.style.cssText = "position:absolute;inset:0";
  const sheet = buildSheet({
    ...layout,
    brand: SAY[lang].brand,
    packageName: SAY[lang].pack,
    title: kidsTitle(id, lang),
    credits: SAY[lang].credits,
    version: VERSION,
    date: options.date ?? new Date(),
    address: options.address ?? `${KIDS_ADDRESS}?sheet=${id}`,
    pages: [holder],
  });
  holder.innerHTML = kidsSvg(id, { ...roomOf(sheet, layout, kidsRoom(layout.page!, layout.orientation)), lang });
  return sheet;
}

/** The room the page's body really has: the sheet is laid out out of sight for a moment, with the print rules, and measured, so the picture is drawn at the size it will print. */
function roomOf(sheet: HTMLElement, layout: Partial<Layout>, estimate: { widthMm: number; heightMm: number }): { widthMm: number; heightMm: number } {
  const style = document.createElement("style");
  style.textContent = printCss(layout);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden";
  host.append(sheet);
  document.head.append(style);
  document.body.append(host);
  const body = sheet.querySelector(".kazoku-body")?.getBoundingClientRect();
  host.remove();
  style.remove();
  if (body === undefined || body.height === 0) return estimate;
  const mm = 25.4 / 96;
  return { widthMm: Math.floor(body.width * mm * 10) / 10, heightMm: Math.floor(body.height * mm * 10) / 10 };
}
