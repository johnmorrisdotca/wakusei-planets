import type { Interior, InteriorRow } from "./interior.ts";

/** The same radial geometry can represent a planet or a selected stellar model. */
export type InteriorProfile = Omit<Interior, "body"> & Partial<Pick<Interior, "body">>;

/** Three significant figures, so derived boundaries do not look more precise than the model. */
function round3(n: number): number {
  if (n === 0) return 0;
  const scale = 10 ** (Math.floor(Math.log10(Math.abs(n))) - 2);
  return Math.round(n / scale) * scale;
}

function depthEnd(n: number, about: boolean, lang: "en" | "ja"): string {
  const text = `${round3(n).toLocaleString(lang === "ja" ? "ja-JP" : "en-CA", { maximumFractionDigits: 0 })} km`;
  if (!about) return text;
  return lang === "ja" ? `約${text}` : `about ${text}`;
}

/** List the outermost layer first, using depth below the surface or radius from the centre. */
export function rowsForInterior(interior: InteriorProfile, lang: "en" | "ja", fromCentre = false): InteriorRow[] {
  const { radiusKm, layers } = interior;
  const rows: InteriorRow[] = [];
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i]!;
    const inner = layers[i - 1];
    const innerKm = inner?.outerKm ?? 0, innerAbout = inner?.about ?? false;
    const from = fromCentre ? depthEnd(innerKm, innerAbout, lang) : depthEnd(radiusKm - layer.outerKm, layer.about, lang);
    const to = fromCentre ? depthEnd(layer.outerKm, layer.about, lang) : depthEnd(radiusKm - innerKm, innerAbout, lang);
    rows.push({ id: layer.id, name: layer.name[lang], depth: lang === "ja" ? `${from} から ${to}` : `${from} to ${to}`, madeOf: layer.madeOf[lang], colour: layer.colour });
  }
  return rows;
}
