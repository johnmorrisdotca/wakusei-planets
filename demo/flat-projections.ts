// The projections panel of the flat page: any body with a painted map, drawn in one of five projections with the graticule and the Sun's place. The picture is the package's own equirectangular texture, read once into pixels
// and resampled by `resampleMap`; the lines and the Sun's ring are a second canvas drawn over it. Nothing is drawn at rest: a change of body, projection, lines, middle, size, language or a Sun that moved a pixel draws again, and nothing else.
import { BODIES, type BodyId } from "../src/facts.ts";
import { PROJECTIONS, coordinateText, fitMap, graticule, isProjection, mapExtent, mapOutline, mapPixels, mapSun, resampleMap, type MapCentre, type ProjectionId } from "../src/flat/index.ts";

/** The bodies with a painted map, in the order of the Sun's family. */
export const PROJECTED_BODIES = ["mercury", "venus", "earth", "moon", "mars", "ceres", "vesta", "jupiter", "io", "europa", "ganymede", "callisto", "saturn", "mimas", "enceladus", "tethys", "dione", "rhea", "titan", "iapetus", "uranus", "neptune", "triton", "pluto", "charon"] as const satisfies readonly BodyId[];
type Projected = (typeof PROJECTED_BODIES)[number];
const isProjected = (value: unknown): value is Projected => typeof value === "string" && (PROJECTED_BODIES as readonly string[]).includes(value);
const LINES = ["0", "30", "15"] as const;

export interface ProjectionsHost {
  say(key: string, values?: Record<string, string | number>): string;
  lang(): "en" | "ja";
  /** The moment shown above, in milliseconds since 1970. */
  time(): number;
  get(key: string): string | null | undefined;
  set(key: string, value: string | null): void;
  textureBase: string;
}

export function startProjections(host: ProjectionsHost): { render(): void; stats(): { draws: number; overlayDraws: number; body: string; projection: string; loaded: boolean } } {
  const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
  const select = $<HTMLSelectElement>("#pj-body");
  const projBox = $("#pj-proj");
  const linesBox = $("#pj-lines");
  const lonInput = $<HTMLInputElement>("#pj-lon");
  const latInput = $<HTMLInputElement>("#pj-lat");
  const latField = $("#pj-lat-field");
  const canvas = $<HTMLCanvasElement>("#projected");
  const caption = $("#pj-caption");

  const askedBody = host.get("pbody");
  const askedProjection = host.get("proj");
  let body: Projected = isProjected(askedBody) ? askedBody : "mars";
  let projection: ProjectionId = isProjection(askedProjection) ? askedProjection : "mollweide";
  let lines: (typeof LINES)[number] = (LINES as readonly string[]).includes(host.get("grid") ?? "") ? (host.get("grid") as (typeof LINES)[number]) : "30";
  let source: ImageData | null = null;
  let loadedBody: Projected | null = null;
  let base: { key: string; picture: Uint8ClampedArray } | null = null;
  let draws = 0;
  let overlayDraws = 0;
  let lastKey = "";
  const layer = document.createElement("canvas");

  const word = (key: string): string => host.say(key);
  const name = (id: Projected): string => BODIES[id].name[host.lang()];
  select.replaceChildren(...PROJECTED_BODIES.map((id) => Object.assign(document.createElement("option"), { value: id })));
  for (const id of PROJECTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["value"] = id;
    button.addEventListener("click", () => {
      projection = id;
      host.set("proj", id === "mollweide" ? null : id);
      render();
    });
    projBox.append(button);
  }
  for (const id of LINES) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset["value"] = id;
    button.addEventListener("click", () => {
      lines = id;
      host.set("grid", id === "30" ? null : id);
      render();
    });
    linesBox.append(button);
  }
  select.addEventListener("change", () => {
    body = select.value as Projected;
    host.set("pbody", body === "mars" ? null : body);
    render();
  });
  lonInput.addEventListener("input", render);
  latInput.addEventListener("input", render);

  function loadSource(): void {
    const wanted = body;
    if (loadedBody === wanted && source !== null) return;
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      if (wanted !== body) return;
      const scratch = document.createElement("canvas");
      scratch.width = image.naturalWidth;
      scratch.height = image.naturalHeight;
      const context = scratch.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      source = context.getImageData(0, 0, scratch.width, scratch.height);
      loadedBody = wanted;
      base = null;
      lastKey = "";
      render();
    });
    image.src = `${host.textureBase}${wanted}-1024.webp`;
  }

  const centre = (): MapCentre => ({ lon: Number(lonInput.value), lat: projection === "azimuthal" ? Number(latInput.value) : 0 });

  function render(): void {
    select.replaceChildren(...[...select.options].map((option) => Object.assign(option, { textContent: name(option.value as Projected) })));
    select.value = body;
    for (const button of projBox.children as HTMLCollectionOf<HTMLButtonElement>) {
      button.textContent = word(`pj_${button.dataset["value"]!}`);
      button.setAttribute("aria-pressed", String(button.dataset["value"] === projection));
    }
    for (const button of linesBox.children as HTMLCollectionOf<HTMLButtonElement>) {
      const value = button.dataset["value"]!;
      button.textContent = value === "0" ? word("pj_off") : `${value}°`;
      button.setAttribute("aria-pressed", String(value === lines));
    }
    latField.hidden = projection !== "azimuthal";
    loadSource();
    if (loadedBody !== body || source === null) return;

    // the box: as wide as the stage, as tall as the projection's shape says, never taller than 640 pixels
    const { halfWidth, halfHeight } = mapExtent(projection);
    const room = Math.max(280, Math.floor(canvas.parentElement!.clientWidth - 24));
    const cssWidth = Math.min(room, Math.round(640 * (halfWidth / halfHeight)));
    const cssHeight = Math.round((cssWidth * halfHeight) / halfWidth);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    const c = centre();
    const when = host.time();
    const sun = mapSun(projection, body, when, c);
    const fit = fitMap(projection, width, height);
    const spot = mapPixels(fit, sun);
    const picture = `${body}|${projection}|${width}x${height}|${c.lon},${c.lat}`;
    const key = `${picture}|${lines}|${host.lang()}|${Math.round(spot.x)},${Math.round(spot.y)}`;
    if (key === lastKey) return;
    lastKey = key;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      layer.width = width;
      layer.height = height;
      base = null;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const context = canvas.getContext("2d")!;
    if (base === null || base.key !== picture) {
      base = { key: picture, picture: resampleMap(source, projection, width, height, { centre: c }) };
      draws += 1;
    }
    context.clearRect(0, 0, width, height);
    context.putImageData(new ImageData(new Uint8ClampedArray(base.picture), width, height), 0, 0);

    const stroke = (points: { x: number; y: number }[], style: string, size: number): void => {
      context.beginPath();
      points.forEach((point, i) => {
        const at = mapPixels(fit, point);
        if (i === 0) context.moveTo(at.x, at.y);
        else context.lineTo(at.x, at.y);
      });
      context.strokeStyle = style;
      context.lineWidth = size * ratio;
      context.stroke();
    };
    if (lines !== "0") {
      for (const line of graticule(projection, Number(lines), c)) for (const piece of line.lines) stroke(piece, line.value === 0 && line.kind === "parallel" ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", 1);
    }
    stroke(mapOutline(projection), "rgba(255,255,255,0.7)", 1.5);
    context.beginPath();
    context.arc(spot.x, spot.y, 8 * ratio, 0, Math.PI * 2);
    context.strokeStyle = "#ffd54a";
    context.lineWidth = 2.5 * ratio;
    context.stroke();
    context.beginPath();
    context.arc(spot.x, spot.y, 2.5 * ratio, 0, Math.PI * 2);
    context.fillStyle = "#ffd54a";
    context.fill();
    overlayDraws += 1;

    const l = host.lang();
    const label = word(`pj_${projection}`);
    canvas.setAttribute("aria-label", host.say("pj_alt", { body: name(body), proj: label }));
    caption.textContent = host.say("pj_caption", { body: name(body), proj: label, middle: projection === "azimuthal" ? `${coordinateText(l, "lat", c.lat)}${l === "ja" ? "、" : ", "}${coordinateText(l, "lon", c.lon)}` : coordinateText(l, "lon", c.lon), lat: coordinateText(l, "lat", sun.lat), lon2: coordinateText(l, "lon", sun.lon) });
    canvas.dataset["body"] = body;
    canvas.dataset["projection"] = projection;
    canvas.dataset["sunX"] = String(Math.round(spot.x));
    canvas.dataset["sunY"] = String(Math.round(spot.y));
  }

  let wide = canvas.parentElement!.clientWidth;
  new ResizeObserver(() => {
    const now = canvas.parentElement!.clientWidth;
    if (now === wide) return;
    wide = now;
    render();
  }).observe(canvas.parentElement!);

  return { render, stats: () => ({ draws, overlayDraws, body, projection, loaded: loadedBody === body && source !== null }) };
}
