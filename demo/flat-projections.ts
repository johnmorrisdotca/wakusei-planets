// The projections panel of the flat page: any body with a painted map, drawn in one of five projections with the graticule and the Sun's place. The picture is the package's own equirectangular texture, read once into pixels
// and resampled by `resampleMap`. The canvas reuses that raster when only the grid or Sun moves, and draws only while visible.
import { BODIES, BODY_IDS } from "../src/facts.ts";
import { PICTURE_CREDITS, picturesCredit } from "../src/picture-credits.ts";
import { PROJECTIONS, coordinateText, fitMap, graticule, isProjection, mapExtent, mapOutline, mapPixels, mapSun, resampleMap, type MapCentre, type ProjectionId } from "../src/flat/index.ts";

const pictured = new Set(PICTURE_CREDITS.map(({ id }) => id));
/** The bodies with surface pictures. The Sun has no surface coordinates for a sub-solar point. */
export const PROJECTED_BODIES = BODY_IDS.filter((id) => id !== "sun" && pictured.has(id));
type Projected = (typeof PROJECTED_BODIES)[number];
const isProjected = (value: unknown): value is Projected => PROJECTED_BODIES.some((id) => id === value);
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

interface MapSource {
  body: Projected;
  pixels: ImageData | null;
  failed: boolean;
}

export function startProjections(host: ProjectionsHost): { render(): void; renderTime(running: boolean): void; stats(): { draws: number; overlayDraws: number; body: string; projection: string; loaded: boolean } } {
  const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
  const select = $<HTMLSelectElement>("#pj-body");
  const projBox = $("#pj-proj");
  const linesBox = $("#pj-lines");
  const lonInput = $<HTMLInputElement>("#pj-lon");
  const latInput = $<HTMLInputElement>("#pj-lat");
  const latField = $("#pj-lat-field");
  const canvas = $<HTMLCanvasElement>("#projected");
  const caption = $("#pj-caption");
  const credit = $("#pj-credit");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  const askedBody = host.get("pbody");
  const askedProjection = host.get("proj");
  let body: Projected = isProjected(askedBody) ? askedBody : "mars";
  let projection: ProjectionId = isProjection(askedProjection) ? askedProjection : "mollweide";
  let lines: (typeof LINES)[number] = (LINES as readonly string[]).includes(host.get("grid") ?? "") ? (host.get("grid") as (typeof LINES)[number]) : "30";
  let source: MapSource | null = null;
  let base: { key: string; picture: ImageData } | null = null;
  let inView = false;
  let controlLanguage: "en" | "ja" | undefined;
  let draws = 0;
  let overlayDraws = 0;
  let lastKey = "";

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

  function loadSource(): MapSource {
    if (source?.body === body) return source;
    const next: MapSource = { body, pixels: null, failed: false };
    source = next;
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => {
      if (next !== source || next.body !== body) return;
      const scratch = document.createElement("canvas");
      scratch.width = image.naturalWidth;
      scratch.height = image.naturalHeight;
      const context = scratch.getContext("2d", { willReadFrequently: true })!;
      context.drawImage(image, 0, 0);
      next.pixels = context.getImageData(0, 0, scratch.width, scratch.height);
      draw();
    });
    image.addEventListener("error", () => {
      next.failed = true;
      if (next === source && next.body === body) draw();
    });
    image.src = `${host.textureBase}${body}-1024.webp`;
    return next;
  }

  const centre = (): MapCentre => ({ lon: Number(lonInput.value), lat: projection === "azimuthal" ? Number(latInput.value) : 0 });

  function render(): void {
    const l = host.lang();
    if (controlLanguage !== l) {
      controlLanguage = l;
      for (const option of select.options) option.textContent = name(option.value as Projected);
      for (const button of projBox.children as HTMLCollectionOf<HTMLButtonElement>) button.textContent = word(`pj_${button.dataset["value"]!}`);
      for (const button of linesBox.children as HTMLCollectionOf<HTMLButtonElement>) {
        const value = button.dataset["value"]!;
        button.textContent = value === "0" ? word("pj_off") : `${value}°`;
      }
    }
    select.value = body;
    for (const button of projBox.children as HTMLCollectionOf<HTMLButtonElement>) button.setAttribute("aria-pressed", String(button.dataset["value"] === projection));
    for (const button of linesBox.children as HTMLCollectionOf<HTMLButtonElement>) button.setAttribute("aria-pressed", String(button.dataset["value"] === lines));
    latField.hidden = projection !== "azimuthal";
    credit.textContent = picturesCredit([body], l);
    draw();
  }

  function draw(): void {
    if (!inView || document.hidden) return;
    const map = loadSource();
    canvas.style.visibility = map.pixels === null ? "hidden" : "";
    if (map.pixels === null) {
      caption.textContent = host.say(map.failed ? "pj_failed" : "pj_loading", { body: name(body) });
      lastKey = "";
      return;
    }

    // the box: as wide as the stage, as tall as the projection's shape says, never taller than 640 pixels
    const { halfWidth, halfHeight } = mapExtent(projection);
    const room = Math.max(1, Math.floor(canvas.parentElement!.clientWidth - 24));
    const cssWidth = Math.min(room, Math.round(640 * (halfWidth / halfHeight)));
    const cssHeight = Math.max(1, Math.round((cssWidth * halfHeight) / halfWidth));
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
      base = null;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    const context = canvas.getContext("2d")!;
    if (base === null || base.key !== picture) {
      const pixels = resampleMap(map.pixels, projection, width, height, { centre: c });
      base = { key: picture, picture: new ImageData(new Uint8ClampedArray(pixels), width, height) };
      draws += 1;
    }
    context.putImageData(base.picture, 0, 0);

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
    draw();
  }).observe(canvas.parentElement!);
  new IntersectionObserver(([entry]) => {
    inView = entry?.isIntersecting === true;
    draw();
  }).observe(canvas);
  document.addEventListener("visibilitychange", draw);

  return {
    render,
    renderTime: (running) => { if (!running || !motion.matches) draw(); },
    stats: () => ({ draws, overlayDraws, body, projection, loaded: source?.body === body && source.pixels !== null }),
  };
}
